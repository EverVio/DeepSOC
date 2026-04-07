<template>
  <div class="chart-wrap">
    <div ref="chartRef" class="chart-canvas"></div>
    <div v-if="loading" class="chart-mask">SYNCING LOG STREAM...</div>
  </div>
</template>

<script setup>
import * as echarts from 'echarts'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useEcharts } from '../../composables/useEcharts'
import { createCyberTooltip, createHudCornerGraphics, createNoDataGraphic } from './cyberChartTheme'

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

const scanPhase = ref(0)
const patternCache = ref(null)
let scanTimer = null

const getStatusTone = (value, max) => {
  if (!max) return { label: 'IDLE', color: '#7ba7bc' }
  const ratio = value / max
  if (ratio >= 0.82) return { label: 'SATURATED', color: '#ff0055' }
  if (ratio >= 0.55) return { label: 'SPIKE', color: '#ff6a00' }
  return { label: 'NORMAL', color: '#00ff9d' }
}

const shortText = (value, maxLen = 14) => {
  const text = String(value || '')
  return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text
}

const buildScanPattern = () => {
  if (typeof document === 'undefined') return null

  const canvas = document.createElement('canvas')
  canvas.width = 14
  canvas.height = 14
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = 'rgba(0,0,0,0)'
  ctx.fillRect(0, 0, 14, 14)
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.22)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, 13)
  ctx.lineTo(13, 0)
  ctx.stroke()
  return ctx.createPattern(canvas, 'repeat')
}

const findPeaks = (values, threshold) => {
  const peaks = []
  for (let index = 0; index < values.length; index += 1) {
    const current = Number(values[index]) || 0
    const left = Number(values[index - 1] ?? current) || 0
    const right = Number(values[index + 1] ?? current) || 0
    if (current >= threshold && current >= left && current >= right) {
      peaks.push(index)
    }
  }
  return peaks
}

const getFlowSlices = () => {
  const slices = (props.stats?.timeline_slices || []).slice(-14)
  if (slices.length) {
    return slices
  }

  return (props.stats?.timeline || []).slice(-14).map((item) => ({
    label: item.updated_text || item.file || item.label,
    total: Number(item.value) || 0,
    sources: [],
    dominant_feature: '',
    top_cve_id: '',
    top_ioc_value: '',
  }))
}

const buildScanMarkLineData = (phase, fullscreen) => {
  // 小图状态下不渲染扫描线与阈值基准线
  if (!fullscreen) return []

  const slices = getFlowSlices()
  const timelineLabels = slices.map((item) => item.label)
  const timelineValues = slices.map((item) => Number(item.total) || 0)

  const lineMax = Math.max(...timelineValues, 10)
  const average = timelineValues.length
    ? timelineValues.reduce((sum, item) => sum + item, 0) / timelineValues.length
    : 0
  const warningLine = average ? Math.max(Math.round(average * 1.3), Math.round(lineMax * 0.68)) : 0
  const scanIndex = timelineLabels.length ? phase % timelineLabels.length : 0
  const scanLabel = timelineLabels[scanIndex]

  return [
    ...(warningLine
      ? [
          {
            name: `THRESH ${warningLine}`,
            yAxis: warningLine,
            label: {
              position: 'insideEndTop',
              color: '#ffcfaa',
              fontSize: fullscreen ? 10 : 9,
            }
          },
        ]
      : []),
    ...(scanLabel
      ? [
          {
            name: 'SCAN',
            xAxis: scanLabel,
            label: {
              position: 'insideStartBottom',
              color: 'rgba(0,229,255,0.85)',
              fontSize: fullscreen ? 10 : 9,
              formatter: '{b}'
            },
            lineStyle: {
              color: 'rgba(0,229,255,0.65)',
              width: 1.5,
              type: 'dashed',
            },
          },
        ]
      : []),
  ]
}

const buildOption = () => {
  const zoomEnabled = props.enableZoom
  const fullscreen = props.fullscreen

  const slices = getFlowSlices()
  const timelineLabels = slices.map((item) => item.label)
  const timelineValues = slices.map((item) => Number(item.total) || 0)

  const sourceTotals = {}
  slices.forEach((slice) => {
    ;(slice.sources || []).forEach((sourceItem) => {
      const sourceName = String(sourceItem.name || 'Unknown')
      sourceTotals[sourceName] = (sourceTotals[sourceName] || 0) + (Number(sourceItem.value) || 0)
    })
  })
  const topSourceNames = Object.entries(sourceTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map((item) => item[0])

  const stackedBySource = topSourceNames.map((sourceName) => ({
    name: sourceName,
    values: slices.map((slice) => {
      const matched = (slice.sources || []).find((item) => String(item.name || 'Unknown') === sourceName)
      return Number(matched?.value) || 0
    }),
  }))

  const stackedMax = Math.max(
    ...slices.map((slice) => (slice.sources || []).reduce((sum, item) => sum + (Number(item.value) || 0), 0)),
    10,
  )
  const lineMax = Math.max(...timelineValues, 10)
  const average = timelineValues.length
    ? timelineValues.reduce((sum, item) => sum + item, 0) / timelineValues.length
    : 0
  const warningLine = average ? Math.max(Math.round(average * 1.3), Math.round(lineMax * 0.68)) : 0
  const peakIndexes = findPeaks(timelineValues, warningLine || lineMax * 0.8)
  const scanIndex = timelineLabels.length ? scanPhase.value % timelineLabels.length : 0
  const scanLabel = timelineLabels[scanIndex]

  const hasData = timelineValues.length > 0
  const scanPattern = patternCache.value
  const sourcePalette = ['#00e5ff', '#6fffb7', '#89a6ff', '#ff6a00', '#b98cff', '#ff4f8b']

  const peakScatterData = peakIndexes.map((index) => {
    const slice = slices[index] || {}
    return {
      value: [timelineLabels[index], timelineValues[index]],
      dominantFeature: slice.dominant_feature || '',
      topCveId: slice.top_cve_id || '',
      topIocValue: slice.top_ioc_value || '',
    }
  })

  return {
    backgroundColor: 'transparent',
    grid: [
      {
        left: fullscreen ? 55 : 45,
        right: fullscreen ? 24 : 15,
        top: fullscreen ? 24 : 20,
        height: zoomEnabled ? (fullscreen ? '35%' : '32%') : (fullscreen ? '38%' : '36%'),
      },
      {
        left: fullscreen ? 55 : 45,
        right: fullscreen ? 24 : 15,
        top: zoomEnabled ? (fullscreen ? '46%' : '48%') : (fullscreen ? '48%' : '50%'),
        bottom: zoomEnabled ? (fullscreen ? 38 : 40) : (fullscreen ? 24 : 22),
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
            height: 16,
            borderColor: 'rgba(0, 229, 255, 0.35)',
            backgroundColor: 'rgba(7, 13, 28, 0.92)',
            fillerColor: 'rgba(0, 229, 255, 0.24)',
            brushSelect: false,
            showDetail: false,
            handleSize: '105%',
            handleIcon:
              'path://M512 0a64 64 0 0 1 64 64v896a64 64 0 0 1-128 0V64a64 64 0 0 1 64-64zm-288 128a64 64 0 0 1 64 64v640a64 64 0 0 1-128 0V192a64 64 0 0 1 64-64zm576 0a64 64 0 0 1 64 64v640a64 64 0 0 1-128 0V192a64 64 0 0 1 64-64z',
            handleStyle: {
              color: '#00e5ff',
              borderColor: '#9ff8ff',
              shadowBlur: 12,
              shadowColor: 'rgba(0,229,255,0.75)',
            },
            moveHandleStyle: {
              color: 'rgba(0,229,255,0.4)',
              opacity: 0.85,
            },
            dataBackground: {
              lineStyle: { color: 'rgba(0,229,255,0.26)', width: 1 },
              areaStyle: { color: 'rgba(0,229,255,0.08)' },
            },
            selectedDataBackground: {
              lineStyle: { color: 'rgba(0,255,157,0.5)', width: 1.2 },
              areaStyle: { color: 'rgba(0,255,157,0.1)' },
            },
            textStyle: { color: '#7ba7bc', fontFamily: 'Roboto Mono', fontSize: 9 },
          },
        ]
      : [],
    tooltip: createCyberTooltip({
      size: 'md',
      trigger: 'axis',
      axisPointer: {
        lineStyle: {
          color: 'rgba(0,229,255,0.55)',
          type: 'dashed',
        },
      },
      formatter: (params) => {
        if (!Array.isArray(params) || !params.length) return ''
        const axisLabel = params[0].axisValueLabel || params[0].name || 'UNKNOWN'
        const rows = params
          .map((item) => {
            const value = Number(item.value) || 0
            const maxRef = item.seriesName === 'Ingest Timeline' ? lineMax : stackedMax
            const tone = getStatusTone(value, maxRef)
            return `<div class="cyber-tip-row"><span><i class="state-dot" style="background:${tone.color}"></i>${item.seriesName}</span><strong>${value}</strong></div>`
          })
          .join('')
        return [
          '<div class="cyber-tip-body">',
          `<div class="cyber-tip-head">${axisLabel}</div>`,
          rows,
          '</div>',
        ].join('')
      },
    }),
    xAxis: [
      {
        type: 'category',
        gridIndex: 0,
        data: timelineLabels,
        axisLine: { 
          show: true, 
          lineStyle: { color: 'rgba(0,229,255,0.35)' }
        },
        axisLabel: { show: false },
        axisTick: { show: false },
      },
      {
        type: 'category',
        gridIndex: 1,
        data: timelineLabels,
        axisLine: { lineStyle: { color: 'rgba(0,229,255,0.45)' } },
        axisLabel: {
          color: '#d8e9f5',
          fontFamily: 'Roboto Mono',
          fontSize: fullscreen ? 11 : 10,
          fontWeight: 500,
          interval: 'auto',
          hideOverlap: true,
          margin: 12,
          formatter: (value) => shortText(value, fullscreen ? 18 : 14),
        },
        axisTick: {
          show: true,
          lineStyle: { color: 'rgba(0,229,255,0.35)' },
        },
      },
    ],
    yAxis: [
      {
        type: 'value',
        gridIndex: 0,
        min: 0,
        max: stackedMax,
        alignTicks: false,
        splitLine: {
          lineStyle: {
            color: 'rgba(0,229,255,0.08)',
            type: 'dashed',
          },
        },
        axisLabel: { color: '#8aa6ba', fontSize: fullscreen ? 11 : 10, fontFamily: 'Roboto Mono' },
      },
      {
        type: 'value',
        gridIndex: 1,
        min: 0,
        max: lineMax,
        alignTicks: false,
        splitLine: {
          lineStyle: {
            color: 'rgba(0,229,255,0.08)',
            type: 'dashed',
          },
        },
        axisLabel: { color: '#8aa6ba', fontSize: fullscreen ? 11 : 10, fontFamily: 'Roboto Mono' },
      },
    ],
    series: [
      ...stackedBySource.map((sourceItem, idx) => ({
        id: `sourceStack-${idx}`,
        name: sourceItem.name,
        type: 'bar',
        stack: 'sourceThroughput',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: sourceItem.values,
        barMaxWidth: fullscreen ? 24 : 16,
        itemStyle: {
          color: sourcePalette[idx % sourcePalette.length],
          borderRadius: idx === stackedBySource.length - 1 ? [2, 2, 0, 0] : 0,
          opacity: 0.9,
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 12,
            shadowColor: `${sourcePalette[idx % sourcePalette.length]}`,
          },
        },
        z: 3,
      })),
      {
        id: 'scanTextureSeries',
        name: 'Scan Texture',
        type: 'line',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: timelineValues,
        lineStyle: { width: 0, opacity: 0 },
        symbol: 'none',
        silent: true,
        tooltip: { show: false },
        areaStyle: {
          opacity: 0.45,
          color: scanPattern || 'rgba(0, 229, 255, 0.08)',
        },
        z: 0,
      },
      {
        id: 'ingestTimelineSeries',
        name: 'Ingest Timeline',
        type: 'line',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: timelineValues,
        step: 'middle',
        z: 2,
        symbol: 'circle',
        symbolSize: fullscreen ? 6 : 5,
        lineStyle: {
          color: '#00ff9d',
          width: 2,
          shadowBlur: 12,
          shadowColor: 'rgba(0,255,157,0.8)',
        },
        itemStyle: {
          color: '#00ff9d',
          borderWidth: 1,
          borderColor: '#fff'
        },
        areaStyle: {
          opacity: 0.5,
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(0,255,157,0.35)' },
            { offset: 1, color: 'rgba(0,255,157,0.01)' },
          ]),
        },
        markPoint: {
          symbol: 'circle', // 替换为圆形
          symbolSize: fullscreen ? 10 : 8,
          symbolOffset: [0, 0], // 圆心对准数据点
          itemStyle: {
            color: '#ff0055',
            shadowBlur: 10,
            shadowColor: 'rgba(255,0,85,0.8)',
          },
          label: {
            show: fullscreen, // 小图隐藏文本
            position: 'top',
            distance: 12,
            formatter: (params) => {
              const feature = params?.data?.dominantFeature || ''
              if (!feature) return 'SPIKE'
              return shortText(feature.replace('突增归因：', ''), 36)
            },
            color: '#fff',
            fontSize: fullscreen ? 10 : 9,
            textShadowColor: '#000',
            textShadowBlur: 4,
          },
          data: peakScatterData.map((item) => ({
            coord: item.value,
            value: item.value[1],
            dominantFeature: item.dominantFeature,
            topCveId: item.topCveId,
            topIocValue: item.topIocValue,
          })),
        },
        markLine: {
          symbol: ['none', 'none'],
          lineStyle: {
            color: 'rgba(255,106,0,0.92)',
            type: 'dashed',
            width: 1.1,
            shadowBlur: 8,
            shadowColor: 'rgba(255,106,0,0.55)',
          },
          data: buildScanMarkLineData(scanPhase.value, fullscreen),
        },
      },
      {
        id: 'flowPeakPulseSeries',
        name: 'Flow Peak Pulse',
        type: 'effectScatter',
        xAxisIndex: 1,
        yAxisIndex: 1,
        coordinateSystem: 'cartesian2d',
        symbol: 'circle',
        symbolSize: fullscreen ? 14 : 10,
        showEffectOn: 'render',
        rippleEffect: {
          scale: 4,
          brushType: 'stroke',
        },
        itemStyle: {
          color: '#ff0055',
          shadowBlur: 16,
          shadowColor: 'rgba(255,0,85,0.9)',
        },
        z: 4,
        tooltip: {
          formatter: (params) => {
            const tone = getStatusTone(Number(params.value?.[1]) || 0, lineMax)
            const dominantFeature = params.data?.dominantFeature || '未命中归因特征'
            return [
              '<div class="cyber-tip-body">',
              `<div class="cyber-tip-head"><span class="state-dot" style="background:${tone.color}"></span>${tone.label}</div>`,
              `<div class="cyber-tip-row"><span>Point</span><strong>${params.value?.[0] || '-'}</strong></div>`,
              `<div class="cyber-tip-row"><span>Flow</span><strong>${params.value?.[1] || 0}</strong></div>`,
              `<div class="cyber-tip-row"><span>Cause</span><strong>${shortText(dominantFeature, 24)}</strong></div>`,
              '</div>',
            ].join('')
          },
        },
        data: peakScatterData,
      },
    ],
    graphic: [
      ...createHudCornerGraphics({
        fullscreen,
        left: [8, 8],
        top: [12, 10],
        right: [12, 12],
        bottom: [22, 16],
        lineLength: 24,
        lineHeight: 12,
        colorLeft: 'rgba(0,229,255,0.45)',
        colorRight: 'rgba(0,229,255,0.35)',
        z: 10,
      }),
      ...(hasData
        ? []
        : [createNoDataGraphic('NO LOG DATA', fullscreen)]),
    ],
  }
}

const emit = defineEmits(['chart-click'])

const { chartRef, setPartialOption } = useEcharts(buildOption, () => [props.stats, props.fullscreen, props.enableZoom], {
  deep: false,
  throttleMs: 90,
  debounceMs: 180,
  onClick: (params) => emit('chart-click', params)
})

onMounted(() => {
  patternCache.value = buildScanPattern()
  scanTimer = setInterval(() => {
    scanPhase.value = (scanPhase.value + 1) % 200
    setPartialOption({
      series: [
        {
          id: 'ingestTimelineSeries',
          markLine: {
            data: buildScanMarkLineData(scanPhase.value, props.fullscreen),
          },
        },
      ],
    })
  }, 220)
})

onBeforeUnmount(() => {
  if (scanTimer) {
    clearInterval(scanTimer)
    scanTimer = null
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
  font-family: var(--font-ui);
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