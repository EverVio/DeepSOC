# DeepSOC——基于多智能体协同与RAG架构的智能安全运营系统

DeepSOC（基于多智能体协同与RAG架构的智能安全运营系统）是一个面向网络安全日志分析场景的 SOC（Security Operations Center）原型系统，采用前后端分离架构：

- 后端：Django + django-ninja + ChromaDB + LlamaIndex + OpenAI-compatible LLM 路由
- 前端：Vue 3 + Pinia + Naive UI + ECharts + Three.js

当前版本已具备比赛可演示的完整链路：登录鉴权、流式分析、会话管理、附件解析、结构化检索、多智能体协同、态势看板与情报查询，并默认使用 siliconflow 远程 provider / embedding 接口，仍保留本地模式作为可选增强能力。

---

## 1. 参赛定位

本项目定位于“全国大学生计算机设计大赛 - 软件应用与开发 - Web 赛道”的安全运营原型系统，核心价值在于软件工程闭环而非单点算法。

1. 数据层：统一 JSONL 情报数据接入与结构化字段沉淀。
2. 能力层：向量检索 + 规则融合 + 多 Provider 模型路由 + 多智能体协同。
3. 交互层：流式终端 + 可解释过程 + 看板下钻 + 可配置运维入口。

---

## 2. 已实现能力总览

### 2.1 后端能力

- API Key 登录认证，默认密码为 secret。
- 流式聊天接口（SSE），支持 single 与 multi_agent 两种模式。
- 会话上下文持久化（SQLite），支持历史读取、清空与会话重命名。
- 支持“编辑最近一条用户消息后重问”与“重新生成最后一轮回复”。
- 文件附件解析：`/api/upload_file` 支持 `.txt/.md/.log/.json/.jsonl/.xml/.yaml/.yml/.ini/.conf/.csv/.docx/.xlsx`。
- 本地知识库检索（TopKLogSystem）+ 可选联网检索（博查 Web Search API）。
- 检索向量化默认使用 siliconflow，两种 embedding 模式（local / siliconflow）均已实现，并可在设置页切换。
- 模型路由已实现：ollama、openai、deepseek、minimax、siliconflow。
- OpenAI-compatible 错误结构化透传：provider、model、status_code、error_code、message、request_id。
- 仪表盘聚合接口直接读取 django_backend/data/log 下的 JSONL 数据。
- 提供健康检查 /api/health 与就绪检查 /api/ready。
- 提供运行时配置接口 /api/runtime-config 与远程 embedding 接口 /api/embeddings。
- 提供连通性测试接口 /api/test_connection（provider/search 两类测试）。

### 2.2 检索与证据链能力

- 向量库技术栈：Ollama Embeddings + ChromaDB + LlamaIndex。
- 当前检索系统默认初始化参数：
  - 生成模型：deepseek-ai/DeepSeek-V3.2（SiliconFlow）
  - 嵌入模型：Qwen/Qwen3-Embedding-8B（SiliconFlow）
- JSON/JSONL 结构化加载：search_content 入向量，关键字段写入 metadata。
- 检索流程：意图信号提取 -> 精确召回（如 CVE）+ 向量召回 -> 关键词融合重排 -> 分组聚合 -> 证据链输出。
- 返回结构包含：group_key、group_type、member_count、entity_summary、evidence_chain。

### 2.3 前端能力

- 路由与权限：/login、/dashboard、/chat、/intel、/settings，未登录自动跳转。
- 全局布局：侧边导航 + 顶部态势栏 + 主内容区。
- 分析终端：会话创建/切换/搜索/重命名/删除/清空、流式消息、附件输入、多智能体过程展示。
- 消息操作：复制、编辑最近一条用户消息、重新生成。
- 消息展示：支持 Markdown 渲染、代码块一键复制、多智能体过程面板与停止生成。
- 仪表盘：拓扑图（节点搜索、风险分级过滤、自动旋转开关、焦点/锁定提示）+ 威胁雷达/日志流入/分类分布三图，支持全屏（含 Fullscreen API 失败时 Modal 回退）、下钻引导与跳转分析终端。
- 设置页：模型 Provider/模型/Embedding 配置、Provider 与 Web Search 双链路 Ping（显示时延）、会话 HTML 导出、退出登录二次确认，默认配置为 siliconflow / DeepSeek-V3.2 / SiliconFlow embedding。
- 状态持久化：Pinia + localStorage（登录态、会话草稿、模型配置、导出目标等）。

### 2.4 情报查询页（IntelQuery）

- Data Grid + Master-Detail 主从分析布局。
- 支持关键词、类型、风险、来源、时间范围、排序字段与排序方向筛选。
- 支持分页、详情异步加载、请求取消、字段高亮。
- 支持导出 CSV / JSON，支持导出范围（`all/current_page`）、字段选择（含 `record_file/record_line`）、是否包含 details、文件名前缀。
- 支持一键发送到分析终端并复用会话跳转链路。

### 2.5 代码级后端特色功能（细节能力）

- 聊天流启动后会先发送 `ping` 事件，确保前端快速进入流式消费状态。
- 流式接口同时兼容 ASGI/WSGI 请求上下文：ASGI 下通过 `sync_to_async(next)` 驱动迭代，避免阻塞事件循环。
- `mode=multi_agent` 下支持 `agent_configs`，可对 rag/web/synthesis 三路分别指定 provider/model/key。
- 会话历史使用文本协议保存，但做了协议转义与反转义，防止用户原文中的“用户：/回复：”破坏历史解析。
- 多智能体元信息会被序列化为 `【MULTI_AGENT_META】...` 块并持久化，历史恢复时可还原各 Agent 状态。
- 对“重新生成”做了后端判定：识别“最后一轮 user+assistant 与当前输入一致”并回退上下文，避免重复叠加。
- `upload_file` 除后缀校验外，针对 docx/xlsx 增加 Office ZIP 结构校验（条目数上限、解压后体积上限），防止压缩炸弹。
- OpenAI-compatible 调用失败时输出结构化错误：`provider/model/status_code/error_code/message/request_id`。
- 本地 Ollama 调用不可用时，会自动降级到 siliconflow 远程模型，并通过 `notice(scope=llm_fallback)` 事件告知前端。
- `test_connection` 提供 provider/search 双链路探测，返回 `latency_ms`，便于设置页即时诊断。
- `runtime-config` 可回填服务端默认 API Key（各 provider + web search），降低首次配置成本。

### 2.6 代码级检索特色功能（TopKLogSystem）

- 数据接入支持 `.txt/.md/.json/.jsonl/.csv/.log/.xml/.yaml/.yml/.docx/.pdf`。
- JSON/JSONL 文档按 `search_content` 入向量，并写入结构化 metadata（`_id/db_type/risk_level/cve_id/ioc_value/source/confidence/raw_content_hash/mitre_attack_id/tags` 等）。
- 自动补充 `record_file/record_line`，提升证据追溯性。
- 查询时先做“意图信号提取”（CVE、IP、MITRE、哈希），再执行“精确召回 + 向量召回 + 关键词融合”。
- 精确命中（如 `cve_id`）可强制高分进入候选，避免纯语义检索漏召回。
- 排序不仅看向量相似度，还融合 `risk_level/source_priority/confidence/exact_match_boost`。
- 结果聚合优先级：`cve_id -> ioc_value -> raw_content_hash -> tags -> db_type/source`，输出 group 级证据链。
- 存在“松弛召回”二次检索路径：主路径低分或空结果时自动降低阈值重试，提升召回鲁棒性。
- 远程 embedding 模式并非降级成普通搜索，而是复用同一套候选融合与重排策略，保证结果口径一致。

### 2.7 代码级前端特色功能（交互与体验）

- 路由守卫不仅做登录校验，还会在已登录状态下自动尝试同步 `runtime-config`。
- 聊天流处理具备“空闲超时 + 缓冲区上限 + 可重试”机制，避免 SSE 长连接僵死。
- SSE 事件按类型路由：`agent_chunk/agent_status/notice/content/think/metadata/error`，并统一错误格式化。
- 流式渲染采用“队列 + requestAnimationFrame + 定时窗口”批量刷帧，减少高频 chunk 导致的重排抖动。
- 聊天支持 `AbortController` 停止生成，前后端均可快速收敛状态。
- 支持“仅允许编辑最近一条用户消息”的安全编辑重问，防止中间历史被破坏。
- 消息 Markdown 渲染使用 `marked + highlight.js + DOMPurify`，并给代码块注入一键复制按钮。
- 多智能体消息支持折叠面板，分别展示 rag/web 状态、内容、错误详情。
- 会话草稿按会话维度持久化，且带防抖写入，减少本地存储抖动。
- 会话重命名会联动导出目标会话 ID、分析跳转历史等关联状态，避免“重命名后失联”。
- 看板图表具备全屏降级方案：当浏览器 Fullscreen API 不可用时自动回落到 Modal 全屏。
- 图表下钻引导具备“首次提示记忆”能力（localStorage 标记已读），减少重复打扰。
- IntelQuery 请求支持 AbortController 取消旧请求，防止慢响应覆盖新筛选结果。
- Intel 详情支持沉浸式阅读器、字段级复制反馈、关键词高亮缓存。

### 2.8 代码级工程与运维特色功能

- 查询服务基于“文件签名 + 30s 刷新窗口 + RLock”实现缓存，兼顾性能与数据更新。
- 支持查询缓存预热（启动后主动触发一次轻量查询）。
- 导出文件名会做白名单字符清洗，避免非法文件名与注入风险。
- 导出支持 `all/current_page`、字段选择、`include_details`、CSV/JSON 双格式。
- 前端全局错误通过 `deepsoc:api-error` 事件分发，401 通过 `deepsoc:unauthorized` 统一处理。
- Vite 构建配置了 manualChunks（`vue-vendor/naive/charts/three`）以优化首屏加载。
- Dashboard 与 Intel 页面使用 `keep-alive`，减少高频切页重复初始化成本。
- 仪表盘数据轮询采用“前后台区分加载态”策略：首屏显式 loading，后台轮询静默刷新。

---

## 3. 系统架构（当前实现）

    Browser (Vue 3 SOC Console)
      -> Django Ninja API (/api/*)
        -> APIKey/Auth + Session (SQLite)
        -> TopKLogSystem
          -> ChromaDB Vector Store (./data/vector_stores)
          -> data/log JSONL Knowledge Base
        -> Optional Web Search (Bocha API)
        -> LLM Provider Router
          -> Ollama (local)
          -> OpenAI-compatible Providers
        -> Multi-Agent Orchestrator (RAG + WEB -> Synthesis)

说明：代码层保留多 Provider 路由；当前比赛部署口径为仅使用 SiliconFlow 的 deepseek-ai/DeepSeek-V3.2，其他厂商选项作为占位与兼容入口保留。

---

## 4. 后端实现说明

### 4.1 核心接口

说明：除 /api/login、/api/health、/api/ready 外，其余业务接口均要求 Authorization: Bearer <api_key>。

| 接口 | 方法 | 说明 |
|---|---|---|
| /api/login | POST | 登录并签发 API Key |
| /api/health | GET | 进程存活检查 |
| /api/ready | GET | 就绪检查（DB + 向量检索组件） |
| /api/runtime-config | GET | 运行时敏感配置自动回填 |
| /api/test_connection | POST | 连通性测试（provider/search） |
| /api/embeddings | POST | 远程 embedding 生成（siliconflow） |
| /api/chat | POST | 流式问答（SSE），支持 single / multi_agent |
| /api/sessions | GET | 获取当前用户会话列表（按最近更新时间） |
| /api/history | GET | 获取指定会话历史（session_id） |
| /api/history | DELETE | 清空指定会话历史（session_id） |
| /api/session/rename | POST | 重命名会话 |
| /api/upload_file | POST | 上传并解析 .txt/.md/.log/.json/.jsonl/.xml/.yaml/.yml/.ini/.conf/.csv/.docx/.xlsx |
| /api/dashboard/stats | GET | 仪表盘聚合数据 |
| /api/query/logs | GET | 情报查询列表（分页/过滤/排序） |
| /api/query/logs/{record_id} | GET | 情报记录详情 |
| /api/query/facets | GET | 情报查询分面统计 |
| /api/query/export | GET | 情报查询导出（CSV/JSON） |

### 4.2 认证与会话

- API Key 存储于 deepseek_api_apikey 表，过期时间为时间戳。
- 默认密码来自 AUTH_PASSWORD，缺省值为 secret。
- 会话上下文存储在 ConversationSession.context，使用文本协议：
  - 用户：xxx
  - 回复：yyy
- 多智能体元信息以标记块写入上下文：
  - 【MULTI_AGENT_META】...【/MULTI_AGENT_META】
- 后端可将上下文解析为结构化 history，前端恢复时会保留多行内容并还原多智能体元信息，供再生成和历史展示。

### 4.3 检索系统 TopKLogSystem

- 向量库路径：django_backend/data/vector_stores（代码内部使用 ./data/vector_stores）。
- 数据加载格式：.txt、.md、.json、.jsonl、.csv、.log、.xml、.yaml、.yml、.docx、.pdf。
- JSON/JSONL 结构化处理：
  - search_content 作为向量文本。
  - _id、db_type、risk_level、cve_id、ioc_value、source、confidence、raw_content_hash、mitre_attack_id、tags 等进入 metadata。
  - 自动补充 record_file、record_line。
- 检索结果聚合优先级：cve_id -> ioc_value -> raw_content_hash -> tags -> db_type/source。
- 模型配置支持 provider/model 与 embedding_mode/embedding_model 的组合传参与自动回填。

### 4.4 多智能体编排

- 并发阶段：
  - VectorAgent（rag，内部证据）
  - SearchAgent（web，外部情报）
- 汇总阶段：SynthesisAgent 在 rag/web 均完成后启动。
- 编排器对 rag/web 输出尝试抽取 JSON，若抽取失败会生成降级 payload，再进入 synthesis。

### 4.5 模型与联网检索

- Provider 路由代码支持：ollama、openai、deepseek、minimax、siliconflow。
- 当前比赛部署口径：仅使用 SiliconFlow deepseek-ai/DeepSeek-V3.2（前端显示名 DeepSeek-V3.2）。
- 其余 Provider 在当前项目中视为占位/兼容入口。
- 联网检索主路径：博查 API（BOCHA_API_KEY）。
- test_connection 支持：
  - provider: 对应厂商 models 接口或本地 Ollama tags。
  - search: 博查 web-search 接口。
- embedding 支持：
  - local: Ollama 本地 qwen3-embedding:4b。
  - siliconflow: SiliconFlow 远程 Qwen/Qwen3-Embedding-8B。

---

## 5. 前端实现说明

### 5.1 目录分层与组织

前端源码位于 vue_frontend/src，采用“页面编排 + 领域组件 + composables + stores”分层：

- layouts：GlobalLayout 应用壳。
- views：Login、Dashboard、ChatPage、IntelQuery、Settings。
- components：聊天、图表、拓扑、情报子模块、布局组件。
- composables：聊天会话流、设置、看板数据、全屏控制、情报查询等逻辑。
- stores：authStore、appStore、chatStore。

### 5.2 路由与导航守卫

- 路由入口：/login、/dashboard、/chat、/intel、/settings。
- 页面采用懒加载。
- 守卫逻辑：
  - 未登录访问受保护页面 -> 跳转 /login。
  - 已登录访问 /login -> 跳转 /dashboard。
- 未匹配路由回退到 /dashboard。

### 5.3 状态管理（Pinia）

- authStore：apiKey 与登录态。
- appStore：loading/error、检索开关、编辑态、LLM provider/model/API Key。
- chatStore：会话列表、消息、草稿、分析下钻上下文、会话重命名联动。

### 5.4 核心页面与组件机制

- Chat：
  - ChatInput 支持 DB/Web/Multi-Agent 开关、附件上传，以及 multi-agent 下 RAG/WEB/SYNTHESIS 三路模型单独配置（provider/key 复用全局设置）。
  - useChatSession 统一处理 SSE 分发、agent 状态、编辑重问、再生成与停止生成。
  - 页面初始化优先调用 /api/sessions 同步会话列表，再加载当前会话历史。
- Dashboard：
  - 拓扑组件基于 Three.js，支持节点搜索（ID/名称/类型）、风险等级筛选（all/critical/high/medium/low）、节点悬停提示、聚焦/锁定、自动旋转与 RESET VIEW。
  - 拓扑面板可折叠，支持全屏与 Modal 回退；雷达图、日志流入图、分类分布图保持下钻联动并可跳转 Chat。
  - 图表组件异步加载，降低首屏负担。
- IntelQuery：
  - useIntelQuery 统一处理筛选、分页、详情、导出与请求取消。
- Settings：
  - 双区块配置：核心引擎（Provider/模型/Embedding + Provider Ping）与外部插件（Web Search Key + Search Ping）。
  - Provider Ping 在 Ollama 模式下禁用；其余模式可实时返回 latency。
  - 支持按会话选择 HTML 导出，退出登录采用弹窗二次确认。
  - 页面会优先使用 /api/runtime-config 回填服务器侧的默认 Key。

### 5.5 UI 规范与构建运行

- main.js 通过 NConfigProvider 注入 Naive UI 主题覆盖（当前启用 darkTheme）。
- 全局样式位于 src/assets/styles.css。
- 所有 Vue 组件采用 script setup + Composition API。

前端运行：

    cd vue_frontend
    npm install
    npm run dev

构建与预览：

    cd vue_frontend
    npm run build
    npm run preview

---

## 6. 多智能体 SSE 事件约定

### 6.1 多智能体模式

- agent_chunk

    {"type":"agent_chunk","agent_id":"rag|web|synthesis","content":"..."}

- agent_status

    {"type":"agent_status","agent_id":"rag|web|synthesis","status":"started|done|error","error":"...","error_detail":{}}

- 结束事件

    {"type":"done"}

- 说明：agent_status 会随执行阶段持续刷新，agent_chunk 用于增量拼接各智能体输出，error_detail 会保留结构化 Provider 错误信息。

### 6.2 单模型模式

- 主要返回 content 分片事件：

    {"type":"content","chunk":"..."}

- 同时可能返回 think、metadata 与 error 事件，其中 think 用于推理过程，metadata 目前用于耗时信息，error 事件包含 message 与兼容字段 chunk，可能附带 error_detail。
- 会话流尾统一返回 done 事件。

---

## 7. 数据资产与目录

当前仓库知识数据统一为 JSONL，核心目录如下：

| 目录 | 说明 |
|---|---|
| django_backend/data/log/CVE&漏洞情报库 | CVE 漏洞情报 |
| django_backend/data/log/IOC 规则样本库 | IOC 指标样本 |
| django_backend/data/log/常见Web攻击模式库 | 常见 Web 攻击模式 |
| django_backend/data/log/安全处置策略与案例库 | 安全处置策略与案例 |

### 7.1 JSONL 统一字段（当前实现）

- 主键与追溯：_id、raw_content_hash、source、fetched_at。
- 检索语义：search_content。
- 结构化标签：db_type、risk_level、cve_id、ioc_value、mitre_attack_id、tags。
- 质量字段：confidence、verified。

---

## 8. 技术栈

### 8.1 后端（requirements.txt）

- Django 5.2.7
- django-ninja 1.4.4
- django-cors-headers 4.9.0
- chromadb 1.2.0
- llama-index 0.14.5
- langchain 0.3.25
- langchain-ollama 0.3.8
- openai 1.109.1
- requests 2.32.5
- pandas 2.2.3
- python-docx 1.2.0
- PyPDF2 3.0.1

### 8.2 前端（package.json）

- vue 3.5.18
- pinia 3.0.3
- vue-router 4.5.1
- naive-ui 2.44.1
- axios 1.11.0
- echarts 6.0.0
- three 0.183.2
- @vueuse/core 14.2.1
- marked 16.4.1
- highlight.js 11.11.1
- splitpanes 4.0.4
- dompurify 3.3.3
- vite 7.1.12

---

## 9. 快速开始

以下流程为仅 Linux 系统（面向零基础）的一步一步部署说明。

### 9.1 Linux 基础依赖安装（Ubuntu/Debian）

先打开终端，执行：

  sudo apt update
  sudo apt install -y curl git build-essential ca-certificates
  sudo apt install -y python3 python3-venv python3-pip

检查 Python：

  python3 --version

建议 Python 版本为 3.12

### 9.2 安装 Node.js（推荐 nvm 方式）

安装 nvm：

  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

让 nvm 生效（或重开终端）：

  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

安装 Node.js 20（兼容 Node.js 18+ 要求）：

  nvm install 20
  nvm use 20

检查 Node 与 npm：

  node -v
  npm -v

### 9.3 获取项目代码

如果你已经有本地项目目录，可跳过本节。

  git clone <你的仓库地址>
  cd DeepSOC

### 9.4 配置 Python 虚拟环境

这一部分提供两种方法，任选一种即可。方法一适合从零安装，方法二适合你已经准备好了 conda-pack 压缩包。

#### 方法一：本地创建 Python 虚拟环境

仍在 django_backend 目录中执行：

  python3 -m venv .venv
  source .venv/bin/activate
  python -m pip install --upgrade pip
  pip install -r requirements.txt

初始化数据库并启动后端：

  python manage.py migrate
  python manage.py runserver

看到类似 Starting development server at http://127.0.0.1:8081/ 即表示后端启动成功（默认端口为 8081，可通过环境变量 `DJANGO_PORT` 覆盖）。

#### 方法二：直接使用作者提供的 conda-pack (.tar.gz)

1. 把 conda-pack 压缩包放到一个固定目录，例如 ~/packages/。
2. 创建解压目录，例如 ~/DeepSOC-env。
3. 解压压缩包到目标目录。

示例命令如下，把 archive.tar.gz 替换成你实际提供的文件名：

    mkdir -p ~/DeepSOC-env
    tar -xzf ~/packages/archive.tar.gz -C ~/DeepSOC-env

4. 进入解压后的环境目录，先激活环境。

    source ~/DeepSOC-env/bin/activate

5. 第一次使用时，执行 conda-unpack 修复环境内的绝对路径。

    ~/DeepSOC-env/bin/conda-unpack

6. 初始化数据库并启动后端。

    python manage.py migrate
    python manage.py runserver

说明：如果你的压缩包里已经自带了完整 Python 环境，运行时优先使用该环境里的 python 和 pip；不要混用系统 Python。

### 9.5 新开终端启动前端

重新打开一个终端窗口（不要关掉后端），执行：

  cd DeepSOC/vue_frontend
  npm install
  npm run dev

前端默认地址：http://localhost:8082

说明：前端已配置代理，/api 请求会转发到 http://localhost:8081。

### 9.6 可选：安装 Ollama 并准备本地模型

如果你希望本地向量检索链路完整可用，先安装 Ollama（Linux 官方安装脚本）：

  curl -fsSL https://ollama.com/install.sh | sh

下载项目使用的本地模型：

  ollama pull deepseek-r1:7b
  ollama pull qwen3-embedding:4b

说明：比赛口径主模型为 SiliconFlow 的 DeepSeek-V3.2；Ollama 是本地能力增强选项。

### 9.7 可选：常用环境变量（django_backend/.env）

以下变量在代码中已实现读取，可按需配置：

1. `AUTH_PASSWORD`：登录密码，默认 `secret`。
2. `DJANGO_PORT`：后端端口，默认 `8081`（`manage.py` 会读取此变量）。
3. `SILICONFLOW_API_KEY`、`BOCHA_API_KEY`：可作为服务端默认密钥，被 `/api/runtime-config` 回填到前端。
4. `REMOTE_RETRIEVAL_ENABLE_RELAXED`：是否启用松弛召回二次检索（默认关闭）。
5. `QUERY_RECORD_CACHE_REFRESH_SECONDS`：查询记录缓存刷新窗口，默认 `30` 秒。
6. `WARM_QUERY_RECORD_CACHE`：是否启动时预热查询缓存，默认开启。

### 9.8 首次登录与比赛口径配置

1. 浏览器打开 http://localhost:8082。
2. 登录：用户名自定义，密码默认 secret。
3. 进入系统设置页面：
  - Provider 选择 siliconflow。
  - Model 选择 DeepSeek-V3.2。
  - Embedding 模式选择 siliconflow。
  - Embedding 模型选择 Qwen/Qwen3-Embedding-8B。
  - 填入 SiliconFlow API Key。
  - 填入博查 Web Search API Key。

### 9.9 启动后快速自检（建议执行）

后端健康检查：

  curl http://localhost:8081/api/health
  curl http://localhost:8081/api/ready

预期结果：

1. /api/health 返回 status=ok。
2. /api/ready 返回 ready 或 degraded。
3. 若 /api/ready 为 degraded，通常表示向量检索组件未就绪（例如 Ollama 未启动或模型未拉取）。

### 9.10 Linux 常见问题（新手高频）

1. 报错 python: command not found：请改用 python3。
2. 报错 pip: command not found：执行 sudo apt install -y python3-pip。
3. npm install 非常慢：可先切换镜像源后重试。
4. 8081 或 8082 端口被占用：
   - 查端口：ss -lntp | grep 8081
   - 结束进程：kill -9 <PID>
5. 前端能打开但无法调用后端：确认后端是否在 8081 正常运行。

---

## 10. 当前目录结构

    .
    ├── django_backend
    │   ├── deepseek_api
    │   │   ├── api.py
    │   │   ├── services.py
    │   │   ├── dashboard_stats.py
    │   │   ├── query_service.py
    │   │   ├── models.py
    │   │   ├── schemas.py
    │   │   └── agents/
    │   ├── deepseek_project
    │   ├── data/log
    │   ├── data/vector_stores
    │   ├── topklogsystem.py
    │   └── manage.py
    └── vue_frontend
        ├── src
        │   ├── components/
        │   ├── composables/
        │   ├── layouts/
        │   ├── stores/
        │   └── views/
        └── vite.config.js


## 11. 演示、答辩可陈述亮点（建议）

1. 不是“问答 Demo”，而是完整工程闭环：登录鉴权、会话持久化、流式分析、态势看板、情报查询、结构化导出一体化打通。
2. 多智能体不是串行拼接，而是 rag/web 并发执行 + synthesis 汇总，且全程有 `agent_status` 与 `agent_chunk` 可视化状态流。
3. 后端流式接口同时兼容 ASGI/WSGI，上线形态更灵活；ASGI 下通过 `sync_to_async(next)` 避免阻塞事件循环。
4. 检索不是“纯向量相似度”，而是意图信号提取（CVE/IP/MITRE/哈希）+ 精确召回 + 向量召回 + 关键词融合重排。
5. 检索结果不是散点文本，而是 group 级证据链输出（`group_key/group_type/member_count/entity_summary/evidence_chain`），便于答辩时讲清“可解释性”。
6. 远程 embedding 模式与本地模式共用同一套候选融合与重排口径，保证不同部署条件下结果可比。
7. 本地 Ollama 不可用时会自动降级至 siliconflow，并通过 `notice(scope=llm_fallback)` 提示前端，增强系统可用性。
8. 上传链路具备安全设计：docx/xlsx 增加 ZIP 结构校验、条目上限、解压体积上限，能说明安全工程意识。
9. 前端流式渲染有性能优化：队列 + requestAnimationFrame + 窗口批量刷帧，减少高频 chunk 导致的抖动与重排。
10. 态势看板支持 Fullscreen API 与 Modal 双通道全屏，兼容受限浏览器环境；并带首次下钻引导记忆，降低学习成本。
11. 分析闭环可演示：从 Dashboard/Intel 一键下钻到 Chat，自动预填分析模板并复用会话链路，体现研判流程闭环。
12. 会话治理能力完整：仅允许编辑最近一条用户消息、支持重新生成、重命名级联同步导出目标与跳转历史，避免状态失联。
13. 查询服务具备“文件签名 + 30s 刷新窗口 + 预热”的缓存策略，在数据持续更新与响应性能之间取得平衡。
14. 设置页具备运维友好性：provider/search 双链路 Ping（含时延）、运行时配置回填、会话 HTML 导出与退出登录二次确认。
