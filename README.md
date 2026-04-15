# DeepSOC 智能安全运营中心系统

DeepSOC 是一个面向网络安全日志分析场景的 SOC（Security Operations Center）原型系统，采用前后端分离架构：

- 后端：Django + django-ninja + ChromaDB + LlamaIndex + OpenAI-compatible LLM 路由
- 前端：Vue 3 + Pinia + Naive UI + ECharts + Three.js

当前版本已具备比赛可演示的完整链路：登录鉴权、流式分析、会话管理、附件解析、结构化检索、多智能体协同、态势看板与情报查询。

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
- 文件附件解析：支持 .txt、.docx、.xlsx。
- 本地知识库检索（TopKLogSystem）+ 可选联网检索（博查 Web Search API）。
- 模型路由已实现：ollama、openai、deepseek、minimax、siliconflow。
- OpenAI-compatible 错误结构化透传：provider、model、status_code、error_code、message、request_id。
- 仪表盘聚合接口直接读取 django_backend/data/log 下的 JSONL 数据。
- 提供健康检查 /api/health 与就绪检查 /api/ready。
- 提供连通性测试接口 /api/test_connection（provider/search 两类测试）。

### 2.2 检索与证据链能力

- 向量库技术栈：Ollama Embeddings + ChromaDB + LlamaIndex。
- 当前检索系统默认初始化参数：
  - 生成模型：deepseek-r1:7b（Ollama）
  - 嵌入模型：qwen3-embedding:4b（Ollama）
- JSON/JSONL 结构化加载：search_content 入向量，关键字段写入 metadata。
- 检索流程：意图信号提取 -> 精确召回（如 CVE）+ 向量召回 -> 关键词融合重排 -> 分组聚合 -> 证据链输出。
- 返回结构包含：group_key、group_type、member_count、entity_summary、evidence_chain。

### 2.3 前端能力

- 路由与权限：/login、/dashboard、/chat、/intel、/settings，未登录自动跳转。
- 全局布局：侧边导航 + 顶部态势栏 + 主内容区。
- 分析终端：会话创建/切换/搜索/重命名/删除/清空、流式消息、附件输入、多智能体过程展示。
- 消息操作：复制、编辑最近一条用户消息、重新生成。
- 仪表盘：拓扑图、威胁雷达、日志流入、分类分布、全屏下钻并跳转分析终端。
- 设置页：Provider/模型/API Key 配置、连通性探测、会话 HTML 导出、退出登录。
- 状态持久化：Pinia + localStorage（登录态、会话草稿、模型配置、导出目标等）。

### 2.4 情报查询页（IntelQuery）

- Data Grid + Master-Detail 主从分析布局。
- 支持关键词、类型、风险、来源、时间范围、排序字段与排序方向筛选。
- 支持分页、详情异步加载、请求取消、字段高亮。
- 支持导出 CSV / JSON，支持导出范围、字段选择、是否包含 details、文件名前缀。
- 支持一键发送到分析终端并复用会话跳转链路。

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
| /api/test_connection | POST | 连通性测试（provider/search） |
| /api/chat | POST | 流式问答（SSE），支持 single / multi_agent |
| /api/sessions | GET | 获取当前用户会话列表（按最近更新时间） |
| /api/history | GET | 获取指定会话历史（session_id） |
| /api/history | DELETE | 清空指定会话历史（session_id） |
| /api/session/rename | POST | 重命名会话 |
| /api/upload_file | POST | 上传并解析 .txt/.docx/.xlsx |
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
- 后端可将上下文解析为结构化 history，供再生成和前端历史展示。

### 4.3 检索系统 TopKLogSystem

- 向量库路径：django_backend/data/vector_stores（代码内部使用 ./data/vector_stores）。
- 数据加载格式：.txt、.md、.json、.jsonl、.csv、.log、.xml、.yaml、.yml、.docx、.pdf。
- JSON/JSONL 结构化处理：
  - search_content 作为向量文本。
  - _id、db_type、risk_level、cve_id、ioc_value、source、confidence、raw_content_hash、mitre_attack_id、tags 等进入 metadata。
  - 自动补充 record_file、record_line。
- 检索结果聚合优先级：cve_id -> ioc_value -> raw_content_hash -> tags -> db_type/source。

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
  - ChatInput 支持 DB/Web/Multi-Agent 开关与附件上传。
  - useChatSession 统一处理 SSE 分发、agent 状态、编辑重问与再生成。
  - 页面初始化优先调用 /api/sessions 同步会话列表，再加载当前会话历史。
- Dashboard：
  - 拓扑 + 3 图联动，支持全屏、分析引导、跳转 Chat。
  - 图表组件异步加载，降低首屏负担。
- IntelQuery：
  - useIntelQuery 统一处理筛选、分页、详情、导出与请求取消。
- Settings：
  - 模型配置、Provider/WebSearch Ping、会话导出、登出。

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

### 6.2 单模型模式

- 主要返回 content 分片事件：

    {"type":"content","chunk":"..."}

- 异常返回 error 事件（包含 message 与兼容字段 chunk，可能附带 error_detail）。
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

看到类似 Starting development server at http://127.0.0.1:8081/ 即表示后端启动成功。

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

### 9.8 首次登录与比赛口径配置

1. 浏览器打开 http://localhost:8082。
2. 登录：用户名自定义，密码默认 secret。
3. 进入系统设置页面：
   - Provider 选择 siliconflow。
   - Model 选择 DeepSeek-V3.2。
   - 填入 SiliconFlow API Key。
   - 填入博查 Web Search API Key

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


## 11. 答辩可陈述亮点（建议）

1. 不是“单轮对话演示”，而是具备鉴权、会话、检索、编排、可视化、导出的完整工程系统。
2. 不是“简单多模型拼接”，而是 rag/web 并发 + synthesis 汇总、带状态事件流的多智能体编排。
3. 不是“静态看板展示”，而是支持从态势图表下钻到分析终端的闭环研判流程。
