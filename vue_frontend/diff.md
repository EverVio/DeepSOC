# 前端代码改动分析报告

通过对 `src(修改前)` 和 `src(修改后)` 两个版本的代码进行对比，主要的修改点可以归纳为**性能优化（尤其是针对响应式数据和渲染的去代理化）**、**UI 动效与样式升级**以及**Markdown 渲染增强**三个核心方向。

以下是按照子文件夹整理的详细修改点，便于后续进行弃用清洗、冗余代码移除或结构优化。

---

## 1. `assets/` (静态资源与全局样式)
- **`styles.css`**: 在全局 CSS 变量 `--font-mono` 中引入了中文字体兜底（如 HarmonyOS Sans SC、PingFang SC 等），优化了代码或终端字体的中英文混合显示。

## 2. `components/` (组件库)
**全局组件与容器：**
- **`FuiCard.vue` (重构级改动)**:
  - 移除了对 Naive UI `n-card` 及其内置 `clip-path` 样式的重度依赖。
  - 完全重写了底层，采用嵌套 `<svg>` 的方式（通过 `radialGradient` 发光、`pattern` 扫描线、动态 `ResizeObserver` 计算路径 `<path>`）手工绘制科幻切角边框和光效。
  - **建议**: 该重写使得原有的切角 div（`.corner-tl` 等）及旧样式冗余，如果项目内其他组件仍依赖这些旧的全局 class，可集中清理。
- **`Background.vue`**:
  - 增加了基于 `requestAnimationFrame` 与 `performance.now()` 的帧率限制机制（`BG_TARGET_FPS = 30`），避免高刷屏下过渡消耗 GPU。
  - 改写了 `resize` 的防抖逻辑（剥离了空回调的 `removeEventListener` 问题），并在 `onBeforeUnmount` 中增加了严格的计时器回收防内存泄漏。

**业务与特定功能组件：**
- **`TopologyScene.vue` (3D 拓扑图)**:
  - 引入了 Vue 的 `markRaw()` 对 Three.js 的核心对象进行包装：`new THREE.Scene()`, `PerspectiveCamera`, `WebGLRenderer`, `Group`。**（性能大幅优化：切断了 Vue Proxy 代理庞大 3D 对象的开销）**。
  - 降低了设备的像素比 `Math.min(window.devicePixelRatio, 1.5)` 减轻渲染压力。
  - 取消了拓扑数据的深度监听（`deep: false`）。
- **`ChatInput.vue`**:
  - 去除了以往写死的边距，增加了参数设置面板（如 `toggle-form` 和 `multi-agent-config`）的 CSS 过渡折叠效果（`max-height`, `opacity`, `transform`），当 hover 或 focus 时平滑展开。
- **`ChatMessage.vue`**:
  - 在卡片样式方面：左侧边线加粗，增加了 hover 发光响应（`border-left-color`, `background` 插值提亮）。字体通过 `#a3ebd5` 等温和的灰青/灰红替代了部分刺眼的高亮青色。
  - **核心逻辑变更**: 之前的 RAG 检索和 Web 检索结果显示使用的是 `<pre>` 直接输出纯文本，现在引入了 `marked.parse` 解析生成 `v-html`，支持了上述结果渲染为 Markdown。对应添加了大量的 `:deep(.markdown-body)` 嵌套样式。

## 3. `components/charts/` (图表组件)
涉及 `CategoryDonutChart.vue`, `LogInflowChart.vue`, `ThreatRadarChart.vue` 三个图表：
- **解构响应式 (Performance)**: 在图表数据渲染前，统一使用了 `const rawStats = toRaw(props.stats) || {}` 剥除 Proxy 代理；并在 `useEcharts` 中将 `deep: true` 修改为了 `deep: false`，大幅避免了大量图表数据被 Vue 深度劫持引起的卡顿。

## 4. `composables/` (组合式函数)
- **`useDashboardStats.js`**:
  - 数据源响应从 `ref` 变更为 `shallowRef`，停止对全量数据的深层代理。
  - **删除了内置轮询（`setInterval`）**：组件现在只负责加载单次数据，由外部按需进行状态及定时管理。清理轮询逻辑是很好的瘦身点。
- **`useEcharts.js` (核心图表切面)**:
  - 新增了 `IntersectionObserver` 懒加载/视口控制判断（`isInViewport`）。
  - 图表现在只在**进入视口时**（Threshold: 0.05）触发 `renderChart()` 和 `resizeChart()`，如果是视口外的数据更新则将被置为 `pendingRender`。极大地降低了不可见图表的性能损耗。
- **`useChatSession.js`**:
  - 数据解析格式变更：从强弹 `data.content` 变成了优先兼容 `data.chunk || data.content`。

## 5. `stores/` (状态管理)
- **`chatStore.js`**:
  - 为 `persistDraftInputs`（草稿保存致 localStorage）增加了 500ms 的防抖延时（Debounce），避免了由于每个字符输入引起的频繁串行化及磁盘写入开销。

## 6. `views/` (页面级视图)
- **`Dashboard.vue`**:
  - 为顶部三个数字（Records, Sources, Cat）引入了 `@vueuse/core` 中的 `useTransition` 和缓动函数（easeOutCubic），实现了数字自动滚动的跳动效果动画（`recordsTicker`）。
  - 引入了自定义类 `TextScramble`，对页级的卡片标题（"THREAT RADAR", "GLOBAL ATTACK TOPOLOGY" 等）做了黑客终端风的“乱码解密”入场动画。
  - 使用响应式变量替代了静态文字来配合上方的乱码动画。
- **`Settings.vue`**:
  - 重写了 `settings-card` 外层样式，脱离了 Naive UI 原生背景（`background: transparent !important`）。
  - 利用 css 拟态阴影（`settings-card-outer-glow`）、复杂的 `clip-path` 边界切割、顶部亮闪线条（`::after` 等），打造了发光边框的全息 UI 基座。
- **`Chat.vue` & `ChatPage.vue`**:
  - 放大了文本字号、扩展了边距与内外填充，布局拉伸（`height: 100%`, `min-height` 适配）。
  - 将多智能体标识合并进可渲染载荷：`if (message.isMultiAgent) return true`。

## 7. `layouts/` 和 [main.js](file:///c:/Users/violet/Desktop/diff/src%28%E4%BF%AE%E6%94%B9%E5%90%8E%EF%BC%89/main.js) (根级)
- **`layouts/GlobalLayout.vue`**:
  - 取消了 `<n-layout-sider>` 的 `position="absolute"` 以及 top/bottom 零设定，这可能意在修复某些层叠上下文或 Flex 流被破坏导致的滚动条异常。
  - 文案微调：“战术分析终端” -> “分析终端”；“系统配置” -> “系统设置”。
- **[main.js](file:///c:/Users/violet/Desktop/diff/src%28%E4%BF%AE%E6%94%B9%E5%90%8E%EF%BC%89/main.js)**:
  - 新增字体注册：`import 'harmonyos-sans-sc-webfont-splitted'`（与 `styles.css` 的新字体呼应）。

---

### 下一步跟进建议：
1. **清理冗余:**
   - 你可以安全地移除原来写在通用 CSS 或其他组件中关于卡片边角切割（`.corner-tl`, `.scanline-overlay` 等）的旧样式，因为 `FuiCard.vue` 已经完全接管它。
   - `Dashboard` 中原本针对 `.center-topology-card` 的特殊 hack 可以视情况删除，现已纯组件驱动。
2. **结构复用:**
   - 提取 `<TextScramble>`（乱码打字机动效类）为一个公共工具方法或者抽离出一个原子组件 `<ScrambleText>`，不必把它硬编码在了 `Dashboard.vue` 里。
   - 三个图表使用 `toRaw` 卸载响应的逻辑，可以尝试再抽象进 `useEcharts` 拦截阶段，使得业务不必再每次处理原始转换。
