# DeepSOC 智能安全运营中心系统

DeepSOC 是一个面向网络安全日志分析场景的 SOC (Security Operations Center) 原型系统，采用前后端分离架构：

- 后端：`Django + django-ninja + ChromaDB + Ollama/OpenAI-compatible LLM`
- 前端：`Vue 3 + Pinia + ECharts + Three.js`

当前版本聚焦“最小可用演示链路 (MVP)”：已打通登录、会话、流式问答、日志检索、联网检索开关、统计面板与拓扑可视化，但多智能体编排和高真实性可视化仍处于后续迭代阶段。

---

## 项目现状说明

本 README 明确区分“已实现”与“待完善”，避免把规划写成既成事实。

- 已实现：完整前后端通信链路、基础 RAG 检索、端云模型切换、SOC 控制台骨架。
- 待完善：五大安全数据库样本规模仍小，图表和拓扑语义仍偏轻量统计，动画性能需优化。

---

## 已实现能力 (代码已落地)

### 1. 后端能力

- API Key 登录认证（默认密码 `secret`）。
- 基于 SSE 的流式聊天接口 `/api/chat`。
- 会话上下文持久化、会话历史读取和清空。
- 支持重新生成和编辑后续回答（通过历史上下文回放）。
- 文件上传解析：支持 `.txt`、`.docx`、`.xlsx`。
- 本地日志检索 + 可选联网检索（DuckDuckGo via `ddgs`）。
- 多 provider 模型路由：`ollama/openai/deepseek/minimax/siliconflow`。
- Dashboard 聚合接口 `/api/dashboard/stats`，从 `data/log` 真实 CSV 聚合统计数据。

### 2. 检索与模型调用链路

- `TopKLogSystem` 使用 `OllamaEmbeddings + ChromaDB + LlamaIndex` 构建/加载向量库。
- 检索策略为“向量检索 + 简单关键词融合”。
- 默认本地模型：`deepseek-r1:7b`，默认嵌入模型：`bge-large:latest`。
- OpenAI-compatible provider 通过前端设置或环境变量注入 API Key。

### 3. 前端能力

- SOC 三栏布局：左侧会话区、中间终端区、右侧统计面板。
- 聊天终端支持：流式输出、复制、编辑、重新生成、附件上传、检索开关。
- 设置面板支持：provider/model 切换、provider API Key、本地导出会话 HTML。
- 右侧图表已接后端 `/api/dashboard/stats`。
- 中部拓扑组件已接入后端 `topology` 数据结构。

---

## 五大核心安全数据库 (MVP)

你新加入的五大核心数据库已经在仓库中落位，并用于当前最小可用场景。

| 数据库 | 当前状态 | 目录 |
|---|---|---|
| 安全案例库 | 已接入，当前为最小样本 | `django_backend/data/log/安全案例库/` |
| 安全处置策略模板库 | 已接入，当前为最小样本 | `django_backend/data/log/安全处置策略模板库/` |
| 常见 Web 攻击模式库 | 已建目录，待补充样本 | `django_backend/data/log/常见 Web 攻击模式库/` |
| CVE&漏洞情报库 | 已接入标准化样本 | `django_backend/data/log/CVE&漏洞情报库/` |
| IOC 规则样本库 | 已接入基础样本 | `django_backend/data/log/IOC 规则样本库/` |

### 当前边界

- 目前是“经典场景最小覆盖”，样本规模还不大。
- 多数目录仅有少量 CSV，主要用于跑通链路与演示。
- 后续需要扩充样本量、字段质量和标签体系，提升检索命中与分析可信度。

---

## 前端完成度与限制

### 已完成

- 页面框架、视觉风格、交互主路径已搭建完成。
- 图表组件与后端统计接口已打通，不再是纯静态页面。
- 拓扑图支持读取后端节点/边数据并实时刷新。

### 当前不足 (与你反馈一致)

- 图表统计目前仍偏“轻量聚合展示”，安全语义深度不足。
- 拓扑结果本质是基于分类/来源统计的结构化可视化，尚非完整攻击链推理图谱。
- 一些 HUD 文案和态势指标仍是演示语义，真实性仍需增强。
- 页面动画较多（背景粒子连线 + Three.js 场景持续渲染 + 波形动效），在低性能设备上存在卡顿。

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

## 系统架构 (当前实现)

```text
Browser (Vue3 SOC Console)
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
- Axios 1.11.0
- ECharts 6.0.0
- Three.js 0.183.2
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

说明：`manage.py` 已将默认端口设为 `8081`（可通过 `DJANGO_PORT` 覆盖）。

### 2. 前端

```bash
cd vue_frontend
npm install
npm run dev
```

默认前端地址：`http://localhost:8082`，并通过 Vite 代理 `/api -> http://localhost:8081`。

### 3. 本地模型准备 (可选但推荐)

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

也可在前端设置面板中临时填写 provider API Key。

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
    │   ├── layouts/SocLayout.vue
    │   ├── components/
    │   ├── composables/
    │   ├── stores/
    │   └── views/
    └── vite.config.js
```

---

## 已知问题

- CORS 默认配置仍含旧端口（`8090`），如跨域失败需在 Django 设置中补充当前前端端口。
- 背景粒子连线和 Three.js 拓扑长期动画会占用较高 GPU/CPU。
- 图表语义目前主要基于 CSV 聚合与关键词风险分级（high/medium/low），分析深度有限。
- “多智能体编排”尚未在代码中落地为独立工作流引擎。

---

## 下一步迭代建议

1. 扩充五大核心数据库样本规模与标注质量（优先补全常见 Web 攻击模式库）。
2. 定义统一安全事件 Schema（IOC/CVE/节点/边/证据来源/处置优先级）。
3. 将图表和拓扑从“聚合统计”升级到“真实攻击链语义渲染”。
4. 引入流程编排层（如 LangGraph）落地多智能体协同。
5. 做前端性能治理（粒子降采样、动画节流、按需渲染）。

---

## 参赛定位总结

当前版本已经具备“可演示、可迭代”的 SOC 原型基础：

- 数据层：五大核心安全数据库已开库，但仍是 MVP 样本。
- 能力层：问答、检索、流式交互、统计可视化已贯通。
- 展示层：SOC 控制台骨架完整，但真实性和流畅度仍需下一阶段打磨。

这也与当前阶段目标一致：先跑通经典场景，再逐步扩充数据与分析深度。
