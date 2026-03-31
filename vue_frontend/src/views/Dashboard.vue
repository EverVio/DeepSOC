<!--
  组件职责：安全态势总览页，组合拓扑与图表卡片并驱动标题动效。
  业务模块：态势看板页面
  主要数据流：dashboardStats -> 指标与图表组件 -> 看板展示
-->

<template>
  <div class="dashboard-page">
    <n-grid :x-gap="14" :y-gap="14" cols="1" responsive="screen">
      <n-gi>
        <div ref="topologyPanelRef" class="topology-panel-host" v-if="!isTopologyCollapsed">
          <FuiCard :title="topologyTitle" class="center-topology-card" :glow="true">
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
            <div ref="radarPanelRef" class="chart-panel-host">
              <ChartDrillGuidance
                :banner-visible="isBannerVisible('radar')"
                :intro-visible="isIntroVisible('radar')"
                banner-text="点击图例或高亮区域进入分析终端 · Esc 退出"
                intro-title="雷达图分析入口"
                intro-text="进入全屏后，可点击图例、高亮区域或峰值进入分析终端。"
                @dismiss="dismissIntro('radar')"
              />
              <FuiCard :title="threatRadarTitle" class="chart-card">
                <template #actions>
                  <button
                    class="fui-icon-btn"
                    :title="isPanelActive('radar') ? '退出全屏威胁雷达图' : '全屏威胁雷达图'"
                    @click="toggleChartFullscreen('radar')"
                  >
                    <MinimizeIcon v-if="isPanelActive('radar')" class="btn-icon" />
                    <MaximizeIcon v-else class="btn-icon" />
                  </button>
                </template>
                <ThreatRadarChart
                  :stats="dashboardStats"
                  :loading="statsLoading"
                  :fullscreen="isPanelActive('radar')"
                  @chart-click="handleRadarChartClick"
                />
              </FuiCard>
            </div>
          </n-gi>

          <n-gi>
            <div ref="streamPanelRef" class="chart-panel-host">
              <ChartDrillGuidance
                :banner-visible="isBannerVisible('stream')"
                :intro-visible="isIntroVisible('stream')"
                banner-text="点击图例或峰值进入分析终端 · Esc 退出"
                intro-title="日志流分析入口"
                intro-text="进入全屏后，点击图例、柱形峰值或折线高点即可跳转分析终端。"
                @dismiss="dismissIntro('stream')"
              />
              <FuiCard :title="logIngestStreamTitle" class="chart-card">
                <template #actions>
                  <button
                    class="fui-icon-btn"
                    :title="isPanelActive('stream') ? '退出全屏日志流入图' : '全屏日志流入图'"
                    @click="toggleChartFullscreen('stream')"
                  >
                    <MinimizeIcon v-if="isPanelActive('stream')" class="btn-icon" />
                    <MaximizeIcon v-else class="btn-icon" />
                  </button>
                </template>
                <LogInflowChart
                  :stats="dashboardStats"
                  :loading="statsLoading"
                  :enable-zoom="isPanelActive('stream')"
                  :fullscreen="isPanelActive('stream')"
                  @chart-click="handleStreamChartClick"
                />
              </FuiCard>
            </div>
          </n-gi>

          <n-gi>
            <div ref="categoryPanelRef" class="chart-panel-host">
              <ChartDrillGuidance
                :banner-visible="isBannerVisible('category')"
                :intro-visible="isIntroVisible('category')"
                banner-text="点击扇区或图例进入分析终端 · Esc 退出"
                intro-title="分类分布分析入口"
                intro-text="进入全屏后，可点击扇区或图例查看对应维度的分析入口。"
                @dismiss="dismissIntro('category')"
              />
              <FuiCard :title="categoryDistributionTitle" class="chart-card">
                <template #actions>
                  <button
                    class="fui-icon-btn"
                    :title="isPanelActive('category') ? '退出全屏分类分布图' : '全屏分类分布图'"
                    @click="toggleChartFullscreen('category')"
                  >
                    <MinimizeIcon v-if="isPanelActive('category')" class="btn-icon" />
                    <MaximizeIcon v-else class="btn-icon" />
                  </button>
                </template>
                <div class="summary-strip">
                  <span>RECORDS <strong class="ticker-value">{{ recordsTicker }}</strong></span>
                  <span>SOURCES <strong class="ticker-value">{{ sourcesTicker }}</strong></span>
                  <span>CAT <strong class="ticker-value">{{ categoriesTicker }}</strong></span>
                </div>
                <CategoryDonutChart
                  :stats="dashboardStats"
                  :loading="statsLoading"
                  :fullscreen="isPanelActive('category')"
                  @chart-click="handleCategoryChartClick"
                />
              </FuiCard>
            </div>
          </n-gi>
        </n-grid>
      </n-gi>
    </n-grid>

    <NModal
      :show="Boolean(fallbackPanelKey)"
      :mask-closable="true"
      :auto-focus="false"
      @update:show="handleFullscreenModalChange"
    >
      <div class="topology-modal-wrap">
        <NCard class="topology-modal-card" :bordered="false" embedded>
          <template #header>
            <span class="topology-modal-title">{{ expandedTitle }}</span>
          </template>
          <template #header-extra>
            <NButton
              class="fui-icon-btn"
              quaternary
              circle
              aria-label="Close fullscreen panel"
              @click="closeTopologyFallback"
            >
              <XIcon class="btn-icon" />
            </NButton>
          </template>
          <div class="topology-modal-content" v-if="fallbackPanelKey === 'topology'">
            <TopologyScene :topology="dashboardStats.topology" />
          </div>
          <div class="topology-modal-content" v-else-if="fallbackPanelKey === 'radar'">
            <div class="expanded-chart-fill">
              <ChartDrillGuidance
                :banner-visible="isBannerVisible('radar')"
                :intro-visible="isIntroVisible('radar')"
                banner-text="点击图例或高亮区域进入分析终端 · Esc 退出"
                intro-title="雷达图分析入口"
                intro-text="进入全屏后，可点击图例、高亮区域或峰值进入分析终端。"
                @dismiss="dismissIntro('radar')"
              />
              <ThreatRadarChart
                :stats="dashboardStats"
                :loading="statsLoading"
                :fullscreen="true"
                @chart-click="handleRadarChartClick"
              />
            </div>
          </div>
          <div class="topology-modal-content" v-else-if="fallbackPanelKey === 'stream'">
            <div class="expanded-chart-fill">
              <ChartDrillGuidance
                :banner-visible="isBannerVisible('stream')"
                :intro-visible="isIntroVisible('stream')"
                banner-text="点击图例或峰值进入分析终端 · Esc 退出"
                intro-title="日志流分析入口"
                intro-text="进入全屏后，点击图例、柱形峰值或折线高点即可跳转分析终端。"
                @dismiss="dismissIntro('stream')"
              />
              <LogInflowChart
                :stats="dashboardStats"
                :loading="statsLoading"
                :enable-zoom="true"
                :fullscreen="true"
                @chart-click="handleStreamChartClick"
              />
            </div>
          </div>
          <div class="topology-modal-content" v-else>
            <div class="summary-strip summary-strip--modal">
              <span>RECORDS <strong class="ticker-value">{{ recordsTicker }}</strong></span>
              <span>SOURCES <strong class="ticker-value">{{ sourcesTicker }}</strong></span>
              <span>CAT <strong class="ticker-value">{{ categoriesTicker }}</strong></span>
            </div>
            <div class="expanded-chart-fill">
              <ChartDrillGuidance
                :banner-visible="isBannerVisible('category')"
                :intro-visible="isIntroVisible('category')"
                banner-text="点击扇区或图例进入分析终端 · Esc 退出"
                intro-title="分类分布分析入口"
                intro-text="进入全屏后，可点击扇区或图例查看对应维度的分析入口。"
                @dismiss="dismissIntro('category')"
              />
              <CategoryDonutChart
                :stats="dashboardStats"
                :loading="statsLoading"
                :fullscreen="true"
                @chart-click="handleCategoryChartClick"
              />
            </div>
          </div>
        </NCard>
      </div>
    </NModal>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useTransition } from '@vueuse/core'
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
import ChartDrillGuidance from '../components/layout/ChartDrillGuidance.vue'
import TopologyScene from '../components/TopologyScene.vue'
import CategoryDonutChart from '../components/charts/CategoryDonutChart.vue'
import LogInflowChart from '../components/charts/LogInflowChart.vue'
import ThreatRadarChart from '../components/charts/ThreatRadarChart.vue'
import { buildAnalysisJumpEntry } from '../composables/useAnalysisJump'
import { useDashboardStats } from '../composables/useDashboardStats'
import { useFullscreenPanel } from '../composables/useFullscreenPanel'
import { useChartDrillGuidance } from '../composables/useChartDrillGuidance'
import { useTextScramble } from '../composables/useTextScramble'
import { useRouter } from 'vue-router'
import { useChatStore } from '../stores/chatStore'

const isTopologyCollapsed = ref(false)
const topologyPanelRef = ref(null)
const radarPanelRef = ref(null)
const streamPanelRef = ref(null)
const categoryPanelRef = ref(null)
// 标题文本由乱码动画驱动，避免直接写死在模板中
const topologyTitle = ref('GLOBAL ATTACK TOPOLOGY')
// 图表卡标题响应式状态
const threatRadarTitle = ref('THREAT RADAR')
const logIngestStreamTitle = ref('LOG INGEST STREAM')
const categoryDistributionTitle = ref('CATEGORY DISTRIBUTION')

const { dashboardStats, statsLoading } = useDashboardStats(api)
const { fallbackPanelKey, togglePanel, closeFallbackPanel, isPanelActive } = useFullscreenPanel({
  topology: topologyPanelRef,
  radar: radarPanelRef,
  stream: streamPanelRef,
  category: categoryPanelRef,
})

const {
  showGuidance,
  clearGuidance,
  dismissIntro,
  isBannerVisible,
  isIntroVisible,
} = useChartDrillGuidance()

watch(
  () => isPanelActive('radar'),
  (active) => {
    if (active) showGuidance('radar')
    else clearGuidance('radar')
  },
)

watch(
  () => isPanelActive('stream'),
  (active) => {
    if (active) showGuidance('stream')
    else clearGuidance('stream')
  },
)

watch(
  () => isPanelActive('category'),
  (active) => {
    if (active) showGuidance('category')
    else clearGuidance('category')
  },
)

const expandedTitle = computed(() => {
  const titleMap = {
    topology: topologyTitle.value,
    radar: threatRadarTitle.value,
    stream: logIngestStreamTitle.value,
    category: categoryDistributionTitle.value,
  }
  return titleMap[fallbackPanelKey.value] || ''
})

const router = useRouter()
const chatStore = useChatStore()

const openAnalysisTerminal = (sourceKey, params) => {
  const analysisJumpEntry = buildAnalysisJumpEntry({
    sourceKey,
    params,
    stats: dashboardStats.value,
    sessionId: chatStore.currentSession,
  })

  chatStore.setSessionDraft(chatStore.currentSession, analysisJumpEntry.prompt)
  chatStore.setAnalysisJumpDraft(analysisJumpEntry)
  router.push({ path: '/chat', query: { autoSend: 'true' } })
  closeExpanded()
}

const handleRadarChartClick = (params) => {
  openAnalysisTerminal('radar', params)
}

const handleStreamChartClick = (params) => {
  openAnalysisTerminal('stream', params)
}

const handleCategoryChartClick = (params) => {
  openAnalysisTerminal('category', params)
}

const toggleChartFullscreen = (panelKey) => {
  togglePanel(panelKey)
}

const summaryTargets = {
  records: ref(0),
  sources: ref(0),
  categories: ref(0),
}

const easeOutCubic = (n) => 1 - Math.pow(1 - n, 3)

const recordsTransition = useTransition(summaryTargets.records, {
  duration: 700,
  transition: easeOutCubic,
})

const sourcesTransition = useTransition(summaryTargets.sources, {
  duration: 700,
  transition: easeOutCubic,
})

const categoriesTransition = useTransition(summaryTargets.categories, {
  duration: 700,
  transition: easeOutCubic,
})

const recordsTicker = computed(() => Math.round(recordsTransition.value))
const sourcesTicker = computed(() => Math.round(sourcesTransition.value))
const categoriesTicker = computed(() => Math.round(categoriesTransition.value))

watch(
  () => dashboardStats.value?.summary,
  (summary) => {
    summaryTargets.records.value = Number(summary?.total_records) || 0
    summaryTargets.sources.value = Number(summary?.total_sources) || 0
    summaryTargets.categories.value = Number(summary?.total_categories) || 0
  },
  { immediate: true },
)

const topologyScramble = useTextScramble((value) => {
  topologyTitle.value = value
})
const threatRadarScramble = useTextScramble((value) => {
  threatRadarTitle.value = value
})
const logIngestStreamScramble = useTextScramble((value) => {
  logIngestStreamTitle.value = value
})
const categoryDistributionScramble = useTextScramble((value) => {
  categoryDistributionTitle.value = value
})

const animationTimers = []

onMounted(() => {
  // 启动标题动画，并通过小延迟形成分层入场效果
  topologyScramble.start('GLOBAL ATTACK TOPOLOGY', 300)
  threatRadarScramble.start('THREAT RADAR', 300)
  animationTimers.push(setTimeout(() => {
    logIngestStreamScramble.start('LOG INGEST STREAM', 300)
  }, 50))
  animationTimers.push(setTimeout(() => {
    categoryDistributionScramble.start('CATEGORY DISTRIBUTION', 300)
  }, 100))
})

onBeforeUnmount(() => {
  // 页面离开时回收动画帧，避免后台继续占用资源
  topologyScramble.stop()
  threatRadarScramble.stop()
  logIngestStreamScramble.stop()
  categoryDistributionScramble.stop()
  while (animationTimers.length) {
    clearTimeout(animationTimers.pop())
  }
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

const handleFullscreenModalChange = (show) => {
  if (!show) {
    closeTopologyFallback()
  }
}
</script>

<style scoped>
/* 仪表盘布局与视觉样式 */
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

.chart-panel-host {
  min-height: 220px;
  display: flex;
  flex-direction: column;
  position: relative;
}

.chart-panel-host:fullscreen,
.chart-panel-host:-webkit-full-screen {
  background: #050814;
  padding: 0.9rem;
}

.chart-panel-host:fullscreen .chart-card,
.chart-panel-host:-webkit-full-screen .chart-card {
  height: 100%;
  min-height: 0;
}

.chart-panel-host:fullscreen .chart-card :deep(.fui-card-body),
.chart-panel-host:-webkit-full-screen .chart-card :deep(.fui-card-body),
.chart-panel-host:fullscreen .chart-wrap,
.chart-panel-host:-webkit-full-screen .chart-wrap,
.chart-panel-host:fullscreen .chart-canvas,
.chart-panel-host:-webkit-full-screen .chart-canvas {
  min-height: 0;
  height: 100%;
}

.chart-panel-host:fullscreen .chart-card :deep(.fui-card-header),
.chart-panel-host:-webkit-full-screen .chart-card :deep(.fui-card-header),
.topology-panel-host:fullscreen .center-topology-card :deep(.fui-card-header),
.topology-panel-host:-webkit-full-screen .center-topology-card :deep(.fui-card-header) {
  min-height: 30px;
  padding: 0.36rem 0.72rem;
}

.chart-panel-host:fullscreen .chart-card :deep(.fui-card-title),
.chart-panel-host:-webkit-full-screen .chart-card :deep(.fui-card-title),
.topology-panel-host:fullscreen .center-topology-card :deep(.fui-card-title),
.topology-panel-host:-webkit-full-screen .center-topology-card :deep(.fui-card-title) {
  font-size: 0.62rem;
  letter-spacing: 0.1em;
}

.chart-panel-host:fullscreen .chart-card :deep(.fui-card-header-right),
.chart-panel-host:-webkit-full-screen .chart-card :deep(.fui-card-header-right),
.topology-panel-host:fullscreen .center-topology-card :deep(.fui-card-header-right),
.topology-panel-host:-webkit-full-screen .center-topology-card :deep(.fui-card-header-right) {
  gap: 0.24rem;
}

.chart-panel-host:fullscreen .chart-card :deep(.fui-icon-btn),
.chart-panel-host:-webkit-full-screen .chart-card :deep(.fui-icon-btn),
.topology-panel-host:fullscreen .center-topology-card :deep(.fui-icon-btn),
.topology-panel-host:-webkit-full-screen .center-topology-card :deep(.fui-icon-btn) {
  width: 22px;
  height: 22px;
}

.chart-panel-host:fullscreen .summary-strip,
.chart-panel-host:-webkit-full-screen .summary-strip {
  gap: 0.28rem;
  margin-bottom: 0.38rem;
}

.chart-panel-host:fullscreen .summary-strip span,
.chart-panel-host:-webkit-full-screen .summary-strip span {
  font-size: 0.5rem;
  padding: 0.1rem 0.3rem;
}

.topology-modal-card :deep(.n-card-header) {
  min-height: 40px;
  padding: 0.4rem 0.85rem;
}

.topology-modal-card :deep(.n-card__content) {
  padding-top: 0.45rem;
}

.topology-modal-title {
  font-size: 0.66rem;
  letter-spacing: 0.1em;
}

.topology-modal-card :deep(.n-card-header-extra) {
  align-items: center;
}

.topology-modal-card .summary-strip {
  gap: 0.28rem;
  margin-bottom: 0.38rem;
}

.topology-modal-card .summary-strip span {
  font-size: 0.5rem;
  padding: 0.1rem 0.3rem;
}

.topology-modal-card :deep(.fui-icon-btn) {
  width: 22px;
  height: 22px;
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

.ticker-value {
  margin-left: 0.18rem;
  color: #ccf4ff;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
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
  position: relative;
}

.expanded-chart-fill {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
}

.topology-modal-content :deep(.chart-wrap) {
  min-height: 0;
  height: 100%;
}

.topology-modal-content :deep(.chart-canvas) {
  min-height: 0;
  height: 100%;
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