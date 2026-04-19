<!--
  组件职责：安全态势总览页，组合拓扑与图表卡片并驱动标题动效。
  业务模块：态势看板页面
  主要数据流：dashboardStats -> 指标与图表组件 -> 看板展示
-->

<template>
  <div class="dashboard-page" :class="{ 'dashboard-page--topology-collapsed': isTopologyCollapsed }">

    <n-grid :x-gap="14" :y-gap="14" cols="1" responsive="screen">
      <n-gi>
        <div class="topology-anim-container">
          <Transition name="fade-slide">
            <div ref="topologyPanelRef" v-if="!isTopologyCollapsed" class="topology-panel-host">
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
          </Transition>

          <Transition name="fade-slide">
            <div v-if="isTopologyCollapsed" class="topology-collapsed-bar">
              <button class="topology-restore-btn" @click="toggleTopology">
                <ChevronDownIcon class="btn-icon" />
                SHOW 全局攻击拓扑图
              </button>
            </div>
          </Transition>
        </div>
      </n-gi>

      <n-gi>
        <n-grid
          ref="chartsGridRef"
          cols="1 s:1 m:3"
          responsive="screen"
          :x-gap="14"
          :y-gap="14"
          class="dashboard-charts-grid"
          :class="{ 'dashboard-charts-grid--topology-collapsed': isTopologyCollapsed }"
        >
          <n-gi class="dashboard-chart-slot dashboard-chart-slot--radar">
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

          <n-gi class="dashboard-chart-slot dashboard-chart-slot--stream">
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

          <n-gi class="dashboard-chart-slot dashboard-chart-slot--category">
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
import { computed, defineAsyncComponent, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
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
import { buildAnalysisJumpEntry } from '../composables/useAnalysisJump'
import { useDashboardStats } from '../composables/useDashboardStats'
import { useFullscreenPanel } from '../composables/useFullscreenPanel'
import { useChartDrillGuidance } from '../composables/useChartDrillGuidance'
import { useTextScramble } from '../composables/useTextScramble'
import { useRouter } from 'vue-router'
import { useChatStore } from '../stores/chatStore'

const TopologyScene = defineAsyncComponent(() => import('../components/TopologyScene.vue'))
const CategoryDonutChart = defineAsyncComponent(() => import('../components/charts/CategoryDonutChart.vue'))
const LogInflowChart = defineAsyncComponent(() => import('../components/charts/LogInflowChart.vue'))
const ThreatRadarChart = defineAsyncComponent(() => import('../components/charts/ThreatRadarChart.vue'))

const isTopologyCollapsed = ref(false)
const topologyPanelRef = ref(null)
const radarPanelRef = ref(null)
const streamPanelRef = ref(null)
const categoryPanelRef = ref(null)
const chartsGridRef = ref(null)
const topologyTitle = ref('全局攻击拓扑图')
const threatRadarTitle = ref('威胁雷达图')
const logIngestStreamTitle = ref('日志流入趋势图')
const categoryDistributionTitle = ref('告警分类分布图')

const { dashboardStats, statsLoading, startPolling, stopPolling } = useDashboardStats(api)
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
  closeFallbackPanel()
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
const chartFlipDurationMs = 560
const chartFlipEasing = 'cubic-bezier(0.22, 1, 0.36, 1)'

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

const isDesktopViewport = () => window.matchMedia('(min-width: 641px)').matches

const getChartsGridElement = () => {
  const target = chartsGridRef.value
  if (!target) {
    return null
  }
  return target.$el || target
}

const getChartSlots = () => {
  const gridElement = getChartsGridElement()
  if (!gridElement) {
    return []
  }
  return Array.from(gridElement.querySelectorAll('.dashboard-chart-slot'))
}

const captureChartRects = () => {
  const slots = getChartSlots()
  const rectMap = new Map()
  slots.forEach((slot) => {
    rectMap.set(slot, slot.getBoundingClientRect())
  })
  return rectMap
}

const shouldRunChartFlip = () => isDesktopViewport() && !prefersReducedMotion()

const runChartFlipAnimation = (beforeRects) => {
  const slots = getChartSlots()
  slots.forEach((slot) => {
    const firstRect = beforeRects.get(slot)
    if (!firstRect) {
      return
    }

    const lastRect = slot.getBoundingClientRect()
    const deltaX = firstRect.left - lastRect.left
    const deltaY = firstRect.top - lastRect.top
    const scaleX = lastRect.width > 0 ? firstRect.width / lastRect.width : 1
    const scaleY = lastRect.height > 0 ? firstRect.height / lastRect.height : 1
    const hasMove = Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5
    const hasScale = Math.abs(scaleX - 1) > 0.005 || Math.abs(scaleY - 1) > 0.005

    if (!hasMove && !hasScale) {
      slot.style.removeProperty('will-change')
      return
    }

    slot.classList.add('dashboard-chart-slot--animating')
    slot.style.willChange = 'transform'
    slot.style.transition = 'none'
    slot.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`
    slot.getBoundingClientRect()
    slot.style.transition = `transform ${chartFlipDurationMs}ms ${chartFlipEasing}`
    slot.style.transform = 'translate(0, 0) scale(1, 1)'

    const cleanup = () => {
      slot.style.removeProperty('transition')
      slot.style.removeProperty('transform')
      slot.style.removeProperty('will-change')
      slot.classList.remove('dashboard-chart-slot--animating')
    }

    const timeoutId = setTimeout(cleanup, chartFlipDurationMs + 80)
    slot.addEventListener('transitionend', () => {
      clearTimeout(timeoutId)
      cleanup()
    }, { once: true })
  })
}

const toggleTopologyWithFlip = async () => {
  if (!shouldRunChartFlip()) {
    isTopologyCollapsed.value = !isTopologyCollapsed.value
    return
  }

  const beforeRects = captureChartRects()
  isTopologyCollapsed.value = !isTopologyCollapsed.value
  await nextTick()
  requestAnimationFrame(() => {
    runChartFlipAnimation(beforeRects)
  })
}

onMounted(() => {
  // 启动标题动画，并通过小延迟形成分层入场效果
  topologyScramble.start('全局攻击拓扑图', 300)
  threatRadarScramble.start('威胁雷达图', 300)
  animationTimers.push(setTimeout(() => {
    logIngestStreamScramble.start('日志流入趋势图', 300)
  }, 50))
  animationTimers.push(setTimeout(() => {
    categoryDistributionScramble.start('告警分类分布图', 300)
  }, 100))
})

onActivated(() => {
  startPolling()
})

onDeactivated(() => {
  stopPolling()
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
  toggleTopologyWithFlip()
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
  overflow: hidden;
  padding-right: 0.2rem;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.dashboard-page > .n-grid {
  flex: 1;
  min-height: 0;
  height: 100%;
  display: grid;
  grid-template-rows: minmax(0, 1.5fr) minmax(0, 0.9fr);
  align-content: stretch;
  transition: grid-template-rows 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.dashboard-page--topology-collapsed > .n-grid {
  grid-template-rows: 40px minmax(0, 1fr) !important;
}

.dashboard-page > .n-grid > .n-gi {
  min-height: 0;
}

.dashboard-page > .n-grid > .n-gi:first-child {
  display: flex;
}

.dashboard-page > .n-grid > .n-gi:last-child {
  display: flex;
}

.dashboard-charts-grid {
  min-height: 0;
  height: 100%;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: stretch;
  align-content: stretch;
}

.dashboard-chart-slot {
  min-height: 0;
  display: flex;
  height: 100%;
  transform-origin: top left;
  backface-visibility: hidden;
}

.dashboard-charts-grid--topology-collapsed {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: minmax(0, 1.06fr) minmax(0, 0.94fr);
}

.dashboard-charts-grid--topology-collapsed .dashboard-chart-slot--stream {
  grid-column: 1 / 3 !important;
  grid-row: 1 !important;
}

.dashboard-charts-grid--topology-collapsed .dashboard-chart-slot--radar {
  grid-column: 1 !important;
  grid-row: 2 !important;
}

.dashboard-charts-grid--topology-collapsed .dashboard-chart-slot--category {
  grid-column: 2 !important;
  grid-row: 2 !important;
}

.topology-panel-host {
  min-height: 0;
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100%;
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
  min-height: 0;
  height: 100%;
  flex: 1;
}

.center-topology-card :deep(.fui-card-body) {
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.chart-panel-host {
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  flex: 1;
  height: 100%;
}

.topology-anim-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.topology-anim-container > .topology-panel-host,
.topology-anim-container > .topology-collapsed-bar {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(15px);
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
.chart-panel-host:-webkit-full-screen .chart-card :deep(.fui-card-header) {
  min-height: 60px;
  padding: 0.6rem 1.5rem;
}

.chart-card :deep(.fui-card-title),
.center-topology-card :deep(.fui-card-title) {
  font-size: 1rem;
  font-weight: 500;  
}

.chart-panel-host:fullscreen .chart-card :deep(.fui-card-title),
.chart-panel-host:-webkit-full-screen .chart-card :deep(.fui-card-title) {
  font-size: 1.25rem;
  letter-spacing: 0.14em;
  padding-left: 1rem;
}

.chart-panel-host:fullscreen .chart-card :deep(.fui-card-header-right),
.chart-panel-host:-webkit-full-screen .chart-card :deep(.fui-card-header-right) {
  gap: 0.32rem;
}

.chart-panel-host:fullscreen .chart-card :deep(.fui-icon-btn),
.chart-panel-host:-webkit-full-screen .chart-card :deep(.fui-icon-btn),
.topology-panel-host:fullscreen .center-topology-card :deep(.fui-icon-btn),
.topology-panel-host:-webkit-full-screen .center-topology-card :deep(.fui-icon-btn) {
  width: 22px;
  height: 22px;
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

.topology-modal-card :deep(.fui-icon-btn) {
  width: 22px;
  height: 22px;
}

.chart-card {
  min-height: 0;
  height: 100%;
  flex: 1;
}

.chart-card :deep(.fui-card-body) {
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0.58rem 0.72rem 0.66rem;
}

.chart-card :deep(.chart-canvas) {
  min-height: 244px;
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
  font-family: var(--font-ui);
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

@media (min-width: 641px) {
  .dashboard-charts-grid {
    display: block !important;
    position: relative;
  }

  .dashboard-chart-slot {
    position: absolute;
    transition: none;
    contain: layout paint;
  }

  .dashboard-chart-slot.dashboard-chart-slot--animating {
    pointer-events: none;
  }

  .dashboard-chart-slot--radar {
    top: 0;
    left: 0;
    width: calc((100% - 28px) / 3);
    height: 100%;
  }

  .dashboard-chart-slot--stream {
    top: 0;
    left: calc((100% - 28px) / 3 + 14px);
    width: calc((100% - 28px) / 3);
    height: 100%;
  }

  .dashboard-chart-slot--category {
    top: 0;
    left: calc(((100% - 28px) / 3) * 2 + 28px);
    width: calc((100% - 28px) / 3);
    height: 100%;
  }

  .dashboard-charts-grid--topology-collapsed .dashboard-chart-slot--stream {
    top: 0;
    left: 0;
    width: 100%;
    height: calc(50% - 7px);
  }

  .dashboard-charts-grid--topology-collapsed .dashboard-chart-slot--radar {
    top: calc(50% + 7px);
    left: 0;
    width: calc(50% - 7px);
    height: calc(50% - 7px);
  }

  .dashboard-charts-grid--topology-collapsed .dashboard-chart-slot--category {
    top: calc(50% + 7px);
    left: calc(50% + 7px);
    width: calc(50% - 7px);
    height: calc(50% - 7px);
  }
}

@media (max-width: 1024px) {
  .dashboard-page > .n-grid {
    grid-template-rows: minmax(0, 1.4fr) minmax(0, 0.9fr);
  }

  .dashboard-page--topology-collapsed > .n-grid {
    grid-template-rows: 40px minmax(0, 1fr);
  }

  .topology-modal-wrap {
    width: min(980px, 96vw);
  }

  .topology-modal-card {
    height: min(72vh, 760px);
    min-height: 430px;
  }
}

@media (max-width: 640px) {
  .dashboard-page {
    gap: 10px;
  }

  .topology-anim-container > .topology-panel-host,
  .topology-anim-container > .topology-collapsed-bar {
    position: static;
    inset: auto;
  }

  .dashboard-charts-grid,
  .dashboard-charts-grid--topology-collapsed {
    grid-template-columns: minmax(0, 1fr) !important;
    grid-template-rows: repeat(3, minmax(0, auto)) !important;
  }

  .dashboard-charts-grid--topology-collapsed .dashboard-chart-slot--stream,
  .dashboard-charts-grid--topology-collapsed .dashboard-chart-slot--radar,
  .dashboard-charts-grid--topology-collapsed .dashboard-chart-slot--category {
    grid-column: auto !important;
    grid-row: auto !important;
  }

  .topology-restore-btn {
    font-size: 0.55rem;
  }
}

@media (max-height: 900px) {
  .dashboard-page {
    gap: 10px;
  }

  .dashboard-page > .n-grid {
    grid-template-rows: minmax(0, 1.34fr) minmax(0, 0.9fr);
  }
}

@media (max-height: 820px) {
  .dashboard-page {
    overflow-y: auto;
    overflow-x: hidden;
    padding-right: 0;
  }

  .dashboard-page > .n-grid {
    height: auto;
    min-height: 100%;
    grid-template-rows: minmax(380px, 1.22fr) minmax(230px, 0.92fr);
  }
}
</style>