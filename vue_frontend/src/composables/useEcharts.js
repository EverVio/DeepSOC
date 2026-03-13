import * as echarts from 'echarts'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

export function useEcharts(buildOption, watchSource, { deep = true } = {}) {
  const chartRef = ref(null)
  let chart = null

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
    window.addEventListener('resize', resizeChart)
  })

  if (watchSource) {
    watch(watchSource, renderChart, { deep })
  }

  onBeforeUnmount(() => {
    window.removeEventListener('resize', resizeChart)
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
