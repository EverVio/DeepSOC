<!--
  组件职责：展示分类占比环形图并处理空态/加载态。
  业务模块：仪表盘图表模块
  主要数据流：统计数据 -> ECharts option -> 环形图渲染
-->

<template>
  <div class="chart-wrap">
    <div ref="chartRef" class="chart-canvas"></div>
    <div v-if="loading" class="chart-mask">AGGREGATING CATEGORY LOAD...</div>
  </div>
</template>

<script setup>
import { useEcharts } from '../../composables/useEcharts'

const props = defineProps({
  stats: {
    type: Object,
    default: () => ({}),
  },
  fullscreen: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const colorPool = ['#00e5ff', '#00ff9d', '#7b2cbf', '#ff0055', '#ff6a00', '#89a6ff', '#47d3ff']

const buildOption = () => {
  const fullscreen = props.fullscreen

  const categories = (props.stats?.category_counts || []).slice(0, 7)

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(5,8,20,0.92)',
      borderColor: 'rgba(0,229,255,0.35)',
      textStyle: { color: '#d8f5ff', fontFamily: 'Roboto Mono', fontSize: fullscreen ? 10 : 11 },
    },
    legend: {
      orient: fullscreen ? 'horizontal' : 'vertical',
      left: fullscreen ? 'center' : 'auto',
      right: fullscreen ? 'auto' : 18,
      top: fullscreen ? 'auto' : 'center',
      bottom: fullscreen ? 10 : 'auto',
      width: fullscreen ? '84%' : '34%',
      itemWidth: fullscreen ? 8 : 9,
      itemHeight: fullscreen ? 8 : 9,
      itemGap: fullscreen ? 12 : 12,
      padding: fullscreen ? [8, 10, 6, 10] : [8, 8, 8, 4],
      icon: 'circle',
      textStyle: {
        color: '#c8d8e6',
        fontFamily: 'Roboto Mono',
        fontSize: fullscreen ? 9 : 10,
        lineHeight: fullscreen ? 15 : 16,
        verticalAlign: 'middle',
      },
    },
    series: [
      {
        name: 'Category',
        type: 'pie',
        radius: fullscreen ? ['36%', '72%'] : ['34%', '68%'],
        center: fullscreen ? ['43%', '52%'] : ['38%', '52%'],
        avoidLabelOverlap: true,
        label: {
          show: false,
        },
        labelLine: { show: false },
        itemStyle: {
          borderColor: '#050814',
          borderWidth: 1,
        },
        data: categories.map((item, idx) => ({
          value: item.value,
          name: item.name,
          itemStyle: {
            color: colorPool[idx % colorPool.length],
            shadowBlur: 4,
            shadowColor: `${colorPool[idx % colorPool.length]}4d`,
          },
        })),
      },
    ],
    graphic: categories.length
      ? []
      : [
          {
            type: 'text',
            left: 'center',
            top: 'middle',
            style: {
              text: 'NO CATEGORY DATA',
              fill: '#6f95a9',
              font: fullscreen ? '11px Roboto Mono' : '12px Roboto Mono',
            },
          },
        ],
  }
}

const emit = defineEmits(['chart-click'])

const { chartRef } = useEcharts(buildOption, () => props.stats, {
  deep: false,
  throttleMs: 90,
  debounceMs: 180,
  onClick: (params) => {
    // 过滤掉因为点击非数据区域触发的无用事件
    if (params.name) {
      emit('chart-click', params)
    }
  }
})
</script>

<style scoped>
.chart-wrap {
  position: relative;
  width: 100%;
  height: 100%;
}

.chart-canvas {
  width: 100%;
  height: 100%;
  min-height: 205px;
}

@media (max-height: 860px) {
  .chart-canvas {
    min-height: 175px;
  }
}

.chart-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(5, 8, 20, 0.4);
  color: #7ba7bc;
  font-family: var(--font-mono);
  font-size: 0.64rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  animation: pulse-mask 1.5s infinite ease-in-out;
}

@keyframes pulse-mask {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
</style>
