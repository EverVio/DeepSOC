import hashlib
import logging
import os
import threading
import time
import datetime
from typing import Any, Dict, Optional, List, Iterable

from ddgs import DDGS
from django.conf import settings
from django.core.cache import cache
from openai import OpenAI
from langchain_core.messages import BaseMessage
import requests

from topklogsystem import TopKLogSystem
from .models import APIKey, RateLimit, ConversationSession

logger = logging.getLogger(__name__)


# Ollama 模型名称映射（前端展示名 -> Ollama 模型 ID）
OLLAMA_MODEL_ALIASES = {
    "DeepSeek-R1:7b": "deepseek-r1:7b",
    "Qwen3:8b": "qwen3:8b",
    "Llama3:8b": "llama3:8b",
}
# 硅基流动模型名称映射（前端展示名 -> 硅基流动模型 ID）
SILICONFLOW_MODEL_ALIASES = {
    "DeepSeek-V3.2": "deepseek-ai/DeepSeek-V3.2",
    "DeepSeek-R1": "deepseek-ai/DeepSeek-R1",
    "Qwen2.5-72B": "Qwen/Qwen2.5-72B-Instruct",
    "deepseek-chat": "deepseek-ai/DeepSeek-V3.2",
    "deepseek-reasoner": "deepseek-ai/DeepSeek-R1",
    "gpt-4o-mini": "deepseek-ai/DeepSeek-V3.2",
    "gpt-4": "deepseek-ai/DeepSeek-V3.2",
    "gpt-3.5-turbo": "deepseek-ai/DeepSeek-V3.2",
    "deepseek-v3.2": "deepseek-ai/DeepSeek-V3.2",
    "deepseek-r1": "deepseek-ai/DeepSeek-R1",
    "qwen2.5-72b": "Qwen/Qwen2.5-72B-Instruct",
}


# OpenAI 兼容提供商的基础 URL
DEFAULT_OPENAI_COMPATIBLE_BASE_URLS = {
    "openai": "https://api.openai.com/v1",
    "deepseek": "https://api.deepseek.com",
    "minimax": "https://api.minimaxi.com/v1",
    "siliconflow": "https://api.siliconflow.cn/v1",
}

# 各提供商默认模型
PROVIDER_DEFAULT_MODELS = {
    "ollama": "deepseek-r1:7b",
    "openai": "gpt-4o-mini",
    "deepseek": "deepseek-chat",
    "minimax": "MiniMax-M2.5",
    "siliconflow": "deepseek-ai/DeepSeek-V3.2",
}

OPENAI_COMPATIBLE_PROVIDERS = {"openai", "deepseek", "minimax", "siliconflow"}

PROVIDER_API_KEY_ENV = {
    "openai": "OPENAI_API_KEY",
    "deepseek": "DEEPSEEK_API_KEY",
    "minimax": "MINIMAX_API_KEY",
    "siliconflow": "SILICONFLOW_API_KEY",
}

WEB_SEARCH_API_KEY_ENV = "BOCHA_API_KEY"

SRE_SYSTEM_PROMPT = """
你是一个多任务SRE助手。你的首要任务是先判断用户意图：
1. 与故障排查、日志分析、系统错误相关时，进入 SRE 分析模式。
2. 与日志无关的闲聊、历史回顾、常识问答时，进入常规对话模式。

在 SRE 分析模式下：
- 必须优先基于提供的日志上下文进行分析，禁止无依据猜测。
- 仅当日志不足或用户明确需要外部信息时，再使用联网搜索上下文。
- 使用清晰的 Markdown 结构输出结论和建议。

在常规对话模式下：
- 直接、自然地回答用户问题即可。
""".strip()


# 全局初始化 TopKLogSystem
# 使用 DeepSeek-R1:7B 作为主模型，bge-large:latest 作为嵌入模型
# 避免在每次 API 调用时都重新加载索引，极大提高效率
try:
    log_system = TopKLogSystem(
        log_path="./data/log",
        llm="deepseek-r1:7b",
        embedding_model="bge-large:latest",
    )
    logger.info("TopKLogSystem 全局初始化成功。使用模型: DeepSeek-R1:7B")
except Exception as e:
    log_system = None
    logger.error(f"TopKLogSystem 全局初始化失败: {e}")


def normalize_provider(provider: Optional[str]) -> str:
    if not provider:
        return "ollama"
    normalized = provider.strip().lower()
    if normalized in {"openai", "deepseek", "minimax", "ollama", "siliconflow"}:
        return normalized
    return "ollama"


def resolve_model_name(provider: str, model_name: Optional[str]) -> str:
    normalized_model = (model_name or "").strip()
    if not normalized_model:
        return PROVIDER_DEFAULT_MODELS.get(provider, PROVIDER_DEFAULT_MODELS["ollama"])

    if provider == "siliconflow":
        custom_sf_aliases = getattr(settings, "SILICONFLOW_MODEL_ALIASES", None)
        if isinstance(custom_sf_aliases, dict):
            candidate = custom_sf_aliases.get(normalized_model) or custom_sf_aliases.get(normalized_model.lower())
            if candidate:
                return candidate
        alias = SILICONFLOW_MODEL_ALIASES.get(normalized_model) or SILICONFLOW_MODEL_ALIASES.get(normalized_model.lower())
        if alias:
            return alias

        lowered_model = normalized_model.lower()
        if lowered_model in {"deepseek-chat", "deepseek-reasoner", "gpt-4o-mini", "gpt-4", "gpt-3.5-turbo"}:
            fallback = PROVIDER_DEFAULT_MODELS["siliconflow"]
            logger.warning(
                f"siliconflow 模型 '{normalized_model}' 未直接支持，回退到默认模型 '{fallback}'"
            )
            return fallback

        return normalized_model
    
    if provider != "ollama":
        return normalized_model

    custom_aliases = getattr(settings, "LLM_MODEL_ALIASES", None)
    if isinstance(custom_aliases, dict):
        candidate = custom_aliases.get(normalized_model) or custom_aliases.get(normalized_model.lower())
        if candidate:
            return candidate

    alias = OLLAMA_MODEL_ALIASES.get(normalized_model) or OLLAMA_MODEL_ALIASES.get(normalized_model.lower())
    if alias:
        return alias

    return normalized_model.lower()


def resolve_provider_base_url(provider: str) -> str:
    custom_base_urls = getattr(settings, "OPENAI_COMPATIBLE_BASE_URLS", None)
    if isinstance(custom_base_urls, dict):
        candidate = custom_base_urls.get(provider) or custom_base_urls.get(provider.lower())
        if candidate:
            return candidate
    return DEFAULT_OPENAI_COMPATIBLE_BASE_URLS[provider]


def resolve_provider_api_key(provider: str, provider_api_key: Optional[str]) -> Optional[str]:
    if provider_api_key and provider_api_key.strip():
        return provider_api_key.strip()

    env_name = PROVIDER_API_KEY_ENV.get(provider)
    if not env_name:
        return None
    fallback_key = os.environ.get(env_name)
    if fallback_key and fallback_key.strip():
        return fallback_key.strip()
    return None


def resolve_web_search_api_key(web_search_api_key: Optional[str]) -> Optional[str]:
    if web_search_api_key and web_search_api_key.strip():
        return web_search_api_key.strip()

    fallback_key = os.environ.get(WEB_SEARCH_API_KEY_ENV)
    if fallback_key and fallback_key.strip():
        return fallback_key.strip()
    return None


class ProviderHttpError(Exception):
    """OpenAI-compatible provider 调用失败，附带结构化错误详情。"""

    def __init__(self, message: str, detail: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.detail = detail or {}


def _extract_error_body(exc: Exception) -> Dict[str, Any]:
    body = getattr(exc, "body", None)
    if isinstance(body, dict):
        return body

    response = getattr(exc, "response", None)
    if response is not None:
        try:
            parsed = response.json()
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            return {}

    return {}


def build_openai_compatible_error_detail(provider: str, model: str, exc: Exception) -> Dict[str, Any]:
    response = getattr(exc, "response", None)
    status_code = getattr(exc, "status_code", None)
    if status_code is None and response is not None:
        status_code = getattr(response, "status_code", None)

    request_id = getattr(exc, "request_id", None)
    if not request_id and response is not None:
        headers = getattr(response, "headers", None)
        if headers and hasattr(headers, "get"):
            request_id = headers.get("x-request-id") or headers.get("request-id")

    body = _extract_error_body(exc)
    error_obj = body.get("error") if isinstance(body.get("error"), dict) else body

    message = None
    error_type = None
    error_code = None
    error_param = None

    if isinstance(error_obj, dict):
        message = error_obj.get("message")
        error_type = error_obj.get("type")
        error_code = error_obj.get("code")
        error_param = error_obj.get("param")

    if not message:
        message = str(exc)

    detail = {
        "provider": provider,
        "model": model,
        "status_code": status_code,
        "error_type": error_type,
        "error_code": error_code,
        "error_param": error_param,
        "message": message,
        "request_id": request_id,
    }
    return {k: v for k, v in detail.items() if v is not None and v != ""}


def _raise_openai_compatible_error(provider: str, model: str, exc: Exception) -> None:
    detail = build_openai_compatible_error_detail(provider, model, exc)
    logger.error(
        "OpenAI-compatible 调用失败 provider=%s model=%s status=%s code=%s message=%s",
        provider,
        model,
        detail.get("status_code"),
        detail.get("error_code"),
        detail.get("message"),
    )
    raise ProviderHttpError(detail.get("message") or str(exc), detail) from exc


def web_search(
    query: str,
    max_results: int = 3,
    web_search_api_key: Optional[str] = None,
) -> List[Dict]:
    """
    调用博查 Web Search API 进行联网检索
    
    设计思路：
    1. 鉴于原始搜索引擎（如 DuckDuckGo）摘要过短，此处显式设置 "summary": True，要求博查引擎返回深度摘要，提升 RAG 质量。
    2. 提取响应中的网页列表（webPages -> value），组装成统一的上下文格式供 LLM 消费。
    
    边界情况：
    - API 实际返回的数量可能小于 count，需遍历实际返回的列表。
    - 某些页面可能无法生成 summary，此时降级使用 snippet 字段。
    """
    logger.info(f"[REAL-WEB-SEARCH] 正在执行博查联网搜索: {query}")
    
    url = "https://api.bocha.cn/v1/web-search"
    api_key = resolve_web_search_api_key(web_search_api_key)
    if not api_key:
        logger.warning("联网搜索 API Key 为空，跳过联网检索。")
        return []
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "query": query,
        "summary": True, 
        "count": max_results,
        "freshness": "noLimit" 
    }
    
    response = requests.post(url, headers=headers, json=payload)
    response_data = response.json()
    
    # 解析响应结构: SearchData -> webPages -> value
    # 根据标准 API 包装格式，通常数据位于 data 键下
    web_pages = response_data.get("data", {}).get("webPages", {}).get("value", [])
    
    results = []
    for page in web_pages:
        # 优先取深度摘要 summary，若为空则取简短片段 snippet
        content = page.get("summary") or page.get("snippet") or ""
        source = page.get("url", "N/A")
        
        if content:
            results.append({"content": content, "source": source})
            
    if not results:
        logger.warning(f"联网搜索 '{query}' 没有返回结果。")
        
    return results


def _build_openai_messages(
    prompt: str,
    conversation_history: list[dict],
    log_results: list[dict],
    web_results: list[dict],
) -> list[dict[str, str]]:
    current_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S %A")
    dynamic_system_prompt = f"{SRE_SYSTEM_PROMPT}\n\n[系统环境信息]\n当前系统时间：{current_time}"

    def _format_log_evidence(item: Dict[str, Any], index: int) -> str:
        score = float(item.get("score", 0.0))
        metadata = item.get("metadata", {}) or {}
        evidence = item.get("evidence", {}) or {}

        parts = [f"日志 {index}", f"Score: {score:.2f}"]

        db_type = metadata.get("db_type") or evidence.get("db_type")
        if db_type:
            parts.append(f"DB: {db_type}")

        risk_level = metadata.get("risk_level") or evidence.get("risk_level")
        if risk_level:
            parts.append(f"Risk: {risk_level}")

        confidence = metadata.get("confidence") or evidence.get("confidence")
        if confidence is not None:
            parts.append(f"Confidence: {confidence}")

        source = metadata.get("source") or evidence.get("source")
        if source:
            parts.append(f"Source: {source}")

        raw_content_hash = metadata.get("raw_content_hash") or evidence.get("raw_content_hash")
        if raw_content_hash:
            parts.append(f"Hash: {raw_content_hash}")

        record_file = metadata.get("record_file")
        if record_file:
            record_line = metadata.get("record_line")
            location = f"{record_file}:{record_line}" if record_line is not None else record_file
            parts.append(f"Location: {location}")

        mitre_attack_id = metadata.get("mitre_attack_id")
        if mitre_attack_id:
            parts.append(f"MITRE: {mitre_attack_id}")

        tags = metadata.get("tags")
        if tags:
            parts.append(f"Tags: {tags}")

        content = item.get("content", "")
        return f"{' | '.join(parts)}\n内容: {content}"
    
    messages: list[dict[str, str]] = [{"role": "system", "content": dynamic_system_prompt}]

    if conversation_history:
        for msg in conversation_history:
            role = (msg.get("role") or "").strip().lower()
            content = (msg.get("content") or "").strip()
            if not content:
                continue
            if role in {"user", "assistant", "system"}:
                messages.append({"role": role, "content": content})

    context_blocks: List[str] = []

    log_lines = ["## [可用工具 1: 日志数据库 (Log DB)]"]
    if not log_results:
        log_lines.append("（未从日志数据库检索到相关内容）")
    else:
        for i, item in enumerate(log_results, 1):
            log_lines.append(_format_log_evidence(item, i))
    context_blocks.append("\n".join(log_lines))

    web_lines = ["## [可用工具 2: 联网搜索 (Web Search)]"]
    if not web_results:
        web_lines.append("（未启用或未从联网搜索检索到相关内容）")
    else:
        for i, item in enumerate(web_results, 1):
            source = item.get("source", "N/A")
            web_lines.append(f"网页 {i} (Source: {source}): {item.get('content', '')}")
    context_blocks.append("\n".join(web_lines))

    user_content = "\n\n".join(context_blocks) + f"\n\n当前用户问题:\n{prompt}"
    messages.append({"role": "user", "content": user_content})
    return messages


def stream_openai_compatible_response(
    provider: str,
    prompt: str,
    conversation_history: Optional[List[Dict]],
    model_name: str,
    provider_api_key: Optional[str],
    log_results: List[Dict],
    web_results: List[Dict],
):
    api_key = resolve_provider_api_key(provider, provider_api_key)
    if not api_key:
        yield f"错误：{provider} API Key 为空，请在设置中填写后重试。"
        return

    base_url = resolve_provider_base_url(provider)
    messages = _build_openai_messages(prompt, conversation_history, log_results, web_results)

    logger.info(f"使用 OpenAI 兼容接口调用 provider={provider}, model={model_name}, base_url={base_url}")

    client = OpenAI(api_key=api_key, base_url=base_url)
    request_kwargs = {
        "model": model_name,
        "messages": messages,
        "stream": True,
    }

    if provider == "minimax":
        request_kwargs["extra_body"] = {"reasoning_split": True}
        request_kwargs["temperature"] = 1.0

    try:
        stream = client.chat.completions.create(**request_kwargs)
        for chunk in stream:
            if not getattr(chunk, "choices", None):
                continue
            delta = chunk.choices[0].delta
            if not delta:
                continue

            reasoning_content = getattr(delta, "reasoning_content", None)
            if reasoning_content:
                yield reasoning_content

            content = getattr(delta, "content", None)
            if content:
                yield content
    except Exception as e:
        _raise_openai_compatible_error(provider, model_name, e)


def stream_llm_from_messages(
    provider: str,
    messages: List[BaseMessage] | List[Dict[str, str]],
    model_name: Optional[str] = None,
    provider_api_key: Optional[str] = None,
) -> Iterable[str]:
    """
    通用流式 LLM 调用：
    - OpenAI-compatible: 接收 dict messages（role/content）或 LangChain BaseMessage
    - Ollama: 使用 TopKLogSystem 内部的 OllamaLLM 进行 stream（接收 LangChain BaseMessage 列表）
    """
    provider_name = normalize_provider(provider)
    resolved_model_name = resolve_model_name(provider_name, model_name)

    if provider_name in OPENAI_COMPATIBLE_PROVIDERS:
        api_key = resolve_provider_api_key(provider_name, provider_api_key)
        if not api_key:
            yield f"错误：{provider_name} API Key 为空，请在设置中填写后重试。"
            return

        if messages and isinstance(messages[0], BaseMessage):
            oa_messages: List[Dict[str, str]] = []
            for m in messages:  # type: ignore[assignment]
                role = getattr(m, "type", None) or getattr(m, "role", None) or "user"
                if role == "human":
                    role = "user"
                elif role == "ai":
                    role = "assistant"
                content = getattr(m, "content", "")
                oa_messages.append({"role": role, "content": str(content)})
        else:
            oa_messages = messages  # type: ignore[assignment]

        base_url = resolve_provider_base_url(provider_name)
        client = OpenAI(api_key=api_key, base_url=base_url)
        request_kwargs = {"model": resolved_model_name, "messages": oa_messages, "stream": True}
        if provider_name == "minimax":
            request_kwargs["extra_body"] = {"reasoning_split": True}
            request_kwargs["temperature"] = 1.0

        try:
            stream = client.chat.completions.create(**request_kwargs)
            for chunk in stream:
                if not getattr(chunk, "choices", None):
                    continue
                delta = chunk.choices[0].delta
                if not delta:
                    continue
                reasoning_content = getattr(delta, "reasoning_content", None)
                if reasoning_content:
                    yield reasoning_content
                content = getattr(delta, "content", None)
                if content:
                    yield content
            return
        except Exception as e:
            _raise_openai_compatible_error(provider_name, resolved_model_name, e)

    if provider_name != "ollama":
        yield f"错误：当前 provider={provider_name} 不支持该调用方式。"
        return

    if log_system is None:
        yield "错误：日志分析系统未成功初始化，无法调用 ollama。"
        return

    if not messages or not isinstance(messages[0], BaseMessage):
        yield "错误：ollama 调用需要 LangChain messages。"
        return

    llm = log_system._get_or_create_llm(resolved_model_name)
    for chunk in llm.stream(messages):  # type: ignore[arg-type]
        yield chunk


def model_api_call(
    prompt: str,
    conversation_history: List[Dict] = None,
    use_db_search: bool = True,
    use_web_search: bool = False,
    model_name: Optional[str] = None,
    provider: Optional[str] = "ollama",
    provider_api_key: Optional[str] = None,
    web_search_api_key: Optional[str] = None,
):
    """
    调用模型 API（流式响应）。
    """

    provider_name = normalize_provider(provider)
    resolved_model_name = resolve_model_name(provider_name, model_name)

    logger.info(f"模型调用参数: provider={provider_name}, model={resolved_model_name}")

    log_results: List[Dict] = []
    web_results: List[Dict] = []

    try:
        if use_db_search:
            if log_system is None:
                logger.warning("log_system 未初始化，跳过数据库日志检索。")
            else:
                logger.info(f"执行数据库日志检索: {prompt}")
                log_results = log_system.retrieve_logs(prompt, top_k=5)
                logger.info(f"针对查询 '{prompt}' 的 Top-K 检索结果：")
                for index, result in enumerate(log_results, start=1):
                    metadata = result.get("metadata", {}) or {}
                    evidence = result.get("evidence", {}) or {}
                    db_type = metadata.get("db_type") or evidence.get("db_type") or "unknown"
                    risk_level = metadata.get("risk_level") or evidence.get("risk_level") or "unknown"
                    confidence = metadata.get("confidence") or evidence.get("confidence") or "unknown"
                    source = metadata.get("source") or evidence.get("source") or "unknown"
                    hash_value = metadata.get("raw_content_hash") or evidence.get("raw_content_hash") or "unknown"
                    logger.info(
                        "[%s] 匹配分数: %.4f | 命中方式: %s | DB: %s | Risk: %s | Confidence: %s | Source: %s | Hash: %s | 内容: %s",
                        index,
                        float(result.get("score", 0.0)),
                        result.get("source", "unknown"),
                        db_type,
                        risk_level,
                        confidence,
                        source,
                        hash_value,
                        result.get("content", ""),
                    )

        if use_web_search:
            logger.info(f"执行联网搜索: {prompt}")
            web_results = web_search(prompt, max_results=10, web_search_api_key=web_search_api_key)

        if provider_name in OPENAI_COMPATIBLE_PROVIDERS:
            for chunk in stream_openai_compatible_response(
                provider=provider_name,
                prompt=prompt,
                conversation_history=conversation_history,
                model_name=resolved_model_name,
                provider_api_key=provider_api_key,
                log_results=log_results,
                web_results=web_results,
            ):
                yield chunk
            return

        if log_system is None:
            logger.error("Log system 未初始化，无法调用 ollama 模型。")
            yield "错误：日志分析系统未成功初始化，无法调用 ollama。"
            return

        combined_context = {"log_context": log_results, "web_context": web_results}
        
        for chunk in log_system.generate_response(
            prompt,
            context=combined_context,
            history=conversation_history,
            model_name=resolved_model_name,
        ):
            yield chunk

    except ProviderHttpError as e:
        logger.error("model_api_call provider 调用失败: %s", e.detail)
        yield {"type": "error", "chunk": e.detail.get("message") or str(e), "error_detail": e.detail}
    except Exception as e:
        logger.error(f"model_api_call 流式处理失败: {e}")
        yield {"type": "error", "chunk": f"API 调用失败: {e}"}


def create_api_key(username: str) -> str:
    """
    为用户创建或更新 API Key。
    如果用户已存在，则更新其 key 和过期时间；否则创建新记录。
    """
    expiry_duration = settings.TOKEN_EXPIRY_SECONDS
    expiry_timestamp = int(time.time()) + expiry_duration

    api_key_obj, _created = APIKey.objects.update_or_create(
        user=username,
        defaults={
            "key": APIKey.generate_key(),
            "expiry_time": expiry_timestamp,
        },
    )
    return api_key_obj.key


def validate_api_key(key_str: str) -> bool:
    """验证 API Key 是否存在且未过期"""
    try:
        api_key = APIKey.objects.get(key=key_str)
        if api_key.is_valid():
            return True
        api_key.delete()
        return False
    except APIKey.DoesNotExist:
        return False


rate_lock = threading.Lock()


def check_rate_limit(key_str: str) -> bool:
    """检查 API Key 的请求频率是否超过限制"""
    with rate_lock:
        try:
            rate_limit = RateLimit.objects.select_related("api_key").get(api_key__key=key_str)

            current_time = time.time()
            if current_time > rate_limit.reset_time:
                rate_limit.count = 1
                rate_limit.reset_time = current_time + settings.RATE_LIMIT_INTERVAL
                rate_limit.save()
                return True
            if rate_limit.count < settings.RATE_LIMIT_MAX:
                rate_limit.count += 1
                rate_limit.save()
                return True
            return False
        except RateLimit.DoesNotExist:
            try:
                current_time = time.time()
                api_key = APIKey.objects.get(key=key_str)
                RateLimit.objects.create(
                    api_key=api_key,
                    count=1,
                    reset_time=current_time + settings.RATE_LIMIT_INTERVAL,
                )
                return True
            except APIKey.DoesNotExist:
                return False


def get_or_create_session(session_id: str, user: APIKey) -> ConversationSession:
    """
    获取或创建用户的专属会话：
    - 若用户+session_id已存在 -> 加载旧会话（保留历史）
    - 若不存在 -> 创建新会话（空历史）
    """
    session, created = ConversationSession.objects.get_or_create(
        session_id=session_id,
        user=user,
        defaults={"context": ""},
    )
    logger.info(f"会话 {session_id}（用户：{user.user}）{'创建新会话' if created else '加载旧会话'}")
    return session


def get_cached_reply(prompt: str, session_id: str, user: APIKey) -> str | None:
    """缓存键包含 session_id 和 user，避免跨会话冲突"""
    cache_key = f"reply:{user.user}:{session_id}:{hash(prompt)}"
    return cache.get(cache_key)


def set_cached_reply(prompt: str, reply: str, session_id: str, user: APIKey, timeout=3600):
    cache_key = f"reply:{user.user}:{session_id}:{hash(prompt)}"
    cache.set(cache_key, reply, timeout)


def generate_cache_key(original_key: str) -> str:
    """生成安全的缓存键"""
    hash_obj = hashlib.sha256(original_key.encode("utf-8"))
    return hash_obj.hexdigest()
