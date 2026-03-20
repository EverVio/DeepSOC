<template>
  <div class="dashboard-page">
    <n-grid :x-gap="14" :y-gap="14" cols="1" responsive="screen">
      <n-gi>
        <div ref="topologyPanelRef" class="topology-panel-host" v-if="!isTopologyCollapsed">
          <FuiCard title="GLOBAL ATTACK TOPOLOGY" class="center-topology-card" :glow="true">
            <template #actions>
              <button
                class="fui-icon-btn"
                :title="isPanelActive('topology') ? '退出全屏拓扑图' : '全屏拓扑图'"
                @click="toggleTopologyFullscreen"
              >
                <MinimizeIcon v-if="isPanelActive('topology')" class="btn-icon" />
                <MaximizeIcon v-else class="btn-icon" />
              </button>
              <button class="fui-icon-btn" @click="toggleTopology" title="折叠拓扑图">
                <ChevronUpIcon class="btn-icon" />
              </button>
            </template>
            <TopologyScene :topology="dashboardStats.topology" />
          </FuiCard>
        </div>

        <div v-else class="topology-collapsed-bar">
          <button class="topology-restore-btn" @click="toggleTopology">
            <ChevronDownIcon class="btn-icon" />
            SHOW GLOBAL ATTACK TOPOLOGY
          </button>
        </div>
      </n-gi>

      <n-gi>
        <n-grid cols="1 s:1 m:3" responsive="screen" :x-gap="14" :y-gap="14">
          <n-gi>
            <FuiCard title="THREAT RADAR" class="chart-card">
              <ThreatRadarChart :stats="dashboardStats" :loading="statsLoading" />
            </FuiCard>
          </n-gi>

          <n-gi>
            <FuiCard title="LOG INGEST STREAM" class="chart-card">
              <LogInflowChart :stats="dashboardStats" :loading="statsLoading" />
            </FuiCard>
          </n-gi>

          <n-gi>
            <FuiCard title="CATEGORY DISTRIBUTION" class="chart-card">
              <div class="summary-strip">
                <span>RECORDS {{ dashboardStats.summary?.total_records || 0 }}</span>
                <span>SOURCES {{ dashboardStats.summary?.total_sources || 0 }}</span>
                <span>CAT {{ dashboardStats.summary?.total_categories || 0 }}</span>
              </div>
              <CategoryDonutChart :stats="dashboardStats" :loading="statsLoading" />
            </FuiCard>
          </n-gi>
        </n-grid>
      </n-gi>
    </n-grid>

    <NModal
      :show="fallbackPanelKey === 'topology'"
      :mask-closable="true"
      :auto-focus="false"
      @update:show="handleTopologyModalChange"
    >
      <div class="topology-modal-wrap">
        <NCard class="topology-modal-card" :bordered="false" embedded>
          <template #header>
            <span class="topology-modal-title">GLOBAL ATTACK TOPOLOGY</span>
          </template>
          <template #header-extra>
            <NButton
              class="fui-icon-btn"
              quaternary
              circle
              aria-label="Close topology fullscreen"
              @click="closeTopologyFallback"
            >
              <XIcon class="btn-icon" />
            </NButton>
          </template>
          <div class="topology-modal-content">
            <TopologyScene :topology="dashboardStats.topology" />
          </div>
          <div class="topology-modal-content" v-if="fallbackPanelKey === 'topology'">
            <TopologyScene :topology="dashboardStats.topology" />
          </div>
        </NCard>
      </div>
    </NModal>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { NButton, NCard, NGi, NGrid, NModal } from 'naive-ui'
import {
  ChevronDownIcon,
  ChevronUpIcon,
  MaximizeIcon,
  MinimizeIcon,
  XIcon,
} from 'vue-tabler-icons'
import api from '../api'
import FuiCard from '../components/FuiCard.vue'
import TopologyScene from '../components/TopologyScene.vue'
import CategoryDonutChart from '../components/charts/CategoryDonutChart.vue'
import LogInflowChart from '../components/charts/LogInflowChart.vue'
import ThreatRadarChart from '../components/charts/ThreatRadarChart.vue'
import { useDashboardStats } from '../composables/useDashboardStats'
import { useFullscreenPanel } from '../composables/useFullscreenPanel'

const isTopologyCollapsed = ref(false)
const topologyPanelRef = ref(null)

const { dashboardStats, statsLoading } = useDashboardStats(api)
const { fallbackPanelKey, togglePanel, closeFallbackPanel, isPanelActive } = useFullscreenPanel({
  topology: topologyPanelRef,
})

const toggleTopology = () => {
  isTopologyCollapsed.value = !isTopologyCollapsed.value
}

const toggleTopologyFullscreen = () => {
  togglePanel('topology')
}

const closeTopologyFallback = () => {
  closeFallbackPanel()
}

const handleTopologyModalChange = (show) => {
  if (!show) {
    closeTopologyFallback()
  }
}
</script>

<style scoped>
.dashboard-page {
  min-height: 0;
  height: 100%;
  overflow: auto;
  padding-right: 0.2rem;
}

.topology-panel-host {
  min-height: 220px;
  display: flex;
  flex-direction: column;
}

.topology-panel-host:fullscreen,
.topology-panel-host:-webkit-full-screen {
  background: #050814;
  padding: 0.9rem;
}

.topology-panel-host:fullscreen .center-topology-card,
.topology-panel-host:-webkit-full-screen .center-topology-card {
  min-height: 0;
  height: 100%;
}

.topology-panel-host:fullscreen .center-topology-card :deep(.fui-card-body),
.topology-panel-host:-webkit-full-screen .center-topology-card :deep(.fui-card-body),
.topology-panel-host:fullscreen :deep(.topology-scene),
.topology-panel-host:-webkit-full-screen :deep(.topology-scene) {
  min-height: 0;
  height: 100%;
}

.center-topology-card {
  min-height: 220px;
  height: clamp(260px, 46vh, 520px);
}

.center-topology-card :deep(.fui-card-body) {
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.chart-card {
  min-height: 240px;
}

.chart-card :deep(.fui-card-body) {
  min-height: 0;
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

.topology-collapsed-bar {
  padding: 0.2rem 0;
}

.topology-restore-btn {
  width: 100%;
  height: 34px;
  border: 1px dashed rgba(0, 229, 255, 0.35);
  background: rgba(0, 229, 255, 0.05);
  color: #8fd0e8;
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
}

.topology-restore-btn:hover {
  border-color: rgba(0, 229, 255, 0.62);
  color: var(--neon-cyan);
  box-shadow: inset 0 0 10px rgba(0, 229, 255, 0.12);
}

.fui-icon-btn {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(0, 229, 255, 0.24);
  background: rgba(0, 229, 255, 0.06);
  color: var(--neon-cyan);
  transition: all 0.2s ease;
}

.fui-icon-btn:hover {
  border-color: rgba(0, 229, 255, 0.52);
  box-shadow: 0 0 10px rgba(0, 229, 255, 0.18);
}

.btn-icon {
  width: 14px;
  height: 14px;
  display: block;
  flex-shrink: 0;
  color: currentColor;
}

.fui-icon-btn :deep(svg),
.fui-icon-btn :deep(svg *),
.topology-restore-btn :deep(svg),
.topology-restore-btn :deep(svg *) {
  color: currentColor;
  stroke: currentColor;
}

:deep(.n-modal-mask) {
  background: rgba(3, 8, 18, 0.92);
}

.topology-modal-wrap {
  width: min(1180px, 94vw);
}

.topology-modal-card {
  height: min(82vh, 900px);
  min-height: 520px;
  border: 1px solid rgba(0, 229, 255, 0.3);
  background: rgba(7, 15, 30, 0.95);
}

.topology-modal-card :deep(.n-card-header) {
  border-bottom: 1px solid rgba(0, 229, 255, 0.2);
  background: linear-gradient(90deg, rgba(0, 229, 255, 0.09), transparent 60%);
}

.topology-modal-card :deep(.n-card__content) {
  min-height: 0;
  height: calc(100% - 56px);
  padding-top: 0.7rem;
  display: flex;
  flex-direction: column;
}

.topology-modal-title {
  font-family: var(--font-ui);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.11em;
  color: var(--neon-cyan);
}

.topology-modal-content {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.topology-modal-content :deep(.topology-scene) {
  min-height: 0;
  height: 100%;
}

@media (max-width: 1024px) {
  .topology-modal-wrap {
    width: min(980px, 96vw);
  }

  .topology-modal-card {
    height: min(72vh, 760px);
    min-height: 430px;
  }
}

@media (max-width: 640px) {
  .topology-restore-btn {
    font-size: 0.55rem;
  }
}
</style>
