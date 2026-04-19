from __future__ import annotations

import json
import logging
from typing import Iterable

from .base import AgentRunInput, BaseAgent
from .prompts import build_vector_agent_messages
from .types import LlmConfig
from .. import services


logger = logging.getLogger(__name__)


class VectorAgent(BaseAgent):
    agent_id = "rag"

    def run_stream(self, run_input: AgentRunInput, llm: LlmConfig) -> Iterable[str]:
        retrieved = []
        if services.log_system is not None:
            embedding_mode = services.normalize_embedding_mode(llm.embedding_mode)
            if embedding_mode == "siliconflow":
                logger.info("[RAG] 远程 embedding 模式，使用远程检索路径")
                retrieved = services.retrieve_logs_remote_mode(run_input.query, top_k=5)
            else:
                retrieved = services.log_system.retrieve_logs(run_input.query, top_k=5)

        if retrieved:
            logger.info(
                "[RAG] 内部检索命中结果 query=%s count=%s",
                run_input.query,
                len(retrieved),
            )
            for index, item in enumerate(retrieved, 1):
                logger.info(
                    "[RAG] hit=%s score=%.4f source=%s content=%s",
                    index,
                    float(item.get("score", 0.0)),
                    item.get("source", "unknown"),
                    (item.get("content", "") or "").strip(),
                )
        else:
            logger.info("[RAG] 内部检索命中结果 query=%s count=0 未命中内部数据库证据", run_input.query)

        if retrieved:
            snippets = json.dumps(
                {
                    "query": run_input.query,
                    "retrieved_count": len(retrieved),
                    "items": [
                        {
                            "score": round(float(item.get("score", 0.0)), 4),
                            "source": item.get("source", "unknown"),
                            "content": item.get("content", ""),
                            "group_key": item.get("group_key"),
                            "group_type": item.get("group_type"),
                            "member_count": item.get("member_count", 1),
                            "metadata": item.get("metadata", {}) or {},
                            "evidence": item.get("evidence", {}) or {},
                        }
                        for item in retrieved
                    ],
                },
                ensure_ascii=False,
                indent=2,
            )
        else:
            snippets = json.dumps(
                {
                    "query": run_input.query,
                    "retrieved_count": 0,
                    "items": [],
                    "note": "未命中内部数据库证据",
                },
                ensure_ascii=False,
                indent=2,
            )

        messages = build_vector_agent_messages(run_input.query, snippets, history=run_input.history)
        for chunk in services.stream_llm_from_messages(
            provider=llm.provider,
            messages=messages,
            model_name=llm.model,
            provider_api_key=llm.provider_api_key,
        ):
            yield chunk

