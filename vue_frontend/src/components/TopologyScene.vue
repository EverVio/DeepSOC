<!--
  组件职责：渲染攻击拓扑 3D 场景并提供搜索、聚焦和旋转控制。
  业务模块：可视化拓扑模块
  主要数据流：topology 数据 -> DataAdapter -> TopologyRenderer / TopologyInteraction -> WebGL 画面
-->

<template>
  <div ref="mountRef" class="topology-scene">
    <div class="topology-toolbar">
      <div class="toolbar-search">
        <input
          v-model.trim="searchKeyword"
          class="toolbar-input"
          type="text"
          placeholder="搜索节点 ID / 名称 / 类型"
          @keyup.enter="handleSearch"
        />
        <button class="toolbar-button toolbar-button--primary" type="button" @click="handleSearch">SEARCH</button>
      </div>

      <div class="toolbar-actions">
        <button class="toolbar-button" type="button" :class="{ active: autoRotateEnabled }" @click="toggleAutoRotate">
          {{ autoRotateEnabled ? 'ROTATE ON' : 'ROTATE OFF' }}
        </button>
        <button class="toolbar-button" type="button" :disabled="!hasActiveSelection" @click="handlePinToggle">
          {{ pinButtonLabel }}
        </button>
        <button class="toolbar-button" type="button" @click="handleReset">RESET VIEW</button>
      </div>
    </div>

    <!-- 风险等级筛选条 -->
    <div class="topology-filter-bar">
      <span class="filter-label">FILTER:</span>
      <button
        v-for="f in riskFilters"
        :key="f.key"
        class="filter-chip"
        :class="{ 'filter-chip--active': activeRiskFilter === f.key, [`filter-chip--${f.key}`]: true }"
        type="button"
        @click="setRiskFilter(f.key)"
      >
        <span class="filter-chip-dot" :style="{ background: f.color }"></span>
        {{ f.label }}
      </button>
    </div>

    <div
      v-show="tooltip.show"
      class="topology-tooltip"
      :class="{ 'topology-tooltip--locked': tooltip.locked, [`topology-tooltip--risk-${tooltip.riskLevel}`]: Boolean(tooltip.riskLevel) }"
      :style="tooltipStyle"
    >
      <div class="tooltip-head">
        <div class="tooltip-title">{{ tooltip.title }}</div>
        <div v-if="tooltip.locked" class="tooltip-badge">LOCKED</div>
      </div>
      <div v-if="tooltip.type" class="tooltip-type">Type: {{ tooltip.type }}</div>
      <div v-if="tooltip.riskLevel" class="tooltip-risk" :class="`tooltip-risk--${tooltip.riskLevel}`">
        <span class="tooltip-risk-dot"></span>
        RISK: {{ tooltip.riskLevel.toUpperCase() }}
      </div>
      <div v-if="tooltip.riskLevel" class="tooltip-energy">
        <span class="tooltip-energy-fill" :style="{ width: `${tooltipEnergy}%` }"></span>
      </div>
      <div class="tooltip-metric">Value: {{ tooltip.valueText }}</div>
      <div class="tooltip-metric">Degree: {{ tooltip.degreeText }}</div>
      <div class="tooltip-meta">{{ tooltip.mode.toUpperCase() }}</div>
    </div>

    <div class="topology-status">
      <span class="status-chip">{{ statusText }}</span>
      <span class="status-summary">{{ summaryText }}</span>
    </div>

    <div class="topology-legend">
      <div class="legend-block">
        <div class="legend-title">NODE TYPES</div>
        <div v-for="item in nodeLegendItems" :key="item.key" class="legend-item">
          <span class="legend-dot" :style="{ backgroundColor: item.color, boxShadow: `0 0 9px ${item.color}` }"></span>
          <span class="legend-label">{{ item.label }}</span>
          <span class="legend-note">{{ item.note }}</span>
        </div>
        <div class="legend-separator"></div>
        <div class="legend-title legend-title--sub">RISK LEVEL</div>
        <div v-for="item in riskLegendItems" :key="item.key" class="legend-item">
          <span class="legend-dot legend-dot--risk" :style="{ backgroundColor: item.color, boxShadow: `0 0 7px ${item.color}` }"></span>
          <span class="legend-label">{{ item.label }}</span>
        </div>
      </div>

      <div class="legend-block">
        <div class="legend-title">LINK SEVERITY</div>
        <div v-for="item in linkLegendItems" :key="item.key" class="legend-item legend-item--line">
          <span class="legend-line" :style="{ backgroundColor: item.color, opacity: item.opacity }"></span>
          <span class="legend-label">{{ item.label }}</span>
        </div>
        <div class="legend-range">Weight {{ legendStats.minWeight }} - {{ legendStats.maxWeight }}</div>
        <div class="legend-note legend-note--meta">
          Nodes {{ legendStats.renderedNodes }}/{{ legendStats.totalNodes }}
          <span class="legend-divider">|</span>
          Links {{ legendStats.renderedLinks }}/{{ legendStats.totalLinks }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, triggerRef, watch } from 'vue'
import {
  LINK_LEGEND_ITEMS,
  NODE_LEGEND_ITEMS,
  buildTopologyModel,
  getTopologySummaryText,
} from './topology/TopologyDataAdapter.js'
import { TopologyInteraction } from './topology/TopologyInteraction.js'

const props = defineProps({
  topology: {
    type: Object,
    default: () => ({ nodes: [], links: [] }),
  },
})

const mountRef = ref(null)
const searchKeyword = ref('')
const autoRotateEnabled = ref(true)
const statusText = ref('AUTO ROTATE ON')
const activeNodeId = ref('')
const focusedNodeId = ref('')
const pinnedNodeId = ref('')
const nodeLegendItems = NODE_LEGEND_ITEMS
const linkLegendItems = LINK_LEGEND_ITEMS

const tooltip = shallowRef({
  show: false,
  x: 0,
  y: 0,
  title: '',
  type: '',
  valueText: '',
  degreeText: '',
  riskLevel: '',
  mode: 'hover',
  locked: false,
  nodeId: '',
})

const topologyModel = ref(buildTopologyModel(props.topology))
const tooltipStyle = computed(() => ({ left: `${tooltip.value.x}px`, top: `${tooltip.value.y}px` }))
const legendStats = computed(() => topologyModel.value?.stats || { minWeight: 0, maxWeight: 0, renderedNodes: 0, totalNodes: 0, renderedLinks: 0, totalLinks: 0 })

const riskFilters = [
  { key: 'all',      label: 'ALL',      color: '#7fa8b6' },
  { key: 'critical', label: 'CRITICAL', color: '#ff1a3a' },
  { key: 'high',     label: 'HIGH',     color: '#ff4400' },
  { key: 'medium',   label: 'MEDIUM',   color: '#ffaa00' },
  { key: 'low',      label: 'LOW',      color: '#00b8ff' },
]
const activeRiskFilter = ref('all')

const riskLegendItems = [
  { key: 'critical', label: 'CRITICAL', color: '#ff1a3a' },
  { key: 'high',     label: 'HIGH',     color: '#ff4400' },
  { key: 'medium',   label: 'MEDIUM',   color: '#ffaa00' },
  { key: 'low',      label: 'LOW / INFO', color: '#00b8ff' },
]
const summaryText = computed(() => getTopologySummaryText(topologyModel.value))
const hasActiveSelection = computed(() => Boolean(activeNodeId.value || focusedNodeId.value || pinnedNodeId.value))
const pinButtonLabel = computed(() => (pinnedNodeId.value ? 'UNPIN NODE' : 'PIN NODE'))
const tooltipEnergy = computed(() => {
  const level = String(tooltip.value.riskLevel || 'low').toLowerCase()
  if (level === 'critical') return 100
  if (level === 'high') return 82
  if (level === 'medium') return 62
  return 38
})

let topologyEngine = null

const syncTopologyModel = () => {
  topologyModel.value = buildTopologyModel(props.topology)
  if (topologyEngine) {
    topologyEngine.setTopologyModel(topologyModel.value)
  }
}

const handleNodeStateChange = (payload) => {
  if (!payload || payload.show === false) {
    Object.assign(tooltip.value, {
      show: false,
      x: 0, y: 0,
      title: '', type: '', valueText: '', degreeText: '',
      riskLevel: '', mode: 'hover', locked: false,
      nodeId: '', pinnedNodeId: '', focusedNodeId: '', hoveredNodeId: '',
    })
    triggerRef(tooltip)
    activeNodeId.value = ''
    focusedNodeId.value = ''
    pinnedNodeId.value = ''
    return
  }

  Object.assign(tooltip.value, {
    show: true,
    x: payload.x ?? 0,
    y: payload.y ?? 0,
    title:      payload.title      || '',
    type:       payload.type       || '',
    valueText:  payload.valueText  || '0',
    degreeText: payload.degreeText || '0',
    riskLevel:  payload.riskLevel  || '',
    mode:       payload.mode       || 'hover',
    locked:     Boolean(payload.locked),
    nodeId:         payload.nodeId         || '',
    pinnedNodeId:   payload.pinnedNodeId   || '',
    focusedNodeId:  payload.focusedNodeId  || '',
    hoveredNodeId:  payload.hoveredNodeId  || '',
  })
  triggerRef(tooltip)
  activeNodeId.value  = payload.nodeId        || ''
  focusedNodeId.value = payload.focusedNodeId || ''
  pinnedNodeId.value  = payload.pinnedNodeId  || ''
}

const handleStatusChange = (text) => {
  const t = text || 'READY'
  statusText.value = t
  if (t === 'AUTO ROTATE ON') {
    autoRotateEnabled.value = true
  } else if (t === 'AUTO ROTATE OFF') {
    autoRotateEnabled.value = false
  }
}

const handleAutoRotateChange = (enabled) => {
  autoRotateEnabled.value = Boolean(enabled)
}

// ── 风险等级过滤 ──────────────────────────────────
const setRiskFilter = (key) => {
  activeRiskFilter.value = key
  if (!topologyEngine) return
  if (key === 'all') {
    topologyEngine.setNodeFilter(null)
    handleStatusChange('FILTER: ALL')
  } else {
    topologyEngine.setNodeFilter((record) => record.riskLevel === key)
    handleStatusChange(`FILTER: ${key.toUpperCase()}`)
  }
}

const handleSearch = () => {
  if (!topologyEngine) return

  const query = searchKeyword.value.trim()
  if (!query) {
    handleStatusChange('ENTER A NODE NAME')
    return
  }

  const matched = topologyEngine.focusByKeyword(query, { pin: true })
  if (!matched) {
    handleStatusChange('NO MATCH')
  }
}

const toggleAutoRotate = () => {
  autoRotateEnabled.value = !autoRotateEnabled.value
  if (topologyEngine) {
    topologyEngine.setAutoRotate(autoRotateEnabled.value)
  }
  handleStatusChange(autoRotateEnabled.value ? 'AUTO ROTATE ON' : 'AUTO ROTATE OFF')
}

const handlePinToggle = () => {
  if (!topologyEngine || !hasActiveSelection.value) return
  topologyEngine.togglePin(pinnedNodeId.value || activeNodeId.value)
}

const handleReset = () => {
  searchKeyword.value = ''
  if (topologyEngine) {
    topologyEngine.resetView()
    topologyEngine.setAutoRotate(autoRotateEnabled.value)
  }
  handleStatusChange(autoRotateEnabled.value ? 'AUTO ROTATE ON' : 'AUTO ROTATE OFF')
}

onMounted(() => {
  if (!mountRef.value) return

  topologyEngine = new TopologyInteraction({
    onNodeStateChange: handleNodeStateChange,
    onStatusChange: handleStatusChange,
    onAutoRotateChange: handleAutoRotateChange,
  })

  topologyEngine.mount(mountRef.value)
  topologyEngine.setAutoRotate(autoRotateEnabled.value)
  topologyEngine.setTopologyModel(topologyModel.value)
})

watch(
  () => props.topology,
  () => {
    syncTopologyModel()
  },
  { deep: false }
)

watch(autoRotateEnabled, (enabled) => {
  if (topologyEngine) {
    topologyEngine.setAutoRotate(enabled)
  }
})

onBeforeUnmount(() => {
  if (topologyEngine) {
    topologyEngine.dispose()
    topologyEngine = null
  }
})
</script>

<style scoped>
.topology-scene {
  width: 100%;
  height: 100%;
  min-height: 230px;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 45%, rgba(0, 209, 255, 0.13), transparent 56%),
    radial-gradient(circle at 15% 15%, rgba(106, 168, 255, 0.12), transparent 45%),
    linear-gradient(180deg, rgba(5, 8, 20, 0.98), rgba(6, 16, 34, 0.92));
}

.topology-scene::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 78% 20%, rgba(143, 196, 255, 0.08), transparent 38%),
    repeating-linear-gradient(
      115deg,
      rgba(128, 194, 255, 0.04) 0,
      rgba(128, 194, 255, 0.04) 1px,
      transparent 1px,
      transparent 16px
    );
  mix-blend-mode: screen;
  z-index: 0;
}

.topology-scene :deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
  position: absolute;
  inset: 0;
}

/* ── 风险筛选条 ─────────────────────────────────── */
.topology-filter-bar {
  position: absolute;
  left: 10px;
  top: 52px;
  z-index: 11;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  pointer-events: auto;
  animation: panel-slide-in 540ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.filter-label {
  color: rgba(198, 230, 243, 0.92);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  margin-right: 4px;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 30px;
  padding: 0 12px;
  border: 1px solid rgba(0, 229, 255, 0.4);
  background: linear-gradient(125deg, rgba(202, 231, 255, 0.1), rgba(14, 39, 73, 0.56));
  color: rgba(214, 240, 252, 0.95);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  line-height: 1;
  cursor: pointer;
  border-radius: 999px;
  transition: all 0.22s ease;
  backdrop-filter: blur(7px) saturate(118%);
}

.filter-chip:hover {
  border-color: rgba(0, 229, 255, 0.45);
  color: #d8f5ff;
}

.filter-chip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.filter-chip--active.filter-chip--all {
  border-color: rgba(127, 168, 182, 0.7);
  background: rgba(127, 168, 182, 0.1);
  color: #d8f5ff;
  box-shadow: 0 0 8px rgba(127, 168, 182, 0.2);
}
.filter-chip--active.filter-chip--critical {
  border-color: rgba(255, 26, 58, 0.7);
  background: rgba(255, 26, 58, 0.1);
  color: #ff8899;
  box-shadow: 0 0 10px rgba(255, 26, 58, 0.28);
}
.filter-chip--active.filter-chip--high {
  border-color: rgba(255, 68, 0, 0.7);
  background: rgba(255, 68, 0, 0.1);
  color: #ffaa66;
  box-shadow: 0 0 10px rgba(255, 68, 0, 0.28);
}
.filter-chip--active.filter-chip--medium {
  border-color: rgba(255, 170, 0, 0.7);
  background: rgba(255, 170, 0, 0.1);
  color: #ffd97a;
  box-shadow: 0 0 10px rgba(255, 170, 0, 0.25);
}
.filter-chip--active.filter-chip--low {
  border-color: rgba(0, 184, 255, 0.6);
  background: rgba(0, 184, 255, 0.08);
  color: #88ddff;
  box-shadow: 0 0 8px rgba(0, 184, 255, 0.2);
}

.topology-toolbar {
  position: absolute;
  left: 10px;
  right: 10px;
  top: 10px;
  z-index: 11;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
  pointer-events: none;
}

.topology-toolbar::before {
  content: '';
  position: absolute;
  inset: -4px -2px -4px -2px;
  border-radius: 10px;
  border: 1px solid rgba(116, 205, 255, 0.16);
  background: linear-gradient(135deg, rgba(6, 18, 36, 0.7), rgba(6, 16, 32, 0.34));
  backdrop-filter: blur(10px) saturate(122%);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18), inset 0 0 0 1px rgba(162, 229, 255, 0.06);
  pointer-events: none;
}

.toolbar-search,
.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  pointer-events: auto;
  flex-wrap: wrap;
  animation: panel-slide-in 620ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  position: relative;
  z-index: 1;
}

.toolbar-search {
  flex: 1 1 320px;
  min-width: 260px;
  padding: 3px;
  border: 1px solid var(--toolbar-border, rgba(0, 255, 255, 0.5));
  background: var(--toolbar-surface, linear-gradient(135deg, rgba(22, 42, 70, 0.92), rgba(8, 19, 38, 0.92)));
  box-shadow: inset 0 0 0 1px rgba(176, 230, 255, 0.06);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.toolbar-search:focus-within {
  border-color: var(--toolbar-focus-border, rgba(0, 255, 255, 0.85));
  box-shadow: 0 0 0 2px rgba(0, 255, 255, 0.18), inset 0 0 0 1px rgba(176, 230, 255, 0.1);
}

.toolbar-input {
  flex: 1 1 220px;
  min-width: 180px;
  height: 30px;
  border: 1px solid rgba(0, 255, 255, 0.2);
  background: linear-gradient(135deg, rgba(25, 46, 74, 0.9), rgba(12, 24, 43, 0.9));
  color: #d8f5ff;
  padding: 0 10px;
  font-family: var(--font-mono);
  font-size: 0.74rem;
  letter-spacing: 0.04em;
  outline: none;
  box-shadow: inset 0 0 0 1px rgba(160, 228, 255, 0.08);
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease, background 0.18s ease;
}

.toolbar-input::placeholder {
  color: var(--toolbar-placeholder, #b9d6ea);
}

.toolbar-input:focus {
  border-color: var(--toolbar-focus-border, rgba(0, 255, 255, 0.85));
  box-shadow: inset 0 0 0 1px rgba(175, 235, 255, 0.14);
}

.toolbar-button {
  height: 30px;
  min-width: 102px;
  padding: 0 12px;
  border: 1px solid rgba(0, 255, 255, 0.46);
  background: linear-gradient(130deg, rgba(20, 64, 88, 0.86), rgba(5, 28, 58, 0.84));
  color: #e0f4ff;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  white-space: nowrap;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, color 0.18s ease, background 0.18s ease;
  box-shadow: inset 0 0 0 1px rgba(162, 229, 255, 0.1);
}

.toolbar-button:hover:not(:disabled) {
  border-color: rgba(0, 255, 255, 0.86);
  color: #ffffff;
  box-shadow: 0 0 8px rgba(0, 255, 255, 0.14), inset 0 0 0 1px rgba(162, 229, 255, 0.12);
  transform: translateY(-1px);
}

.toolbar-button:active:not(:disabled) {
  transform: translateY(0);
}

.toolbar-button.active {
  border-color: rgba(0, 255, 204, 0.86);
  color: #dfffee;
  background: linear-gradient(135deg, rgba(0, 255, 204, 0.2), rgba(5, 33, 59, 0.84));
  box-shadow: 0 0 10px rgba(0, 255, 204, 0.14), inset 0 0 0 1px rgba(180, 255, 228, 0.12);
}

.toolbar-button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.toolbar-button--primary {
  border-color: rgba(0, 255, 255, 0.62);
  color: #e9fdff;
  background: linear-gradient(135deg, rgba(0, 255, 255, 0.18), rgba(7, 39, 65, 0.86));
}

.topology-tooltip {
  position: absolute;
  z-index: 10;
  pointer-events: none;
  min-width: 158px;
  max-width: 220px;
  padding: 8px 11px;
  border-radius: 5px;
  border: 1px solid rgba(128, 200, 255, 0.44);
  background: linear-gradient(140deg, rgba(190, 233, 255, 0.14), rgba(4, 12, 28, 0.88));
  box-shadow: 0 6px 22px rgba(0, 0, 0, 0.46), inset 0 0 0 1px rgba(170, 228, 255, 0.16);
  backdrop-filter: blur(9px) saturate(126%);
  color: #d8f5ff;
  transform: translate(0, 0);
  overflow: hidden;
  transition: opacity 0.18s ease, transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.topology-tooltip::after {
  content: '';
  position: absolute;
  inset: -20% auto -20% -45%;
  width: 46%;
  background: linear-gradient(90deg, transparent, rgba(186, 235, 255, 0.24), transparent);
  transform: skewX(-18deg);
  animation: glass-sweep 3.6s ease-in-out infinite;
  pointer-events: none;
}

.topology-tooltip--locked {
  border-color: rgba(0, 255, 157, 0.45);
  box-shadow: 0 0 0 1px rgba(0, 255, 157, 0.18), 0 4px 14px rgba(0, 0, 0, 0.5);
}

.tooltip-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.tooltip-title {
  font-weight: 700;
  color: #00e5ff;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.05em;
}

.tooltip-badge {
  padding: 1px 5px;
  border-radius: 999px;
  border: 1px solid rgba(0, 255, 157, 0.34);
  background: rgba(0, 255, 157, 0.08);
  color: #b8ffe4;
  font-size: 0.48rem;
  font-family: var(--font-mono);
  letter-spacing: 0.08em;
}

.tooltip-type,
.tooltip-metric,
.tooltip-meta {
  font-family: var(--font-mono);
  font-size: 0.56rem;
}

.tooltip-type {
  color: #7ba7bc;
  text-transform: uppercase;
}

.tooltip-metric {
  margin-top: 2px;
  color: #b8deea;
}

.tooltip-energy {
  position: relative;
  height: 5px;
  margin-top: 5px;
  border: 1px solid rgba(137, 204, 255, 0.28);
  background: rgba(10, 26, 48, 0.72);
  border-radius: 999px;
  overflow: hidden;
}

.tooltip-energy-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #22d3ff, #5ba8ff);
  box-shadow: 0 0 8px rgba(56, 184, 255, 0.5);
  transform-origin: left center;
  animation: energy-pulse 1.8s ease-in-out infinite;
}

.tooltip-meta {
  margin-top: 5px;
  color: rgba(151, 215, 236, 0.62);
  letter-spacing: 0.08em;
}

.topology-status {
  position: absolute;
  left: 10px;
  bottom: 10px;
  z-index: 9;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
  pointer-events: none;
  animation: panel-slide-in 640ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.status-chip,
.status-summary {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 8px;
  border: 1px solid rgba(0, 229, 255, 0.22);
  background: linear-gradient(132deg, rgba(197, 233, 255, 0.11), rgba(6, 24, 48, 0.74));
  color: #97d7ec;
  font-family: var(--font-mono);
  font-size: 0.5rem;
  letter-spacing: 0.08em;
  box-shadow: inset 0 0 0 1px rgba(160, 228, 255, 0.04);
  transition: border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.status-chip {
  color: #ccffe9;
  border-color: rgba(0, 255, 157, 0.26);
}

.topology-legend {
  position: absolute;
  right: 10px;
  bottom: 10px;
  z-index: 9;
  display: flex;
  gap: 8px;
  pointer-events: none;
  animation: panel-slide-in 700ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.legend-block {
  min-width: 168px;
  padding: 7px 9px;
  border: 1px solid rgba(118, 197, 255, 0.34);
  border-radius: 5px;
  background: linear-gradient(135deg, rgba(192, 231, 255, 0.1), rgba(8, 29, 55, 0.76));
  backdrop-filter: blur(8px) saturate(120%);
  position: relative;
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(160, 228, 255, 0.04);
}

.legend-block::after {
  content: '';
  position: absolute;
  top: -30%;
  left: -42%;
  width: 38%;
  height: 160%;
  background: linear-gradient(90deg, transparent, rgba(201, 236, 255, 0.18), transparent);
  transform: skewX(-16deg);
  animation: glass-sweep 4.8s ease-in-out infinite;
  pointer-events: none;
}

.legend-title {
  color: #b4efff;
  font-family: var(--font-mono);
  font-size: 0.54rem;
  letter-spacing: 0.1em;
  margin-bottom: 6px;
}

.legend-item {
  display: grid;
  grid-template-columns: 10px auto 1fr;
  align-items: center;
  column-gap: 6px;
  margin-bottom: 4px;
}

.legend-item--line {
  grid-template-columns: 22px auto;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.legend-line {
  width: 20px;
  height: 2px;
  border-radius: 2px;
}

.legend-label {
  color: #d4f6ff;
  font-family: var(--font-mono);
  font-size: 0.56rem;
  letter-spacing: 0.05em;
}

.legend-note {
  color: #7fa8b6;
  font-family: var(--font-mono);
  font-size: 0.5rem;
  text-align: right;
}

.legend-range {
  margin-top: 2px;
  color: #9ddbf1;
  font-family: var(--font-mono);
  font-size: 0.52rem;
  letter-spacing: 0.05em;
}

.legend-note--meta {
  margin-top: 2px;
  text-align: left;
}

.legend-divider {
  margin: 0 5px;
  color: rgba(125, 176, 197, 0.75);
}

/* ── Risk level tooltip styles ──────────────────── */
.tooltip-risk {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 3px;
  font-family: var(--font-mono);
  font-size: 0.54rem;
  letter-spacing: 0.07em;
  font-weight: 700;
}

.tooltip-risk-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tooltip-risk--critical { color: #ff1a3a; }
.tooltip-risk--critical .tooltip-risk-dot { background: #ff1a3a; box-shadow: 0 0 6px #ff1a3a; }

.tooltip-risk--high { color: #ff6622; }
.tooltip-risk--high .tooltip-risk-dot { background: #ff4400; box-shadow: 0 0 6px #ff4400; }

.tooltip-risk--medium { color: #ffcc44; }
.tooltip-risk--medium .tooltip-risk-dot { background: #ffaa00; box-shadow: 0 0 5px #ffaa00; }

.tooltip-risk--low,
.tooltip-risk--info { color: #7fa8b6; }
.tooltip-risk--low .tooltip-risk-dot,
.tooltip-risk--info .tooltip-risk-dot { background: #00b8ff; box-shadow: 0 0 4px #00b8ff; }

/* ── Risk level legend extras ────────────────────── */
.legend-separator {
  height: 1px;
  background: rgba(0, 229, 255, 0.14);
  margin: 6px 0;
}

.legend-title--sub {
  font-size: 0.47rem;
  color: rgba(180, 239, 255, 0.7);
  margin-bottom: 4px;
}

.legend-dot--risk {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

@keyframes glass-sweep {
  0% { left: -48%; opacity: 0; }
  12% { opacity: 1; }
  30% { left: 128%; opacity: 0; }
  100% { left: 128%; opacity: 0; }
}

@keyframes panel-slide-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes energy-pulse {
  0% { filter: brightness(0.9); }
  50% { filter: brightness(1.18); }
  100% { filter: brightness(0.9); }
}

@media (max-width: 900px) {
  .topology-filter-bar {
    gap: 6px;
  }

  .filter-label,
  .filter-chip {
    font-size: 11px;
  }

  .filter-chip {
    min-height: 26px;
    padding: 0 10px;
  }

  .topology-toolbar {
    left: 8px;
    right: 8px;
  }

  .toolbar-search,
  .toolbar-actions {
    width: 100%;
  }

  .toolbar-search {
    min-width: 0;
  }

  .toolbar-input {
    min-width: 0;
  }

  .topology-legend {
    left: 10px;
    right: 10px;
    bottom: 8px;
    flex-direction: column;
  }

  .legend-block {
    min-width: 0;
  }
}
</style>
