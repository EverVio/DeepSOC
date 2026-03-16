import * as echarts from 'echarts'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

export function useEcharts(buildOption, watchSource, { deep = true } = {}) {
  const chartRef = ref(null)
  let chart = null
  let resizeObserver = null

  const renderChart = () => {
    if (!chart) return
    chart.setOption(buildOption(), true)
  }

  const resizeChart = () => {
    if (chart) {
      chart.resize()
    }
  }

  onMounted(() => {
    if (!chartRef.value) return

    chart = echarts.init(chartRef.value)
    renderChart()

    // 核心修改：使用 ResizeObserver 监听当前 DOM 容器的尺寸变化
    resizeObserver = new ResizeObserver(() => {
      resizeChart()
    })
    resizeObserver.observe(chartRef.value)
  })

  if (watchSource) {
    watch(watchSource, renderChart, { deep })
  }

  onBeforeUnmount(() => {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    if (chart) {
      chart.dispose()
      chart = null
    }
  })

  return {
    chartRef,
    renderChart,
  }
}