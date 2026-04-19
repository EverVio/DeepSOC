import hashlib
import json
import logging
import os
import re
import threading
import time
import datetime
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from typing import Any, Dict, Optional, List, Iterable

from ddgs import DDGS
from django.conf import settings
from django.db import transaction
from django.core.cache import cache
from openai import OpenAI
from langchain_core.messages import BaseMessage
import requests

from topklogsystem import TopKLogSystem
from .models import APIKey, RateLimit, ConversationSession
from .query_service import list_query_records

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

SILICONFLOW_EMBEDDING_MODEL_ALIASES = {
    "Qwen/Qwen3-Embedding-8B": "Qwen/Qwen3-Embedding-8B",
    "Qwen3-Embedding-8B": "Qwen/Qwen3-Embedding-8B",
    "qwen3-embedding-8b": "Qwen/Qwen3-Embedding-8B",
}

DEFAULT_EMBEDDING_MODELS = {
    "local": "qwen3-embedding:4b",
    "siliconflow": "Qwen/Qwen3-Embedding-8B",
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
# 使用 DeepSeek-R1:7B 作为主模型，qwen3-embedding:4b 作为嵌入模型
# 避免在每次 API 调用时都重新加载索引，极大提高效率
try:
    log_system = TopKLogSystem(
        log_path="./data/log",
        llm="deepseek-r1:7b",
        embedding_model="qwen3-embedding:4b",
    )
    logger.info("TopKLogSystem 全局初始化成功。使用模型: DeepSeek-R1:7B")
except Exception as e:
    log_system = None
    logger.error(f"TopKLogSystem 全局初始化失败: {e}")


def _warm_query_records_cache() -> None:
    if not bool(getattr(settings, "WARM_QUERY_RECORD_CACHE", True)):
        return

    try:
        list_query_records(
            query="",
            page=1,
            page_size=1,
            filters={},
            start_time="",
            end_time="",
            sort_by="fetched_at",
            sort_order="desc",
            include_facets=False,
            truncate_summary=False,
        )
        logger.info("查询记录缓存预热完成")
    except Exception as exc:
        logger.warning("查询记录缓存预热失败: %s", exc)


_warm_query_records_cache()


def normalize_provider(provider: Optional[str]) -> str:
    if not provider:
        return "ollama"
    normalized = provider.strip().lower()
    if normalized in {"openai", "deepseek", "minimax", "ollama", "siliconflow"}:
        return normalized
    return "ollama"


def normalize_embedding_mode(mode: Optional[str]) -> str:
    if not mode:
        return "local"

    normalized = mode.strip().lower()
    if normalized in {"siliconflow", "remote"}:
        return "siliconflow"
    return "local"


def resolve_embedding_model(mode: str, model_name: Optional[str]) -> str:
    normalized_model = (model_name or "").strip()
    if mode != "siliconflow":
        return normalized_model or DEFAULT_EMBEDDING_MODELS["local"]

    if not normalized_model:
        return DEFAULT_EMBEDDING_MODELS["siliconflow"]

    alias = SILICONFLOW_EMBEDDING_MODEL_ALIASES.get(normalized_model)
    if alias:
        return alias

    alias_lower = SILICONFLOW_EMBEDDING_MODEL_ALIASES.get(normalized_model.lower())
    if alias_lower:
        return alias_lower

    return normalized_model


def resolve_model_name(provider: str, model_name: Optional[str]) -> str:
    normalized_model = (model_name or "").strip()
    if not normalized_model:
        return PROVIDER_DEFAULT_MODELS.get(provider, PROVIDER_DEFAULT_MODELS["ollama"])

    if provider == "siliconflow":
        custom_sf_aliases = getattr(settings, "SILICONFLOW_MODEL_ALIASES", None)
        if isinstance(custom_sf_aliases, dict):
            candidate = custom_sf_aliases.get(
                normalized_model
            ) or custom_sf_aliases.get(normalized_model.lower())
            if candidate:
                return candidate
        alias = SILICONFLOW_MODEL_ALIASES.get(
            normalized_model
        ) or SILICONFLOW_MODEL_ALIASES.get(normalized_model.lower())
        if alias:
            return alias

        lowered_model = normalized_model.lower()
        if lowered_model in {
            "deepseek-chat",
            "deepseek-reasoner",
            "gpt-4o-mini",
            "gpt-4",
            "gpt-3.5-turbo",
        }:
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
        candidate = custom_aliases.get(normalized_model) or custom_aliases.get(
            normalized_model.lower()
        )
        if candidate:
            return candidate

    alias = OLLAMA_MODEL_ALIASES.get(normalized_model) or OLLAMA_MODEL_ALIASES.get(
        normalized_model.lower()
    )
    if alias:
        return alias

    return normalized_model.lower()


def resolve_provider_base_url(provider: str) -> str:
    custom_base_urls = getattr(settings, "OPENAI_COMPATIBLE_BASE_URLS", None)
    if isinstance(custom_base_urls, dict):
        candidate = custom_base_urls.get(provider) or custom_base_urls.get(
            provider.lower()
        )
        if candidate:
            return candidate
    return DEFAULT_OPENAI_COMPATIBLE_BASE_URLS[provider]


def resolve_provider_api_key(
    provider: str, provider_api_key: Optional[str]
) -> Optional[str]:
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


def create_remote_embeddings(
    inputs: List[str],
    model_name: Optional[str] = None,
    provider_api_key: Optional[str] = None,
) -> Dict[str, Any]:
    normalized_inputs = [
        str(item).strip() for item in (inputs or []) if str(item).strip()
    ]
    if not normalized_inputs:
        raise ValueError("Embedding 输入不能为空")

    provider = "siliconflow"
    api_key = resolve_provider_api_key(provider, provider_api_key)
    if not api_key:
        raise ValueError("SiliconFlow API Key 为空，请在设置中填写后重试。")

    resolved_model_name = resolve_embedding_model("siliconflow", model_name)
    base_url = resolve_provider_base_url(provider)
    logger.info(
        "调用远程 embedding provider=%s model=%s count=%s",
        provider,
        resolved_model_name,
        len(normalized_inputs),
    )

    client = OpenAI(api_key=api_key, base_url=base_url)
    try:
        response = client.embeddings.create(
            model=resolved_model_name,
            input=normalized_inputs,
            encoding_format="float",
        )
    except Exception as e:
        _raise_openai_compatible_error(provider, resolved_model_name, e)

    vectors: List[Dict[str, Any]] = []
    for item in getattr(response, "data", []) or []:
        vectors.append(
            {
                "index": int(getattr(item, "index", 0) or 0),
                "embedding": list(getattr(item, "embedding", []) or []),
            }
        )

    usage_data: Dict[str, Any] = {}
    usage = getattr(response, "usage", None)
    if usage is not None:
        prompt_tokens = getattr(usage, "prompt_tokens", None)
        total_tokens = getattr(usage, "total_tokens", None)
        if prompt_tokens is not None:
            usage_data["prompt_tokens"] = prompt_tokens
        if total_tokens is not None:
            usage_data["total_tokens"] = total_tokens

    return {
        "provider": provider,
        "mode": "siliconflow",
        "model": resolved_model_name,
        "count": len(vectors),
        "data": vectors,
        "usage": usage_data,
    }


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


def build_openai_compatible_error_detail(
    provider: str, model: str, exc: Exception
) -> Dict[str, Any]:
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


def retrieve_logs_remote_mode(prompt: str, top_k: int = 5) -> List[Dict[str, Any]]:
    """远程模式复用本地检索策略：候选召回 -> 同权重重排 -> 证据链聚合。"""
    if log_system is None:
        return []

    limit = max(int(top_k or 5), 3)
    query_signals = log_system._extract_query_signals(prompt)
    query_terms = log_system._build_query_terms(prompt)

    raw_prompt = (prompt or "").strip()
    token_candidates = re.findall(r"[A-Za-z0-9_.:/-]+|[\u4e00-\u9fff]{2,}", raw_prompt)
    stop_tokens = {
        "怎么办",
        "如何",
        "怎么",
        "为什么",
        "请问",
        "简短",
        "回答",
    }

    max_queries = max(
        int(getattr(settings, "REMOTE_RETRIEVAL_MAX_QUERIES", 3) or 3),
        1,
    )
    enable_relaxed_pass = bool(
        getattr(settings, "REMOTE_RETRIEVAL_ENABLE_RELAXED", False)
    )

    def append_query(target: List[str], value: str) -> None:
        normalized_value = (value or "").strip().lower()
        if (
            not normalized_value
            or normalized_value in stop_tokens
            or normalized_value in target
            or len(target) >= max_queries
        ):
            return
        target.append(normalized_value)

    primary_queries: List[str] = []
    append_query(primary_queries, raw_prompt)

    for token in token_candidates:
        if len(primary_queries) >= max_queries:
            break

        normalized = token.strip().lower()
        if not normalized:
            continue

        append_query(primary_queries, normalized)

        if re.fullmatch(r"[\u4e00-\u9fff]{4,}", normalized):
            for size in (2, 3):
                upper_bound = len(normalized) - size + 1
                for start in range(max(upper_bound, 0)):
                    if len(primary_queries) >= max_queries:
                        break
                    fragment = normalized[start : start + size]
                    append_query(primary_queries, fragment)
                if len(primary_queries) >= max_queries:
                    break

    if not primary_queries:
        primary_queries = [""]

    exact_filters: List[Dict[str, Any]] = []
    for cve_id in query_signals.get("cve_ids", []):
        exact_filters.append({"cve_id": cve_id})
    for mitre_id in query_signals.get("mitre_ids", []):
        exact_filters.append({"mitre_attack_id": mitre_id})
    for ip_value in query_signals.get("ip_addresses", []):
        exact_filters.append({"ioc_value": ip_value})

    def build_candidate_map(queries: List[str], relaxed: bool = False) -> Dict[str, Dict[str, Any]]:
        fetch_size = max(limit * 5, 25) if relaxed else max(limit * 3, 15)
        candidate_map: Dict[str, Dict[str, Any]] = {}

        def upsert_candidate(
            item: Dict[str, Any],
            force_exact: bool = False,
        ) -> None:
            record_id = str(item.get("record_id") or "").strip()
            metadata = {
                "_id": item.get("_id"),
                "db_type": item.get("db_type"),
                "risk_level": item.get("risk_level"),
                "source": item.get("source"),
                "source_dataset": item.get("source_dataset"),
                "source_url": item.get("source_url"),
                "fetched_at": item.get("fetched_at"),
                "confidence": item.get("confidence"),
                "verified": bool(item.get("verified", False)),
                "cve_id": item.get("cve_id"),
                "ioc_value": item.get("ioc_value"),
                "mitre_attack_id": item.get("mitre_attack_id") or [],
                "tags": item.get("tags") or [],
                "raw_content_hash": item.get("raw_content_hash"),
                "record_file": item.get("record_file"),
                "record_line": item.get("record_line"),
            }
            content = (item.get("search_content") or "").strip()
            if not content:
                return

            key = str(
                metadata.get("raw_content_hash")
                or metadata.get("_id")
                or record_id
                or content
            )
            candidate = candidate_map.setdefault(
                key,
                {
                    "content": content,
                    "metadata": metadata,
                    "vector_score": 0.0,
                    "keyword_score": 0.0,
                    "channels": set(),
                },
            )

            if force_exact:
                candidate["vector_score"] = max(float(candidate["vector_score"]), 1.0)
                candidate["keyword_score"] = max(float(candidate["keyword_score"]), 1.0)
                candidate["channels"].add("exact_metadata")
                return

            keyword_score = log_system._score_keyword_match(
                candidate["content"],
                candidate["metadata"],
                query_terms,
                query_signals.get("exact_terms", []),
            )
            candidate["keyword_score"] = max(float(candidate["keyword_score"]), float(keyword_score))
            if keyword_score > 0:
                candidate["channels"].add("keyword")

        for filter_item in exact_filters:
            payload = list_query_records(
                query="",
                page=1,
                page_size=fetch_size,
                filters=filter_item,
                start_time="",
                end_time="",
                sort_by="fetched_at",
                sort_order="desc",
                include_facets=False,
                truncate_summary=False,
            )
            for result_item in payload.get("items") or []:
                upsert_candidate(result_item, force_exact=True)

        for query_text in queries:
            payload = list_query_records(
                query=query_text,
                page=1,
                page_size=fetch_size,
                filters={},
                start_time="",
                end_time="",
                sort_by="fetched_at",
                sort_order="desc",
                include_facets=False,
                truncate_summary=False,
            )
            for result_item in payload.get("items") or []:
                upsert_candidate(result_item, force_exact=False)

        return candidate_map

    primary_candidates = build_candidate_map(primary_queries, relaxed=False)
    ranked_items = log_system._rank_candidates(primary_candidates, query_signals)

    best_score = ranked_items[0]["score"] if ranked_items else 0.0
    if enable_relaxed_pass and (not ranked_items or best_score < 0.35):
        relaxed_queries = list(primary_queries[:max_queries])
        if "" not in relaxed_queries and len(relaxed_queries) < max_queries:
            relaxed_queries.append("")
        relaxed_candidates = build_candidate_map(relaxed_queries, relaxed=True)
        relaxed_ranked_items = log_system._rank_candidates(relaxed_candidates, query_signals)
        relaxed_best = relaxed_ranked_items[0]["score"] if relaxed_ranked_items else 0.0
        if relaxed_ranked_items and (
            not ranked_items
            or relaxed_best > best_score
            or len(relaxed_ranked_items) > len(ranked_items)
        ):
            ranked_items = relaxed_ranked_items

    grouped_items = log_system._group_retrieval_results(ranked_items)
    for item in grouped_items:
        raw_source = str(item.get("source") or "")
        item["source"] = (
            f"remote_{raw_source}" if raw_source else "remote_keyword"
        )
    return grouped_items[:limit]


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

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    payload = {
        "query": query,
        "summary": True,
        "count": max_results,
        "freshness": "noLimit",
    }

    timeout_seconds = max(
        int(getattr(settings, "WEB_SEARCH_TIMEOUT_SECONDS", 15) or 15),
        1,
    )

    try:
        response = requests.post(
            url,
            headers=headers,
            json=payload,
            timeout=timeout_seconds,
        )
        response.raise_for_status()
        response_data = response.json()
    except requests.RequestException as exc:
        logger.warning(
            "联网搜索请求失败（query=%s, timeout=%ss）: %s",
            query,
            timeout_seconds,
            exc,
        )
        return []

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
    dynamic_system_prompt = (
        f"{SRE_SYSTEM_PROMPT}\n\n[系统环境信息]\n当前系统时间：{current_time}"
    )

    log_item_max_chars = max(
        int(getattr(settings, "RAG_LOG_ITEM_MAX_CHARS", 320) or 320),
        80,
    )
    web_item_max_chars = max(
        int(getattr(settings, "RAG_WEB_ITEM_MAX_CHARS", 320) or 320),
        80,
    )
    evidence_max_items = max(
        int(getattr(settings, "RAG_EVIDENCE_MAX_ITEMS", 1) or 1),
        0,
    )

    def _deserialize_metadata_list(raw_value: Any) -> List[str]:
        if raw_value is None:
            return []
        if isinstance(raw_value, list):
            return [str(item).strip() for item in raw_value if str(item).strip()]
        if isinstance(raw_value, str):
            return [
                item.strip()
                for item in raw_value.replace(";", ",").split(",")
                if item.strip()
            ]
        return []

    def _truncate_text(value: Any, max_len: int) -> str:
        text = str(value or "").strip()
        if len(text) <= max_len:
            return text
        return f"{text[:max_len]}..."

    def _normalize_metadata(metadata: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "_id": metadata.get("_id"),
            "db_type": metadata.get("db_type"),
            "risk_level": metadata.get("risk_level"),
            "cve_id": metadata.get("cve_id"),
            "ioc_value": metadata.get("ioc_value"),
            "source": metadata.get("source"),
            "confidence": metadata.get("confidence"),
            "raw_content_hash": metadata.get("raw_content_hash"),
            "source_dataset": metadata.get("source_dataset"),
            "source_priority": metadata.get("source_priority"),
            "verified": bool(metadata.get("verified", False)),
            "record_file": metadata.get("record_file"),
            "record_line": metadata.get("record_line"),
            "mitre_attack_id": _deserialize_metadata_list(
                metadata.get("mitre_attack_id")
            ),
            "tags": _deserialize_metadata_list(metadata.get("tags")),
        }

    def _normalize_log_item(item: Dict[str, Any]) -> Dict[str, Any]:
        metadata = item.get("metadata", {}) or {}
        evidence = item.get("evidence", {}) or {}
        evidence_chain = item.get("evidence_chain", []) or []

        compact = {
            "group_type": item.get("group_type"),
            "score": item.get("score", 0.0),
            "source": item.get("source", "unknown"),
            "content": _truncate_text(item.get("content", ""), log_item_max_chars),
            "evidence": {
                "db_type": evidence.get("db_type") or metadata.get("db_type"),
                "risk_level": evidence.get("risk_level") or metadata.get("risk_level"),
                "source": evidence.get("source") or metadata.get("source"),
                "confidence": evidence.get("confidence") or metadata.get("confidence"),
                "cve_id": metadata.get("cve_id"),
                "ioc_value": metadata.get("ioc_value"),
                "tags": _deserialize_metadata_list(metadata.get("tags")),
                "mitre_attack_id": _deserialize_metadata_list(metadata.get("mitre_attack_id")),
            },
            "member_count": item.get("member_count", 1),
        }

        if evidence_max_items > 0:
            compact["evidence_chain"] = [
                {
                    "content": _truncate_text(member.get("content", ""), 220),
                    "score": member.get("score", 0.0),
                    "source": member.get("source", "unknown"),
                }
                for member in evidence_chain[:evidence_max_items]
            ]

        return compact

    def _normalize_web_item(item: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "content": _truncate_text(item.get("content", ""), web_item_max_chars),
            "source": item.get("source", "N/A"),
        }

    def _format_structured_payload(
        items: List[Dict[str, Any]], payload_type: str
    ) -> str:
        payload = {
            "type": payload_type,
            "count": len(items),
            "items": items,
        }
        if not items:
            payload["note"] = "未检索到相关内容"
        return json.dumps(payload, ensure_ascii=False, indent=2)

    messages: list[dict[str, str]] = [
        {"role": "system", "content": dynamic_system_prompt}
    ]

    if conversation_history:
        for msg in conversation_history:
            role = (msg.get("role") or "").strip().lower()
            content = (msg.get("content") or "").strip()
            if not content:
                continue
            if role in {"user", "assistant", "system"}:
                messages.append({"role": role, "content": content})

    context_blocks: List[str] = []

    structured_log_results = [_normalize_log_item(item) for item in log_results]
    structured_web_results = [_normalize_web_item(item) for item in web_results]

    log_context_payload = _format_structured_payload(
        structured_log_results, "log_evidence_chain"
    )
    web_context_payload = _format_structured_payload(
        structured_web_results, "web_context"
    )

    context_blocks.append(log_context_payload)
    context_blocks.append(web_context_payload)

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
    messages = _build_openai_messages(
        prompt, conversation_history, log_results, web_results
    )

    prompt_size_chars = sum(len(str(msg.get("content", ""))) for msg in messages)
    logger.info(
        "OpenAI 兼容请求上下文大小: messages=%s, chars=%s",
        len(messages),
        prompt_size_chars,
    )

    logger.info(
        f"使用 OpenAI 兼容接口调用 provider={provider}, model={model_name}, base_url={base_url}"
    )

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


def _normalize_messages_for_openai(
    messages: List[BaseMessage] | List[Dict[str, str]],
) -> List[Dict[str, str]]:
    if messages and isinstance(messages[0], BaseMessage):
        normalized_messages: List[Dict[str, str]] = []
        for message in messages:  # type: ignore[assignment]
            role = getattr(message, "type", None) or getattr(message, "role", None) or "user"
            if role == "human":
                role = "user"
            elif role == "ai":
                role = "assistant"
            content = getattr(message, "content", "")
            normalized_messages.append({"role": role, "content": str(content)})
        return normalized_messages

    return messages  # type: ignore[return-value]


def _resolve_remote_fallback_model_name(model_name: Optional[str]) -> str:
    normalized_model = (model_name or "").strip()
    candidate = resolve_model_name("siliconflow", normalized_model or None)

    supported_remote_models = set(SILICONFLOW_MODEL_ALIASES.values()) | {
        PROVIDER_DEFAULT_MODELS["siliconflow"],
    }
    if candidate in supported_remote_models or "/" in candidate:
        return candidate

    return PROVIDER_DEFAULT_MODELS["siliconflow"]


def _stream_fallback_notice(message: str) -> Iterable[Dict[str, Any]]:
    notice = (message or "").strip()
    if notice:
        yield {
            "type": "notice",
            "scope": "llm_fallback",
            "message": notice,
        }


def _stream_remote_fallback_from_messages(
    messages: List[BaseMessage] | List[Dict[str, str]],
    model_name: Optional[str],
    provider_api_key: Optional[str],
    notice_message: str,
) -> Iterable[str]:
    fallback_provider = "siliconflow"
    fallback_model = _resolve_remote_fallback_model_name(model_name)
    yield from _stream_fallback_notice(notice_message)
    fallback_key = resolve_provider_api_key(fallback_provider, None)
    if not fallback_key and provider_api_key and provider_api_key.strip():
        fallback_key = provider_api_key.strip()
    if not fallback_key:
        yield f"错误：{fallback_provider} API Key 为空，请在设置中填写后重试。"
        return

    normalized_messages = _normalize_messages_for_openai(messages)
    base_url = resolve_provider_base_url(fallback_provider)
    client = OpenAI(api_key=fallback_key, base_url=base_url)
    request_kwargs = {
        "model": fallback_model,
        "messages": normalized_messages,
        "stream": True,
    }

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
        _raise_openai_compatible_error(fallback_provider, fallback_model, e)


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

        oa_messages = _normalize_messages_for_openai(messages)

        base_url = resolve_provider_base_url(provider_name)
        client = OpenAI(api_key=api_key, base_url=base_url)
        request_kwargs = {
            "model": resolved_model_name,
            "messages": oa_messages,
            "stream": True,
        }
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
        logger.warning("Ollama 初始化失败，自动降级到 siliconflow 远程调用。")
        yield from _stream_remote_fallback_from_messages(
            messages,
            model_name,
            provider_api_key,
            "本地调用失败，切换至远程模式",
        )
        return

    if not messages or not isinstance(messages[0], BaseMessage):
        logger.warning("Ollama 输入消息格式不兼容，自动降级到 siliconflow 远程调用。")
        yield from _stream_remote_fallback_from_messages(
            messages,
            model_name,
            provider_api_key,
            "本地调用失败，切换至远程模式",
        )
        return

    try:
        llm = log_system._get_or_create_llm(resolved_model_name)
        for chunk in llm.stream(messages):  # type: ignore[arg-type]
            yield chunk
        return
    except Exception as exc:
        logger.warning("Ollama 调用失败，自动降级到 siliconflow 远程调用: %s", exc)

    yield from _stream_remote_fallback_from_messages(
        messages,
        model_name,
        provider_api_key,
        "本地调用失败，切换至远程模式",
    )


def model_api_call(
    prompt: str,
    conversation_history: List[Dict] = None,
    use_db_search: bool = True,
    use_web_search: bool = False,
    model_name: Optional[str] = None,
    provider: Optional[str] = "siliconflow",
    embedding_mode: Optional[str] = "siliconflow",
    embedding_model: Optional[str] = None,
    provider_api_key: Optional[str] = None,
    web_search_api_key: Optional[str] = None,
):
    """
    调用模型 API（流式响应）。
    """

    provider_name = normalize_provider(provider)
    resolved_model_name = resolve_model_name(provider_name, model_name)
    resolved_embedding_mode = normalize_embedding_mode(embedding_mode)
    resolved_embedding_model = resolve_embedding_model(
        resolved_embedding_mode, embedding_model
    )

    logger.info(
        "模型调用参数: provider=%s, model=%s, embedding_mode=%s, embedding_model=%s",
        provider_name,
        resolved_model_name,
        resolved_embedding_mode,
        resolved_embedding_model,
    )

    log_results: List[Dict] = []
    web_results: List[Dict] = []
    web_future = None
    web_executor = None

    try:
        # 联网搜索网络耗时通常较长；当同时启用 DB+Web 时并发发起以降低总等待。
        if use_web_search and use_db_search:
            web_max_results = max(
                int(getattr(settings, "WEB_SEARCH_MAX_RESULTS", 5) or 5),
                1,
            )
            web_executor = ThreadPoolExecutor(max_workers=1)
            web_future = web_executor.submit(
                web_search,
                prompt,
                web_max_results,
                web_search_api_key,
            )

        if use_db_search:
            db_retrieval_started_at = time.perf_counter()
            if log_system is None:
                logger.warning("log_system 未初始化，跳过数据库日志检索。")
            else:
                logger.info(f"执行数据库日志检索: {prompt}")
                retrieval_top_k = max(
                    int(getattr(settings, "DB_RETRIEVAL_TOP_K", 3) or 3),
                    1,
                )
                if resolved_embedding_mode == "siliconflow":
                    retrieval_top_k = max(retrieval_top_k, 3)

                retrieval_cache_ttl = max(
                    int(getattr(settings, "DB_RETRIEVAL_CACHE_SECONDS", 300) or 300),
                    0,
                )
                retrieval_cache_key = (
                    f"db_retrieval:{resolved_embedding_mode}:{retrieval_top_k}:"
                    f"{hashlib.sha256(prompt.strip().lower().encode('utf-8')).hexdigest()}"
                )

                if retrieval_cache_ttl > 0:
                    cached_results = cache.get(retrieval_cache_key)
                    if isinstance(cached_results, list):
                        log_results = cached_results
                        logger.info("命中数据库检索缓存: top_k=%s", retrieval_top_k)

                if not log_results:
                    retrieval_timeout = max(
                        int(getattr(settings, "DB_RETRIEVAL_TIMEOUT_SECONDS", 4) or 4),
                        1,
                    )
                    db_executor = ThreadPoolExecutor(max_workers=1)
                    try:
                        if resolved_embedding_mode == "siliconflow":
                            logger.info("当前为远程 embedding 模式，使用关键词检索路径。")
                            db_future = db_executor.submit(
                                retrieve_logs_remote_mode,
                                prompt,
                                retrieval_top_k,
                            )
                        else:
                            db_future = db_executor.submit(
                                log_system.retrieve_logs,
                                prompt,
                                retrieval_top_k,
                            )

                        try:
                            log_results = db_future.result(timeout=retrieval_timeout)
                        except FuturesTimeoutError:
                            log_results = []
                            logger.warning(
                                "数据库日志检索超时（%ss），跳过检索直连模型。",
                                retrieval_timeout,
                            )
                    finally:
                        db_executor.shutdown(wait=False)

                    if retrieval_cache_ttl > 0 and log_results:
                        cache.set(retrieval_cache_key, log_results, retrieval_cache_ttl)

                logger.info(f"针对查询 '{prompt}' 的 Top-K 检索结果：")
                for index, result in enumerate(log_results, start=1):
                    metadata = result.get("metadata", {}) or {}
                    evidence = result.get("evidence", {}) or {}
                    db_type = (
                        metadata.get("db_type") or evidence.get("db_type") or "unknown"
                    )
                    risk_level = (
                        metadata.get("risk_level")
                        or evidence.get("risk_level")
                        or "unknown"
                    )
                    confidence = (
                        metadata.get("confidence")
                        or evidence.get("confidence")
                        or "unknown"
                    )
                    source = (
                        metadata.get("source") or evidence.get("source") or "unknown"
                    )
                    hash_value = (
                        metadata.get("raw_content_hash")
                        or evidence.get("raw_content_hash")
                        or "unknown"
                    )
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
            logger.info(
                "数据库日志检索耗时: %.2fs",
                time.perf_counter() - db_retrieval_started_at,
            )

        if web_future is not None:
            logger.info(f"等待联网搜索结果: {prompt}")
            join_timeout = max(
                int(getattr(settings, "WEB_SEARCH_JOIN_TIMEOUT_SECONDS", 3) or 3),
                0,
            )
            if join_timeout <= 0:
                if web_future.done():
                    web_results = web_future.result()
                else:
                    logger.warning("联网搜索未完成，跳过并直接进入模型生成。")
            else:
                try:
                    web_results = web_future.result(timeout=join_timeout)
                except FuturesTimeoutError:
                    logger.warning(
                        "联网搜索等待超时（%ss），跳过并直接进入模型生成。",
                        join_timeout,
                    )
        elif use_web_search:
            logger.info(f"执行联网搜索: {prompt}")
            web_max_results = max(
                int(getattr(settings, "WEB_SEARCH_MAX_RESULTS", 5) or 5),
                1,
            )
            web_results = web_search(
                prompt,
                max_results=web_max_results,
                web_search_api_key=web_search_api_key,
            )

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

        fallback_model = _resolve_remote_fallback_model_name(model_name)
        fallback_key = resolve_provider_api_key("siliconflow", None)
        if not fallback_key and provider_api_key and provider_api_key.strip():
            fallback_key = provider_api_key.strip()

        if log_system is None:
            logger.warning("Log system 未初始化，自动降级到 siliconflow 远程调用。")
            if not fallback_key:
                yield "错误：siliconflow API Key 为空，请在设置中填写后重试。"
                return
            yield from _stream_fallback_notice("本地调用失败，切换至远程模式")
            for chunk in stream_openai_compatible_response(
                provider="siliconflow",
                prompt=prompt,
                conversation_history=conversation_history,
                model_name=fallback_model,
                provider_api_key=fallback_key,
                log_results=log_results,
                web_results=web_results,
            ):
                yield chunk
            return

        combined_context = {"log_context": log_results, "web_context": web_results}

        try:
            for chunk in log_system.generate_response(
                prompt,
                context=combined_context,
                history=conversation_history,
                model_name=resolved_model_name,
            ):
                yield chunk
            return
        except Exception as exc:
            logger.warning("Ollama 调用失败，自动降级到 siliconflow 远程调用: %s", exc)

        if not fallback_key:
            yield "错误：siliconflow API Key 为空，请在设置中填写后重试。"
            return

        yield from _stream_fallback_notice("本地调用失败，切换至远程模式")

        for chunk in stream_openai_compatible_response(
            provider="siliconflow",
            prompt=prompt,
            conversation_history=conversation_history,
            model_name=fallback_model,
            provider_api_key=fallback_key,
            log_results=log_results,
            web_results=web_results,
        ):
            yield chunk

    except ProviderHttpError as e:
        logger.error("model_api_call provider 调用失败: %s", e.detail)
        yield {
            "type": "error",
            "chunk": e.detail.get("message") or str(e),
            "error_detail": e.detail,
        }
    except Exception as e:
        logger.error(f"model_api_call 流式处理失败: {e}")
        yield {"type": "error", "chunk": f"API 调用失败: {e}"}
    finally:
        if web_executor is not None:
            web_executor.shutdown(wait=False)


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
            rate_limit = RateLimit.objects.select_related("api_key").get(
                api_key__key=key_str
            )

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


def rename_conversation_session(
    user: APIKey, old_session_id: str, new_session_id: str
) -> tuple[str, str]:
    """
    将当前用户下某条 ConversationSession 的 session_id 更新为新名称。
    若旧会话在数据库中不存在（尚未与后端同步），则不做数据库变更，由前端仅迁移本地列表。
    """
    old_id = (old_session_id or "").strip() or "默认对话"
    new_id = (new_session_id or "").strip() or "默认对话"

    if old_id == new_id:
        return old_id, new_id

    if len(new_id) > 100:
        raise ValueError("新会话名称长度不能超过 100 个字符")

    with transaction.atomic():
        row = (
            ConversationSession.objects.select_for_update()
            .filter(user=user, session_id=old_id)
            .first()
        )
        if not row:
            return old_id, new_id

        conflict = (
            ConversationSession.objects.filter(user=user, session_id=new_id)
            .exclude(pk=row.pk)
            .exists()
        )
        if conflict:
            raise ValueError("该会话名称已存在，请使用其他名称")

        row.session_id = new_id
        row.save()

    logger.info("会话已重命名：%s -> %s（用户：%s）", old_id, new_id, user.user)
    return old_id, new_id


def get_or_create_session(session_id: str, user: APIKey) -> ConversationSession:
    """
    获取或创建用户的专属会话：
    - 若用户+session_id已存在 -> 加载旧会话（保留历史）
    - 若不存在 -> 创建新会话（空历史）
    """
    session, created = ConversationSession.objects.defer("context").get_or_create(
        session_id=session_id,
        user=user,
        defaults={"context": ""},
    )
    logger.info(
        f"会话 {session_id}（用户：{user.user}）{'创建新会话' if created else '加载旧会话'}"
    )
    return session


def list_user_sessions(user: APIKey) -> List[str]:
    """按最近更新时间返回当前用户会话列表。"""
    session_ids = list(
        ConversationSession.objects.filter(user=user)
        .order_by("-updated_at", "-id")
        .values_list("session_id", flat=True)
    )
    return session_ids or ["默认对话"]


def delete_conversation_session(user: APIKey, session_id: str) -> tuple[str, bool]:
    """删除当前用户下指定会话，返回(标准化会话ID, 是否删除成功)。"""
    normalized_session_id = (session_id or "").strip() or "默认对话"
    deleted_count, _ = ConversationSession.objects.filter(
        user=user,
        session_id=normalized_session_id,
    ).delete()
    return normalized_session_id, deleted_count > 0


def get_cached_reply(prompt: str, session_id: str, user: APIKey) -> str | None:
    """缓存键包含 session_id 和 user，避免跨会话冲突"""
    cache_key = f"reply:{user.user}:{session_id}:{hash(prompt)}"
    return cache.get(cache_key)


def set_cached_reply(
    prompt: str, reply: str, session_id: str, user: APIKey, timeout=3600
):
    cache_key = f"reply:{user.user}:{session_id}:{hash(prompt)}"
    cache.set(cache_key, reply, timeout)


def generate_cache_key(original_key: str) -> str:
    """生成安全的缓存键"""
    hash_obj = hashlib.sha256(original_key.encode("utf-8"))
    return hash_obj.hexdigest()
