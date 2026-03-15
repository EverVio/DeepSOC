import hashlib
import logging
import os
import threading
import time
from typing import Dict, Optional, List

from ddgs import DDGS
from django.conf import settings
from django.core.cache import cache
from openai import OpenAI

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


def real_web_search(query: str, max_results: int = 3) -> List[Dict]:
    logger.info(f"[REAL-WEB-SEARCH] 正在执行联网搜索: {query}")
    try:
        with DDGS() as ddgs:
            results = ddgs.text(query, region="cn-zh", backend="yandex", max_results=max_results)
            if not results:
                logger.warning(f"联网搜索 '{query}' 没有返回结果。")
                return []

            return [{"content": r["body"], "source": r["href"]} for r in results]
    except Exception as e:
        logger.error(f"DuckDuckGo 搜索失败: {e}")
        return []


def _build_openai_messages(
    prompt: str,
    conversation_history: Optional[List[Dict]],
    log_results: List[Dict],
    web_results: List[Dict],
) -> List[Dict[str, str]]:
    messages: List[Dict[str, str]] = [{"role": "system", "content": SRE_SYSTEM_PROMPT}]

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
            score = float(item.get("score", 0.0))
            log_lines.append(f"日志 {i} (Score: {score:.2f}): {item.get('content', '')}")
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
    print("Prompt\n", messages)
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

    # MiniMax 文档建议启用 reasoning_split，便于后续扩展思考流拆分。
    if provider == "minimax":
        request_kwargs["extra_body"] = {"reasoning_split": True}
        request_kwargs["temperature"] = 1.0

    stream = client.chat.completions.create(**request_kwargs)
    for chunk in stream:
        if not getattr(chunk, "choices", None):
            continue
        delta = chunk.choices[0].delta
        if not delta:
            continue

        # 部分推理模型会通过 reasoning_content 返回思考流。
        reasoning_content = getattr(delta, "reasoning_content", None)
        if reasoning_content:
            yield reasoning_content

        content = getattr(delta, "content", None)
        if content:
            yield content


def model_api_call(
    prompt: str,
    conversation_history: List[Dict] = None,
    use_db_search: bool = True,
    use_web_search: bool = False,
    model_name: Optional[str] = None,
    provider: Optional[str] = "ollama",
    provider_api_key: Optional[str] = None,
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
                print(f"针对查询 '{prompt}' 的 Top-K 检索结果：\n")
                for index, result in enumerate(log_results, start=1):
                    print(f"[{index}] 匹配分数: {result['score']:.4f} | 命中方式: {result['source']}")
                    print(f"日志内容: {result['content']}")
                    print("-" * 40)

        if use_web_search:
            logger.info(f"执行联网搜索: {prompt}")
            web_results = real_web_search(prompt, max_results=10)

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

    except Exception as e:
        logger.error(f"model_api_call 流式处理失败: {e}")
        yield f"API 调用失败: {e}"


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
