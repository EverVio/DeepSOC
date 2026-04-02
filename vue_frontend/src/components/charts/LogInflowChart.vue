<!--
  组件职责：展示日志流入趋势图并映射时间序列。
  业务模块：仪表盘图表模块
  主要数据流：时间序列数据 -> ECharts option -> 折线图渲染
-->

<template>
  <div class="chart-wrap">
    <div ref="chartRef" class="chart-canvas"></div>
    <div v-if="loading" class="chart-mask">SYNCING LOG STREAM...</div>
  </div>
</template>

<script setup>
import * as echarts from 'echarts'
import { useEcharts } from '../../composables/useEcharts'

const props = defineProps({
  stats: {
    type: Object,
    default: () => ({}),
  },
  enableZoom: {
    type: Boolean,
    default: false,
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
  const zoomEnabled = props.enableZoom
  const fullscreen = props.fullscreen

  const sourceSeries = (props.stats?.source_counts || []).slice(0, 8)
  const timeline = (props.stats?.timeline || []).slice(-8)

  const names = sourceSeries.map((item) => item.name)
  const values = sourceSeries.map((item) => item.value)
  const timelineLabels = timeline.map((item) => item.updated_text || item.file || item.label)
  const timelineValues = timeline.map((item) => item.value)

  const hasData = values.length > 0 || timelineValues.length > 0

  return {
    backgroundColor: 'transparent',
    grid: [
      {
        left: fullscreen ? 34 : 40,
        right: 12,
        top: fullscreen ? 16 : 18,
        height: zoomEnabled ? (fullscreen ? '30%' : '29%') : (fullscreen ? '31%' : '30%'),
      },
      {
        left: fullscreen ? 34 : 40,
        right: 12,
        top: zoomEnabled ? (fullscreen ? '56%' : '58%') : (fullscreen ? '55%' : '56%'),
        bottom: zoomEnabled ? (fullscreen ? 34 : 40) : (fullscreen ? 22 : 20),
      },
    ],
    dataZoom: zoomEnabled
      ? [
          {
            type: 'inside',
            xAxisIndex: [0, 1],
            start: 0,
            end: 100,
          },
          {
            type: 'slider',
            xAxisIndex: [0, 1],
            bottom: 0,
            height: 12,
            borderColor: 'rgba(0, 229, 255, 0.2)',
            fillerColor: 'rgba(0, 229, 255, 0.3)',
            handleStyle: { color: '#00e5ff' },
            textStyle: { color: '#7ba7bc' },
          },
        ]
      : [],
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(5, 8, 20, 0.92)',
      borderColor: 'rgba(0, 229, 255, 0.35)',
      textStyle: {
        color: '#d8f5ff',
        fontFamily: 'Roboto Mono',
          fontSize: fullscreen ? 10 : 11,
      },
    },
    xAxis: [
      {
        type: 'category',
        gridIndex: 0,
        data: names,
        axisLine: { lineStyle: { color: 'rgba(0,229,255,0.3)' } },
        axisLabel: {
          show: false,
          color: '#eef5ff',
          fontFamily: 'Roboto Mono',
          fontSize: fullscreen ? 10 : 11,
          fontWeight: 500,
          interval: 'auto',
          rotate: 0,
          hideOverlap: true,
          margin: 10,
          formatter: (value) => {
            const text = String(value || '')
            return text.length > 16 ? `${text.slice(0, 16)}...` : text
          },
        },
      },
      {
        type: 'category',
        gridIndex: 1,
        data: timelineLabels,
        axisLine: { lineStyle: { color: 'rgba(0,229,255,0.28)' } },
        axisLabel: {
          color: '#c8d8e6',
          fontFamily: 'Roboto Mono',
          fontSize: fullscreen ? 10 : 11,
          interval: 'auto',
          hideOverlap: true,
          margin: 10,
        },
      },
    ],
    yAxis: [
      {
        type: 'value',
        gridIndex: 0,
        min: 0,
        alignTicks: false,
        splitLine: { lineStyle: { color: 'rgba(0,229,255,0.08)' } },
        axisLabel: { color: '#c8d8e6', fontSize: fullscreen ? 10 : 11 },
      },
      {
        type: 'value',
        gridIndex: 1,
        min: 0,
        alignTicks: false,
        splitLine: { lineStyle: { color: 'rgba(0,229,255,0.06)' } },
        axisLabel: { color: '#c8d8e6', fontSize: fullscreen ? 9 : 10 },
      },
    ],
    series: [
      {
        name: 'Source Volume',
        type: 'bar',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: values,
        barMaxWidth: fullscreen ? 18 : 16,
        itemStyle: {
          borderRadius: [2, 2, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#00e5ff' },
            { offset: 1, color: 'rgba(0,229,255,0.2)' },
          ]),
        },
      },
      {
        name: 'Ingest Timeline',
        type: 'line',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: timelineValues,
        smooth: true,
        z: 1,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: '#00ff9d', width: 2 },
        itemStyle: { color: '#00ff9d' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(0,255,157,0.12)' },
            { offset: 1, color: 'rgba(0,255,157,0.01)' },
          ]),
        },
      },
    ],
    graphic: hasData
      ? []
      : [
          {
            type: 'text',
            left: 'center',
            top: 'middle',
            style: {
              text: 'NO LOG DATA',
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
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  animation: pulse-mask 1.5s infinite ease-in-out;
}

@keyframes pulse-mask {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
</style>
