<!--
  组件职责：展示威胁维度雷达图并映射各维度评分。
  业务模块：仪表盘图表模块
  主要数据流：威胁分布数据 -> ECharts option -> 雷达图渲染
-->

<template>
  <div class="chart-wrap">
    <div ref="chartRef" class="chart-canvas"></div>
    <div v-if="loading" class="chart-mask">EVALUATING THREAT POSTURE...</div>
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

const buildOption = () => {
  const fullscreen = props.fullscreen

  const threat = props.stats?.threat_distribution || []
  const high = threat.find((item) => item.level === 'high')?.value || 0
  const medium = threat.find((item) => item.level === 'medium')?.value || 0
  const low = threat.find((item) => item.level === 'low')?.value || 0

  const maxVal = Math.max(high, medium, low, 5)
  const values = [high, medium, low, Math.round((high + medium) * 0.6), Math.round((medium + low) * 0.6)]

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(5,8,20,0.92)',
      borderColor: 'rgba(0,229,255,0.35)',
      textStyle: { color: '#d8f5ff', fontFamily: 'Roboto Mono', fontSize: fullscreen ? 10 : 11 },
    },
    radar: {
      center: fullscreen ? ['50%', '55%'] : ['50%', '54%'],
      radius: fullscreen ? '74%' : '68%',
      splitNumber: fullscreen ? 4 : 5,
      axisName: {
        color: '#eef5ff',
        fontFamily: 'Roboto Mono',
        fontSize: fullscreen ? 10 : 11,
        fontWeight: 600,
      },
      splitArea: {
        areaStyle: {
          color: fullscreen
            ? ['rgba(0,229,255,0.03)', 'rgba(0,229,255,0.06)']
            : ['rgba(0,229,255,0.02)', 'rgba(0,229,255,0.04)'],
        },
      },
      axisLine: { lineStyle: { color: 'rgba(0,229,255,0.25)' } },
      splitLine: { lineStyle: { color: 'rgba(0,229,255,0.18)' } },
      indicator: [
        { name: 'HIGH', max: maxVal },
        { name: 'MEDIUM', max: maxVal },
        { name: 'LOW', max: maxVal },
        { name: 'ATTACK', max: maxVal },
        { name: 'ANOMALY', max: maxVal },
      ],
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: values,
            name: 'Threat Profile',
            areaStyle: {
              color: 'rgba(255,0,85,0.18)',
            },
            lineStyle: {
              color: '#ff0055',
              width: 1.6,
            },
            itemStyle: {
              color: '#ff0055',
            },
            symbolSize: 4,
          },
        ],
      },
    ],
    graphic: high + medium + low
      ? []
      : [
          {
            type: 'text',
            left: 'center',
            top: 'middle',
            style: {
              text: 'NO THREAT DATA',
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
  onClick: (params) => emit('chart-click', params)
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
