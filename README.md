# DeepSOC 智能安全运营中心系统

DeepSOC 是一个面向网络安全日志分析场景的 SOC（Security Operations Center）原型系统，采用前后端分离架构：

- 后端：Django + django-ninja + ChromaDB + Ollama/OpenAI-compatible LLM
- 前端：Vue 3 + Pinia + Naive UI + ECharts + Three.js

当前版本已经从“演示壳”升级为可运行的最小可用 SOC 工作台，前端围绕登录、仪表盘、分析终端和系统设置四个主场景完成了较完整的交互链路。

---

## 项目现状说明

本 README 只描述仓库中已经落地的能力，避免把规划写成事实。

- 已实现：前后端 API 联通、SSE 流式对话、会话持久化、文件附件上传、模型/Provider 切换、仪表盘统计和拓扑可视化、多智能体编排。
- 待完善：五大安全数据库样本量仍偏小，仪表盘更多是聚合统计而非深度推理，Three.js 和背景动画在低性能设备上仍有性能压力。

---

## 已实现能力

### 1. 后端能力

- API Key 登录认证，默认密码为 `secret`。
- 基于 SSE 的流式聊天接口 `/api/chat`。
- 会话上下文持久化、会话历史读取和清空。
- 支持重新生成和编辑后续回答，基于历史回放重建上下文。
- 文件上传解析：支持 `.txt`、`.docx`、`.xlsx`。
- 本地日志检索 + 可选联网检索（DuckDuckGo via `ddgs`）。
- 多 provider 模型路由：`ollama`、`openai`、`deepseek`、`minimax`、`siliconflow`。
- 多智能体编排：`RAG Agent + Web Agent` 并行分析，`Synthesis Agent` 汇总输出。
- OpenAI-compatible 错误结构化透传：provider 返回 4xx/5xx 时，SSE 会携带 `error_detail`，包含 `provider`、`model`、`status_code`、`error_code`、`message`、`request_id` 等字段。
- Dashboard 聚合接口 `/api/dashboard/stats`，直接从 `data/log` 下的 CSV 聚合图表与拓扑数据。

### 2. 检索与模型调用链路

- `TopKLogSystem` 使用 `OllamaEmbeddings + ChromaDB + LlamaIndex` 构建/加载向量库。
- 检索策略为“向量检索 + 简单关键词融合”。
- 默认本地模型是 `deepseek-r1:7b`，默认嵌入模型是 `bge-large:latest`。
- OpenAI-compatible provider 的 API Key 可以通过前端设置页或环境变量注入。

### 3. 前端能力

- 路由结构为登录页、仪表盘、分析终端、系统设置四个主页面，未登录时会被导航守卫拦截到 `/login`。
- 全局布局采用左侧导航 + 顶部状态栏 + 主内容区的 SOC 控制台结构。
- 仪表盘支持全局拓扑图、威胁雷达图、日志流入图、类别分布图和汇总计数，并提供拓扑折叠与全屏查看。
- 分析终端支持会话列表、会话搜索、创建会话、删除会话、清空历史和当前会话切换。
- 聊天输入支持数据库检索、联网检索、多智能体模式切换、附件上传（`.txt`、`.docx`、`.xlsx`）和模型矩阵配置。
- 消息气泡支持流式输出、Markdown 渲染、代码高亮、思考过程折叠、多智能体过程展开、复制、编辑和重新生成。
- 系统设置支持 provider/model 切换、provider API Key、联网搜索 API Key、本地导出会话 HTML 和退出登录。
- 前端状态通过 Pinia 持久化到 localStorage，包含会话、草稿、模型参数和登录态。
- `src/api.js` 统一封装登录、流式聊天、历史记录、清空历史、统计看板和文件上传接口。

---

## 前端页面结构

### 路由与布局

- `/login`：登录页。
- `/dashboard`：安全态势大屏。
- `/chat`：分析终端。
- `/settings`：系统设置。
- `GlobalLayout`：承载全局导航、会话状态和主内容区域。

### 仪表盘

- `Dashboard.vue` 组合 `TopologyScene`、`ThreatRadarChart`、`LogInflowChart` 和 `CategoryDonutChart`。
- 支持拓扑卡片折叠、全屏切换和备用弹窗展示。
- 汇总指标采用数值过渡动画，标题使用文字扰动动效。

### 分析终端

- `ChatPage.vue` 将左侧会话栏和中间聊天终端组合成主工作区。
- `Chat.vue` 负责终端壳层、消息流、错误提示和输入区组织。
- `ChatInput.vue` 负责检索开关、附件上传、多智能体配置和发送载荷构建。
- `ChatMessage.vue` 负责用户消息、模型回复、思考过程、多智能体过程和操作按钮展示。

### 系统设置

- `Settings.vue` 负责 provider/model/API Key 配置。
- 支持按当前会话导出 HTML 格式聊天记录。
- 支持一键退出登录并清理认证状态。

---

## 五大核心安全数据库（MVP）

你新加入的五大核心数据库已经在仓库中落位，并用于当前最小可用场景。

| 数据库 | 当前状态 | 目录 |
|---|---|---|
| 安全案例库 | 已接入，当前为最小样本 | `django_backend/data/log/安全案例库/` |
| 安全处置策略模板库 | 已接入，当前为最小样本 | `django_backend/data/log/安全处置策略模板库/` |
| 常见 Web 攻击模式库 | 已接入，当前为最小样本 | `django_backend/data/log/常见 Web 攻击模式库/` |
| CVE&漏洞情报库 | 已接入标准化样本 | `django_backend/data/log/CVE&漏洞情报库/` |
| IOC 规则样本库 | 已接入基础样本 | `django_backend/data/log/IOC 规则样本库/` |

### 当前边界

- 目前是经典场景的最小覆盖，样本规模还不大。
- 多数目录仅有少量 CSV，主要用于跑通链路与演示。
- 后续需要继续扩充样本量、字段质量和标签体系，提升检索命中与分析可信度。

---

## 多智能体实现说明

### 1. 后端编排架构

- 入口：`/api/chat` 在 `mode=multi_agent` 时进入编排流程。
- 编排器：`Orchestrator` 并发执行 `rag` 和 `web`，并在二者完成后执行 `synthesis`。
- 模型配置：前端可按 agent 传递 `provider`、`model`、`provider_api_key`，后端会逐 agent 合并默认配置。
- 错误透传：OpenAI-compatible provider 失败时，后端会提取结构化错误并透传到 SSE 的 `agent_status(error)` 事件里。

### 2. 前端消费与状态管理

- `src/api.js` 统一解析 SSE，支持 `agent_chunk`、`agent_status`、`content`、`think`、`metadata`、`error`、`done`。
- `chatStore` 为每个 agent 维护 `status`、`content`、`error`、`errorDetail`。
- `ChatMessage` 在多智能体折叠面板中展示 RAG / WEB 输出与错误详情。
- 后端显式发送 `done` 事件，前端在 `done` 或 `synthesis done/error` 时结束 loading。

### 3. SSE 事件约定（多智能体）

- `agent_chunk`: `{"type":"agent_chunk","agent_id":"rag|web|synthesis","content":"..."}`
- `agent_status`: `{"type":"agent_status","agent_id":"...","status":"started|done|error","error":"...","error_detail":{...}}`
- `done`: `{"type":"done"}`

---

## 核心接口

| 接口 | 方法 | 说明 |
|---|---|---|
| `/api/login` | POST | 登录并获取 API Key |
| `/api/chat` | POST | 流式问答接口（SSE） |
| `/api/history` | GET | 获取当前会话历史 |
| `/api/history` | DELETE | 清空当前会话历史 |
| `/api/upload_file` | POST | 上传并解析 `.txt/.docx/.xlsx` |
| `/api/dashboard/stats` | GET | 统计图表与拓扑聚合数据 |

---

## 系统架构（当前实现）

```text
Browser (Vue 3 SOC Console)
  -> Django Ninja API
    -> Session/Auth (SQLite)
    -> TopKLogSystem
      -> Local Vector Store (ChromaDB)
      -> data/log CSV knowledge base
    -> Optional Web Search (ddgs)
    -> LLM Provider Router
      -> Ollama(local)
      -> OpenAI-compatible APIs
```

---

## 技术栈

### 后端

- Django 5.2.7
- django-ninja 1.4.4
- django-cors-headers 4.9.0
- chromadb 1.2.0
- llama-index 0.14.5
- langchain-ollama 0.3.8
- openai 1.109.1
- ddgs 9.7.0

### 前端

- Vue 3.5.18
- Pinia 3.0.3
- Vue Router 4.5.1
- Naive UI 2.44.1
- Axios 1.11.0
- ECharts 6.0.0
- Three.js 0.183.2
- VueUse 14.2.1
- Marked 16.4.1
- Highlight.js 11.11.1
- Vite 7.1.12

---

## 快速开始

### 1. 后端

```bash
cd django_backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

说明：`manage.py` 已将默认端口设为 `8081`，可通过 `DJANGO_PORT` 覆盖。

### 2. 前端

```bash
cd vue_frontend
npm install
npm run dev
```

默认前端地址：`http://localhost:8082`。Vite 会把 `/api` 代理到 `http://localhost:8081`。

构建与预览：

```bash
npm run build
npm run preview
```

### 3. 本地模型准备

```bash
ollama pull deepseek-r1:7b
ollama pull bge-large:latest
```

### 4. 登录

- 用户名：自定义
- 密码：`secret`

---

## 环境变量

如需使用云端 provider，可配置：

- `OPENAI_API_KEY`
- `DEEPSEEK_API_KEY`
- `MINIMAX_API_KEY`
- `SILICONFLOW_API_KEY`

也可以在前端设置页中临时填写 provider API Key 和 Web Search API Key。

---

## 当前目录结构

```text
.
├── django_backend
│   ├── deepseek_api
│   │   ├── api.py
│   │   ├── dashboard_stats.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── services.py
│   │   └── urls.py
│   ├── deepseek_project
│   ├── data/log
│   │   ├── 安全案例库
│   │   ├── 安全处置策略模板库
│   │   ├── 常见 Web 攻击模式库
│   │   ├── CVE&漏洞情报库
│   │   └── IOC 规则样本库
│   ├── topklogsystem.py
│   └── manage.py
└── vue_frontend
    ├── src
    │   ├── layouts/
    │   ├── components/
    │   ├── composables/
    │   ├── stores/
    │   └── views/
    └── vite.config.js
```

---

## 已知问题

- CORS 默认配置仍可能保留旧端口（`8090`），如果跨域失败，需要在 Django 配置里补充当前前端端口。
- 背景粒子连线和 Three.js 拓扑长期动画会占用较高 GPU / CPU。
- 图表语义目前主要基于 CSV 聚合与关键词风险分级（high / medium / low），分析深度有限。
- 多智能体编排已在当前版本落地，下一阶段可以继续引入更复杂的图工作流和可观测链路追踪。

---

## 下一步迭代建议

1. 扩充五大核心数据库样本规模与标注质量。
2. 定义统一安全事件 Schema（IOC / CVE / 节点 / 边 / 证据来源 / 处置优先级）。
3. 将图表和拓扑从聚合统计升级到真实攻击链语义渲染。
4. 在现有多智能体编排基础上引入图式工作流和可视化追踪。
5. 做前端性能治理，例如粒子降采样、动画节流和按需渲染。

---

## 参赛定位总结

当前版本已经具备“可演示、可迭代”的 SOC 原型基础：

- 数据层：五大核心安全数据库已开库，但仍是 MVP 样本。
- 能力层：问答、检索、流式交互、统计可视化已贯通。
- 展示层：SOC 控制台骨架完整，但真实性和流畅度仍需要继续打磨。

这与当前阶段目标一致：先跑通经典场景，再逐步扩充数据与分析深度。

---

## 新版 JSONL 数据集接入与检索质量升级（2026-03）

后端已完成对统一 JSONL Schema 的结构化接入，不再把整条 JSON 原文粗暴拼接入向量。

### 1. 文档加载器（Document Loader）升级

- `TopKLogSystem._process_json` 在读取 `.jsonl` 时，仅使用 `search_content` 作为 `Document.text`。
- 以下字段已写入 `Document.metadata`：`_id`、`db_type`、`risk_level`、`cve_id`、`ioc_value`、`source`、`confidence`、`raw_content_hash`、`mitre_attack_id`、`tags` 等。
- 增加记录位置信息：`record_file`、`record_line`，便于检索证据回溯。

收益：向量空间只承载语义文本，不再被键名、URL、时间戳等噪声污染，召回质量更稳定。

### 2. 检索链路升级（召回 -> 重排 -> 去重 -> 证据返回）

`TopKLogSystem` 新增统一接口：

- `retrieve(query, top_k=..., use_keyword=..., filters=...)`

完整链路：

1. 召回：向量召回 + 关键词召回（支持 CVE 编号、ATT&CK 编号和通用 token）。
2. 重排：综合向量分、关键词命中、`confidence`、`source_priority`、`risk_level` 进行加权排序。
3. 去重：优先使用 `raw_content_hash` 去重，其次 `_id`，最后 `content` 兜底。
4. 返回证据：每条结果均返回 `content + score + metadata + evidence`，便于解释与审计。

同时保留 `retrieve_logs(...)` 作为兼容包装，现已委托到 `retrieve(...)`，不影响现有调用方。

### 3. Dashboard 结构化聚合升级

`deepseek_api/dashboard_stats.py` 已从 CSV 关键词猜测切换为 JSONL 字段聚合：

- Threat Radar：直接聚合 `risk_level`（Critical/High/Medium/Low/Info）。
- Category 分布：直接聚合 `db_type`。
- Topology：以 `db_type` 作为核心节点，以 `tags` 作为次级节点连线。
- 时间线：按 JSONL 文件记录数与 `fetched_at`/文件更新时间汇总。

收益：态势大屏统计结果由结构化情报直接驱动，语义更准确、可解释性更强。
