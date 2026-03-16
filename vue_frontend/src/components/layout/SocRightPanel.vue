<template>
  <div class="soc-right-panel">
    <FuiCard title="THREAT RADAR" class="chart-card">
      <template #actions>
        <button
          type="button"
          class="panel-action-btn"
          aria-label="Expand THREAT RADAR"
          @click="openExpanded('radar')"
        >
          <svg viewBox="0 0 16 16" class="action-icon" aria-hidden="true">
            <path d="M1 6V1h5v2H3v3H1zm14 0h-2V3h-3V1h5v5zM1 10h2v3h3v2H1v-5zm12 5v-2h-3v-2h5v4h-2z" />
          </svg>
          <MaximizeIcon class="action-icon" />
        </button>
      </template>
      <ThreatRadarChart :stats="dashboardStats" :loading="statsLoading" />
    </FuiCard>

    <FuiCard title="LOG INGEST STREAM" class="chart-card">
      <template #actions>
        <button
          type="button"
          class="panel-action-btn"
          aria-label="Expand LOG INGEST STREAM"
          @click="openExpanded('stream')"
        >
          <svg viewBox="0 0 16 16" class="action-icon" aria-hidden="true">
            <path d="M1 6V1h5v2H3v3H1zm14 0h-2V3h-3V1h5v5zM1 10h2v3h3v2H1v-5zm12 5v-2h-3v-2h5v4h-2z" />
          </svg>
        </button>
      </template>
      <LogInflowChart :stats="dashboardStats" :loading="statsLoading" />
    </FuiCard>

    <FuiCard title="CATEGORY DISTRIBUTION" class="chart-card category-card">
      <template #actions>
        <button
          type="button"
          class="panel-action-btn"
          aria-label="Expand CATEGORY DISTRIBUTION"
          @click="openExpanded('category')"
        >
          <svg viewBox="0 0 16 16" class="action-icon" aria-hidden="true">
            <path d="M1 6V1h5v2H3v3H1zm14 0h-2V3h-3V1h5v5zM1 10h2v3h3v2H1v-5zm12 5v-2h-3v-2h5v4h-2z" />
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

  <Teleport to="body">
    <div
      v-if="expandedPanel"
      class="chart-modal-mask"
      role="dialog"
      aria-modal="true"
      @click.self="closeExpanded"
    >
      <div class="chart-modal-wrap">
        <FuiCard :title="expandedTitle" class="chart-card chart-card--expanded">
          <template #actions>
          <button
            type="button"
            class="panel-action-btn panel-action-btn--close"
            aria-label="Close expanded chart"
            @click="closeExpanded"
          >
            <XIcon class="action-icon" />
          </button>
          </template>

          <div class="expanded-chart-content" v-if="expandedPanel === 'radar'">
            <ThreatRadarChart :stats="dashboardStats" :loading="statsLoading" />
          </div>

          <div class="expanded-chart-content" v-else-if="expandedPanel === 'stream'">
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
        </FuiCard>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref } from 'vue'
import { MaximizeIcon, XIcon } from 'vue-tabler-icons'
import FuiCard from '../FuiCard.vue'
import LogInflowChart from '../charts/LogInflowChart.vue'
import ThreatRadarChart from '../charts/ThreatRadarChart.vue'
import CategoryDonutChart from '../charts/CategoryDonutChart.vue'

defineProps({
  dashboardStats: { type: Object, default: () => ({}) },
  statsLoading: { type: Boolean, default: false },
})

const expandedPanel = ref('')

const expandedTitle = computed(() => {
  const titleMap = {
    radar: 'THREAT RADAR',
    stream: 'LOG INGEST STREAM',
    category: 'CATEGORY DISTRIBUTION',
  }
  return titleMap[expandedPanel.value] || ''
})

const openExpanded = (panelKey) => {
  expandedPanel.value = panelKey
}

const closeExpanded = () => {
  expandedPanel.value = ''
}
</script>

<style scoped>
.soc-right-panel {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.chart-card {
  min-height: 240px;
}

.panel-action-btn {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 229, 255, 0.1);
  border: 1px solid rgba(0, 229, 255, 0.42);
  color: var(--neon-cyan);
  cursor: pointer;
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

.chart-modal-mask {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(3, 8, 18, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.2rem;
}

.chart-modal-wrap {
  width: min(1120px, 92vw);
}

.chart-card--expanded {
  height: min(76vh, 820px);
  min-height: 520px;
}

.chart-card--expanded :deep(.scanline-overlay) {
  display: none;
}

.chart-card--expanded :deep(.corner) {
  opacity: 0.35;
}

.chart-card--expanded :deep(.fui-card-body) {
  min-height: 0;
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

.chart-card--expanded :deep(.chart-wrap) {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.chart-card--expanded :deep(.chart-canvas) {
  min-height: 0;
  flex: 1;
}

.panel-action-btn--close {
  font-family: var(--font-ui);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1;
}

.category-card {
  display: flex;
  flex-direction: column;
}

.summary-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.38rem;
}

.summary-strip span {
  border: 1px solid rgba(0, 229, 255, 0.18);
  padding: 0.2rem 0.44rem;
  font-family: var(--font-mono);
  font-size: 0.56rem;
  letter-spacing: 0.07em;
  color: #89a8ba;
}

.summary-strip--expanded {
  margin-bottom: 0.6rem;
}

@media (max-width: 1024px) {
  .chart-card {
    min-height: 280px;
  }

  .chart-modal-wrap {
    width: min(980px, 96vw);
  }

  .chart-card--expanded {
    height: min(72vh, 760px);
    min-height: 430px;
  }
}
</style>
