/**
 * 模块职责：统一管理 ECharts 实例生命周期与重绘策略。
 * 业务模块：图表基础能力模块
 * 主要数据流：数据变化/尺寸变化 -> option 更新 -> 图表渲染
 */

import * as echarts from 'echarts'
import { onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'

export function useEcharts(
  buildOption,
  watchSource,
  { deep = true, throttleMs = 80, debounceMs = 160, viewportThreshold = 0.05 } = {},
) {
  const chartRef = ref(null)
  let chart = null
  let resizeObserver = null
  let intersectionObserver = null
  let resizeThrottleTimer = null
  let resizeDebounceTimer = null
  let lastResizeTime = 0
  let isInViewport = false

  const renderChart = (force = false) => {
    if (!chart) return

    if (!force && !isInViewport) {
      return
    }

    chart.setOption(buildOption(), true)
  }

  const resizeChart = () => {
    if (!chart || !isInViewport) return
    chart.resize()
  }

  const clearResizeTimers = () => {
    if (resizeThrottleTimer) {
      clearTimeout(resizeThrottleTimer)
      resizeThrottleTimer = null
    }
    if (resizeDebounceTimer) {
      clearTimeout(resizeDebounceTimer)
      resizeDebounceTimer = null
    }
  }

  const scheduleResize = () => {
    if (!isInViewport) return

    const now = Date.now()
    const elapsed = now - lastResizeTime

    if (elapsed >= throttleMs) {
      lastResizeTime = now
      resizeChart()
    } else if (!resizeThrottleTimer) {
      resizeThrottleTimer = setTimeout(() => {
        resizeThrottleTimer = null
        lastResizeTime = Date.now()
        resizeChart()
      }, throttleMs - elapsed)
    }

    if (resizeDebounceTimer) {
      clearTimeout(resizeDebounceTimer)
    }
    resizeDebounceTimer = setTimeout(() => {
      resizeDebounceTimer = null
      lastResizeTime = Date.now()
      resizeChart()
    }, debounceMs)
  }

  const setupIntersectionObserver = () => {
    if (!chartRef.value) return

    if (typeof IntersectionObserver === 'undefined') {
      isInViewport = true
      renderChart(true)
      scheduleResize()
      return
    }

    intersectionObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return

        isInViewport = entry.isIntersecting
        if (isInViewport) {
          renderChart(true)
          scheduleResize()
        }
      },
      {
        threshold: viewportThreshold,
      },
    )

    intersectionObserver.observe(chartRef.value)
  }

  const initChart = () => {
    if (!chartRef.value || chart) return

    chart = echarts.init(chartRef.value)
    setupIntersectionObserver()

    resizeObserver = new ResizeObserver(() => {
      scheduleResize()
    })
    resizeObserver.observe(chartRef.value)
  }

  const destroyChart = () => {
    if (intersectionObserver) {
      intersectionObserver.disconnect()
      intersectionObserver = null
    }
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }

    clearResizeTimers()

    if (chart) {
      chart.dispose()
      chart = null
    }

    isInViewport = false
  }

  onMounted(() => {
    initChart()
  })

  onActivated(() => {
    initChart()
  })

  onDeactivated(() => {
    destroyChart()
  })

  if (watchSource) {
    watch(watchSource, () => renderChart(), { deep })
  }

  onBeforeUnmount(() => {
    destroyChart()
  })

  return {
    chartRef,
    renderChart,
    resizeChart,
  }
}
