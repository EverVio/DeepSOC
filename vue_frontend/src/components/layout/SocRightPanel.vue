<!--
  组件职责：承载右侧信息面板并展示辅助状态信息。
  业务模块：布局侧边模块
  主要数据流：统计/状态 props -> 右侧面板展示
-->

<template>
  <div class="soc-right-panel">
    <div ref="radarPanelRef" class="panel-host">
      <FuiCard title="THREAT RADAR" class="chart-card">
        <template #actions>
          <button
            type="button"
            class="panel-action-btn"
            :aria-label="isPanelActive('radar') ? 'Exit fullscreen THREAT RADAR' : 'Expand THREAT RADAR'"
            @click="toggleChartPanel('radar')"
          >
            <svg v-if="isPanelActive('radar')" viewBox="0 0 16 16" class="action-icon" aria-hidden="true">
              <path d="M4 4h8v8H4z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <svg v-else viewBox="0 0 16 16" class="action-icon" aria-hidden="true">
              <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </template>
        <ThreatRadarChart :stats="dashboardStats" :loading="statsLoading" />
      </FuiCard>
    </div>

    <div ref="streamPanelRef" class="panel-host">
      <FuiCard title="LOG INGEST STREAM" class="chart-card">
        <template #actions>
          <button
            type="button"
            class="panel-action-btn"
            :aria-label="isPanelActive('stream') ? 'Exit fullscreen LOG INGEST STREAM' : 'Expand LOG INGEST STREAM'"
            @click="toggleChartPanel('stream')"
          >
            <svg v-if="isPanelActive('stream')" viewBox="0 0 16 16" class="action-icon" aria-hidden="true">
              <path d="M4 4h8v8H4z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <svg v-else viewBox="0 0 16 16" class="action-icon" aria-hidden="true">
              <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </template>
        <LogInflowChart :stats="dashboardStats" :loading="statsLoading" />
      </FuiCard>
    </div>

    <div ref="categoryPanelRef" class="panel-host">
      <FuiCard title="CATEGORY DISTRIBUTION" class="chart-card category-card">
        <template #actions>
          <button
            type="button"
            class="panel-action-btn"
            :aria-label="isPanelActive('category') ? 'Exit fullscreen CATEGORY DISTRIBUTION' : 'Expand CATEGORY DISTRIBUTION'"
            @click="toggleChartPanel('category')"
          >
            <svg v-if="isPanelActive('category')" viewBox="0 0 16 16" class="action-icon" aria-hidden="true">
              <path d="M4 4h8v8H4z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <svg v-else viewBox="0 0 16 16" class="action-icon" aria-hidden="true">
              <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </template>
        <div class="summary-strip">
          <span>RECORDS {{ dashboardStats.summary?.total_records || 0 }}</span>
          <span>SOURCES {{ dashboardStats.summary?.total_sources || 0 }}</span>
          <span>CAT {{ dashboardStats.summary?.total_categories || 0 }}</span>
        </div>
        <CategoryDonutChart :stats="dashboardStats" :loading="statsLoading" />
      </FuiCard>
    </div>
  </div>

  <NModal :show="Boolean(fallbackPanelKey)" :mask-closable="true" :auto-focus="false" @update:show="handleModalVisibleChange">
    <div class="chart-modal-wrap">
      <NCard class="chart-modal-card" :bordered="false" embedded>
        <template #header>
          <span class="chart-modal-title">{{ expandedTitle }}</span>
        </template>
        <template #header-extra>
          <NButton
            class="panel-action-btn panel-action-btn--close"
            quaternary
            circle
            aria-label="Close expanded chart"
            @click="closeExpanded"
          >
            <XIcon class="action-icon" />
          </NButton>
        </template>

        <div class="expanded-chart-content" v-if="fallbackPanelKey === 'radar'">
          <ThreatRadarChart :stats="dashboardStats" :loading="statsLoading" />
        </div>

        <div class="expanded-chart-content" v-else-if="fallbackPanelKey === 'stream'">
          <LogInflowChart :stats="dashboardStats" :loading="statsLoading" />
        </div>

        <div class="expanded-chart-content" v-else>
          <div class="summary-strip summary-strip--expanded">
            <span>RECORDS {{ dashboardStats.summary?.total_records || 0 }}</span>
            <span>SOURCES {{ dashboardStats.summary?.total_sources || 0 }}</span>
            <span>CAT {{ dashboardStats.summary?.total_categories || 0 }}</span>
          </div>
          <div class="expanded-chart-fill">
            <CategoryDonutChart :stats="dashboardStats" :loading="statsLoading" />
          </div>
        </div>
      </NCard>
    </div>
  </NModal>
</template>

<script setup>
import { computed, ref } from 'vue'
import { NButton, NCard, NModal } from 'naive-ui'
import { XIcon } from 'vue-tabler-icons'
import FuiCard from '../FuiCard.vue'
import LogInflowChart from '../charts/LogInflowChart.vue'
import ThreatRadarChart from '../charts/ThreatRadarChart.vue'
import CategoryDonutChart from '../charts/CategoryDonutChart.vue'
import { useFullscreenPanel } from '../../composables/useFullscreenPanel'

defineProps({
  dashboardStats: { type: Object, default: () => ({}) },
  statsLoading: { type: Boolean, default: false },
})

const radarPanelRef = ref(null)
const streamPanelRef = ref(null)
const categoryPanelRef = ref(null)

const { fallbackPanelKey, togglePanel, closeFallbackPanel, isPanelActive } = useFullscreenPanel({
  radar: radarPanelRef,
  stream: streamPanelRef,
  category: categoryPanelRef,
})

const expandedTitle = computed(() => {
  const titleMap = {
    radar: 'THREAT RADAR',
    stream: 'LOG INGEST STREAM',
    category: 'CATEGORY DISTRIBUTION',
  }
  return titleMap[fallbackPanelKey.value] || ''
})

const toggleChartPanel = (panelKey) => {
  togglePanel(panelKey)
}

const closeExpanded = () => {
  closeFallbackPanel()
}

const handleModalVisibleChange = (show) => {
  if (!show) {
    closeExpanded()
  }
}
</script>

<style scoped>
.soc-right-panel {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.panel-host {
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.chart-card {
  min-height: 240px;
}

.chart-card :deep(.fui-card-header) {
  padding-right: 1.2rem;
}

.chart-card :deep(.fui-card-header-right) {
  position: relative;
  z-index: 6;
  padding-right: 0.35rem;
}


.panel-host:fullscreen,
.panel-host:-webkit-full-screen {
  background: #050814;
  padding: 0.9rem;
}

.panel-host:fullscreen .chart-card,
.panel-host:-webkit-full-screen .chart-card {
  height: 100%;
  min-height: 0;
}

.panel-host:fullscreen .chart-card :deep(.fui-card-body),
.panel-host:-webkit-full-screen .chart-card :deep(.fui-card-body),
.panel-host:fullscreen .chart-wrap,
.panel-host:-webkit-full-screen .chart-wrap,
.panel-host:fullscreen .chart-canvas,
.panel-host:-webkit-full-screen .chart-canvas {
  min-height: 0;
  height: 100%;
}

.panel-action-btn {
  width: 24px;
  min-width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 229, 255, 0.1);
  border: 1px solid rgba(0, 229, 255, 0.42);
  color: var(--neon-cyan);
  cursor: pointer;
  position: relative;
  z-index: 7;
  transition: background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.panel-action-btn:hover {
  background: rgba(0, 229, 255, 0.22);
  border-color: rgba(0, 229, 255, 0.75);
  transform: translateY(-1px);
}

.action-icon {
  width: 14px;
  height: 14px;
  display: block;
}

.panel-action-btn :deep(svg),
.panel-action-btn :deep(svg *) {
  color: currentColor;
  stroke: currentColor;
}

.chart-card :deep(.fui-card-body) {
  min-height: 0;
  display: flex;
  flex-direction: column;
}

:deep(.n-modal-mask) {
  background: rgba(3, 8, 18, 0.92);
}

.chart-modal-wrap {
  width: min(1120px, 92vw);
}

.chart-modal-card {
  height: min(76vh, 820px);
  min-height: 520px;
  border: 1px solid rgba(0, 229, 255, 0.3);
  background: rgba(7, 15, 30, 0.95);
}

.chart-modal-card :deep(.n-card-header) {
  border-bottom: 1px solid rgba(0, 229, 255, 0.2);
  background: linear-gradient(90deg, rgba(0, 229, 255, 0.09), transparent 60%);
}

.chart-modal-card :deep(.n-card__content) {
  min-height: 0;
  height: calc(100% - 56px);
  display: flex;
  flex-direction: column;
  padding-top: 0.7rem;
}

.chart-modal-title {
  font-family: var(--font-ui);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.11em;
  color: var(--neon-cyan);
}

.panel-action-btn--close {
  width: 24px;
  height: 24px;
}

.expanded-chart-content {
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.expanded-chart-fill {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.chart-modal-card :deep(.chart-wrap) {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.chart-modal-card :deep(.chart-canvas) {
  min-height: 0;
  flex: 1;
}

.category-card {
  display: flex;
  flex-direction: column;
}

.summary-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.55rem;
}

.summary-strip span {
  border: 1px solid rgba(0, 229, 255, 0.22);
  background: rgba(0, 229, 255, 0.08);
  color: #97d7ec;
  font-family: var(--font-mono);
  font-size: 0.57rem;
  letter-spacing: 0.08em;
  padding: 0.12rem 0.35rem;
}

.summary-strip--expanded {
  margin-bottom: 0.75rem;
}

@media (max-width: 1024px) {
  .chart-modal-wrap {
    width: min(980px, 96vw);
  }

  .chart-modal-card {
    height: min(70vh, 760px);
    min-height: 420px;
  }
}
</style>
