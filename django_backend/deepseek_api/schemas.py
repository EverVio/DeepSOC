from ninja import Schema
from typing import Optional, List, Dict


class LoginIn(Schema):
    username: str
    password: str


class LoginOut(Schema):
    api_key: str
    expiry: int


class ChatIn(Schema):
    session_id: str = "默认对话"
    user_input: str
    context: Optional[List[Dict[str, str]]] = None
    use_db_search: bool = True  # 默认开启数据库
    use_web_search: bool = False  # 默认关闭联网
    model_name: Optional[str] = None  # 前端选择的模型
    provider: Optional[str] = "ollama"  # 模型提供商：ollama/openai/deepseek/minimax/siliconflow
    provider_api_key: Optional[str] = None  # OpenAI 兼容提供商 API Key
    web_search_api_key: Optional[str] = None  # 联网搜索 API Key（博查）
    mode: Optional[str] = None  # single / multi_agent
    agent_configs: Optional[Dict[str, Dict[str, Optional[str]]]] = None
    # agent_configs 示例：
    # {
    #   "rag": {"provider":"ollama","model":"deepseek-r1:7b","provider_api_key":null},
    #   "web": {"provider":"deepseek","model":"deepseek-chat","provider_api_key":"..."},
    #   "synthesis": {"provider":"ollama","model":"deepseek-r1:7b","provider_api_key":null}
    # }


class ChatOut(Schema):
    content: str  # 最终回复
    think_process: Optional[str] = None  # 思考过程
    duration: Optional[float] = None  # 耗时


class HistoryOut(Schema):
    history: str


class SessionRenameIn(Schema):
    old_session_id: str = "默认对话"
    new_session_id: str = "默认对话"


class SessionListOut(Schema):
    sessions: List[str]


class ErrorResponse(Schema):
    error: str
