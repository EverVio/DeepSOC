from __future__ import annotations

import json
import re
from typing import List, Optional

from langchain.prompts import ChatPromptTemplate, HumanMessagePromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage


def _sanitize_retrieved_content(text: str) -> str:
    """
    对检索到的内容进行消毒处理，防止 prompt injection。
    - 转义可能导致 LLM 混淆的特殊标记
    - 移除潜在的指令覆盖尝试
    """
    if not text:
        return text

    # 移除常见的 prompt injection 模式
    injection_patterns = [
        r"(?i)ignore\s+(all\s+)?previous\s+instructions",
        r"(?i)disregard\s+(all\s+)?prior\s+(instructions|context)",
        r"(?i)you\s+are\s+now\s+",
        r"(?i)new\s+instructions?\s*:",
        r"(?i)system\s*prompt\s*:",
        r"(?i)override\s+(all\s+)?instructions",
        r"(?i)forget\s+(everything|all)",
    ]

    sanitized = text
    for pattern in injection_patterns:
        sanitized = re.sub(pattern, "[FILTERED]", sanitized)

    # 转义 XML/HTML 标签，防止与 LLM 内部处理冲突
    sanitized = sanitized.replace("<system>", "&lt;system&gt;")
    sanitized = sanitized.replace("</system>", "&lt;/system&gt;")
    sanitized = sanitized.replace("<user>", "&lt;user&gt;")
    sanitized = sanitized.replace("</user>", "&lt;/user&gt;")
    sanitized = sanitized.replace("<assistant>", "&lt;assistant&gt;")
    sanitized = sanitized.replace("</assistant>", "&lt;/assistant&gt;")

    return sanitized


RAG_OUTPUT_SCHEMA = {
    "agent": "rag",
    "scope": "internal_evidence_only",
    "query": "string",
    "found": [
        {
            "indicator": "string",
            "evidence": "string",
            "source": "string",
            "risk_level": "Critical|High|Medium|Low|Info|Unknown",
            "confidence": 0.0,
        }
    ],
    "coverage": "high|medium|low",
    "confidence": 0.0,
    "cannot_decide_reason": "string",
}


WEB_OUTPUT_SCHEMA = {
    "agent": "web",
    "scope": "external_intel_only",
    "query": "string",
    "found": [
        {
            "indicator": "string",
            "intel": "string",
            "source": "string",
            "published_at": "string",
            "confidence": 0.0,
        }
    ],
    "trend": "active|emerging|unclear",
    "confidence": 0.0,
    "cannot_decide_reason": "string",
}


def _format_history(history: Optional[List[dict]]) -> List[BaseMessage]:
    """格式化对话历史，白名单校验角色，防止 prompt injection。"""
    if not history:
        return []
    allowed_roles = {"user", "assistant"}
    formatted: List[BaseMessage] = []
    for msg in history:
        role = (msg.get("role") or "").strip().lower()
        content = (msg.get("content") or "").strip()
        if not content:
            continue
        # 仅允许 user 和 assistant 角色，忽略其他（如 system）
        if role not in allowed_roles:
            continue
        formatted.append(HumanMessage(content=content) if role == "user" else AIMessage(content=content))
    return formatted


def _render_schema(schema: dict) -> str:
    return json.dumps(schema, ensure_ascii=False, indent=2)


def build_vector_agent_messages(query: str, retrieved_snippets: str, history: Optional[List[dict]] = None) -> List[BaseMessage]:
    system = SystemMessagePromptTemplate.from_template(
        "你是 DeepSOC——基于多智能体协同与RAG架构的智能安全运营系统 的 RAG Agent。"
        "你只允许执行内部证据提取，不允许做最终结论、不允许给处置定级、不允许输出行动建议。"
        "你只能使用给定的内部数据库检索上下文，不得补充外部信息。"
    )
    user = HumanMessagePromptTemplate.from_template(
        "### 用户查询\n{query}\n\n"
        "### 内部数据库检索结果（JSON）\n{snippets}\n\n"
        "### 输出约束（必须全部满足）\n"
        "1. 只能输出一个 JSON 对象，不能输出 Markdown、解释文字或代码块标记。\n"
        "2. `agent` 必须为 `rag`。\n"
        "3. `found` 中仅保留可追溯的内部证据条目；若无命中则输出空数组。\n"
        "4. `confidence` 范围为 0 到 1。\n"
        "5. 严禁输出最终结论（例如“确定为攻击”）。\n\n"
        "### JSON Schema\n{schema}"
    )
    prompt = ChatPromptTemplate.from_messages([system, MessagesPlaceholder("chat_history"), user])
    return prompt.format_prompt(
        chat_history=_format_history(history),
        query=query,
        snippets=_sanitize_retrieved_content(retrieved_snippets),
        schema=_render_schema(RAG_OUTPUT_SCHEMA),
    ).to_messages()


def build_search_agent_messages(query: str, web_snippets: str, history: Optional[List[dict]] = None) -> List[BaseMessage]:
    system_content = (
        "你是 DeepSOC——基于多智能体协同与RAG架构的智能安全运营系统 的 Web Agent。"
        "你只允许执行外部情报提取，不允许做最终结论、不允许输出处置建议。"
        "你只能使用给定的联网检索结果，不得复述内部数据库判断。"
    )
    user_content = (
        f"### 用户查询\n{query}\n\n"
        "### 联网检索结果（JSON）\n"
        f"{_sanitize_retrieved_content(web_snippets)}\n\n"
        "### 输出约束（必须全部满足）\n"
        "1. 只能输出一个 JSON 对象，不能输出 Markdown、解释文字或代码块标记。\n"
        "2. `agent` 必须为 `web`。\n"
        "3. `found` 中仅保留可引用来源的外部情报条目；若无命中则输出空数组。\n"
        "4. `confidence` 范围为 0 到 1。\n"
        "5. 严禁输出最终结论（例如“确认入侵”）。\n\n"
        "### JSON Schema\n"
        f"{_render_schema(WEB_OUTPUT_SCHEMA)}"
    )

    messages: List[BaseMessage] = [SystemMessage(content=system_content)]
    messages.extend(_format_history(history))
    messages.append(HumanMessage(content=user_content))
    return messages


def build_synthesis_agent_messages(
    query: str,
    rag_payload_json: str,
    web_payload_json: str,
    history: Optional[List[dict]] = None,
) -> List[BaseMessage]:
    system = SystemMessagePromptTemplate.from_template(
        "你是 DeepSOC——基于多智能体协同与RAG架构的智能安全运营系统 的 Synthesis Agent。"
        "你必须消费两个前置 Agent 的 JSON 报文，并做冲突解决与最终定性。"
        "如果输入存在分歧，明确写出权衡规则与证据优先级。"
    )
    user = HumanMessagePromptTemplate.from_template(
        "### 原始安全诉求\n{query}\n\n"
        "### RAG Agent JSON\n{rag_json}\n\n"
        "### Web Agent JSON\n{web_json}\n\n"
        "### 输出要求\n"
        "1. 最终结论与风险定级（Critical/High/Medium/Low/Info）。\n"
        "2. 冲突解决过程（若无冲突写“无冲突”）。\n"
        "3. 紧急处置清单（按优先级编号）。\n"
        "4. 中长期加固建议（不超过 5 条）。\n"
        "5. 引用证据时注明来源来自 RAG 还是 Web。"
    )
    prompt = ChatPromptTemplate.from_messages([system, MessagesPlaceholder("chat_history"), user])
    return prompt.format_prompt(
        chat_history=_format_history(history),
        query=query,
        rag_json=rag_payload_json,
        web_json=web_payload_json,
    ).to_messages()