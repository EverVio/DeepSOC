<template>
  <div class="chart-wrap" @mouseenter="pauseOrbit" @mouseleave="resumeOrbit">
    <div ref="chartRef" class="chart-canvas"></div>
    <div v-if="loading" class="chart-mask">AGGREGATING CATEGORY LOAD...</div>
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
const orbitPhase = ref(0)
let orbitTimer = null

const abbreviate = (name) => {
  const text = String(name || '').trim()
  if (!text) return 'N/A'
  if (/^[A-Za-z0-9_\-\s]+$/.test(text)) {
    return text
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.slice(0, 3).toUpperCase())
      .join('-')
  }

  return text.slice(0, 3)
}

const statusTone = (percent) => {
  if (percent >= 40) return { label: 'CRITICAL', color: '#ff0055' }
  if (percent >= 22) return { label: 'WARNING', color: '#ff6a00' }
  return { label: 'STABLE', color: '#00ff9d' }
}

const buildGearSegments = () =>
  Array.from({ length: 48 }, (_, index) => ({
    value: 1,
    itemStyle: {
      color: index % 2 === 0 ? 'rgba(0,229,255,0.28)' : 'rgba(0,229,255,0.03)',
      borderWidth: 0,
    },
  }))

const buildOption = () => {
  const fullscreen = props.fullscreen
  const categoryQuality = props.stats?.category_quality || []
  const categories = categoryQuality.length
    ? categoryQuality.slice(0, 7)
    : (props.stats?.category_counts || []).slice(0, 7).map((item) => ({
        name: item.name,
        value: Number(item.value) || 0,
        avg_confidence: 0,
        top_tags: [],
      }))

  const total = categories.reduce((sum, item) => sum + (Number(item.value) || 0), 0)
  const peakVal = Math.max(...categories.map((item) => Number(item.value) || 0), 0)
  const centerTitle = total ? `${total}` : '--'
  const weightedConfidence = total
    ? categories.reduce((sum, item) => sum + (Number(item.value) || 0) * (Number(item.avg_confidence) || 0), 0) / total
    : 0
  const centerSub = total
    ? `AVG CONFIDENCE ${weightedConfidence.toFixed(1)}%`
    : 'NO CATEGORY DATA'

  const centerX = '50%'
  const centerY = fullscreen ? '44%' : '44%'
  const centerCoord = [centerX, centerY]

  const enriched = categories.map((item, idx) => {
    const value = Number(item.value) || 0
    const percent = total ? Number(((value / total) * 100).toFixed(1)) : 0
    const isPeak = value === peakVal && peakVal > 0
    const color = colorPool[idx % colorPool.length]
    return {
      value,
      name: item.name,
      confidence: Number(item.avg_confidence) || 0,
      itemStyle: {
        color,
        borderColor: '#050814',
        borderWidth: 2,
        shadowBlur: isPeak ? 18 : 8,
        shadowColor: isPeak ? `${color}cc` : `${color}55`,
      },
      label: {
        formatter: (params) => {
          const labelAbbr = abbreviate(params.name)
          return `{abbr|[${labelAbbr}]}  {val|${params.value}}`
        },
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 28,
          shadowColor: `${color}f2`,
        },
      },
      tooltip: {
        valueFormatter: (val) => `${val}`,
      },
      percent,
    }
  })

  const tagSeries = []
  categories.forEach((category, idx) => {
    const parentColor = colorPool[idx % colorPool.length]
    ;(category.top_tags || []).slice(0, 3).forEach((tagItem) => {
      tagSeries.push({
        value: Number(tagItem.value) || 0,
        name: `${abbreviate(category.name)} · ${tagItem.name}`,
        parent: category.name,
        confidence: Number(tagItem.avg_confidence) || Number(category.avg_confidence) || 0,
        itemStyle: {
          color: echarts.color.lift(parentColor, 0.18),
          borderColor: '#071126',
          borderWidth: 1,
          opacity: 0.95,
        },
      })
    })
  })

  const mainCategoryNames = categories.map((item) => item.name)
  const allTagNames = tagSeries.map((item) => item.name)
  const legendData = fullscreen ? [...mainCategoryNames, ...allTagNames] : mainCategoryNames

  return {
    backgroundColor: 'transparent',
    tooltip: createCyberTooltip({
      size: 'sm',
      trigger: 'item',
      formatter: (params) => {
        const value = Number(params.value) || 0
        const percent = Number(params.percent) || 0
        const confidence = Number(params.data?.confidence) || 0
        const parent = params.data?.parent ? `<div class="cyber-tip-row"><span>Cluster</span><strong>${params.data.parent}</strong></div>` : ''
        const tone = statusTone(percent)
        return [
          '<div class="cyber-tip-body">',
          `<div class="cyber-tip-head"><span class="state-dot" style="background:${tone.color}"></span>${tone.label}</div>`,
          `<div class="cyber-tip-title">${params.name || 'UNKNOWN'}</div>`,
          parent,
          '<div class="cyber-tip-row"><span>Records</span><strong>' + value + '</strong></div>',
          '<div class="cyber-tip-row"><span>Share</span><strong>' + percent.toFixed(1) + '%</strong></div>',
          '<div class="cyber-tip-row"><span>Confidence</span><strong>' + confidence.toFixed(1) + '%</strong></div>',
          '</div>',
        ].join('')
      },
    }),
    legend: {
      show: true,
      type: 'scroll',
      orient: 'horizontal',
      left: 'center',
      bottom: fullscreen ? 24 : 10,
      width: fullscreen ? '88%' : '94%',
      data: legendData,
      itemWidth: fullscreen ? 10 : 8,
      itemHeight: fullscreen ? 10 : 8,
      itemGap: fullscreen ? 16 : 12,
      padding: fullscreen ? [10, 20] : [8, 10],
      icon: 'circle',
      pageIconColor: '#00e5ff',
      pageIconInactiveColor: 'rgba(0,229,255,0.2)',
      pageTextStyle: { color: '#c8d8e6' },
      textStyle: {
        color: '#c8d8e6',
        fontFamily: 'Roboto Mono',
        fontSize: fullscreen ? 11 : 10,
        lineHeight: fullscreen ? 16 : 14,
        verticalAlign: 'middle',
      },
    },
    title: [
      {
        text: centerTitle,
        left: centerX,
        top: fullscreen ? '39.5%' : '39.5%',
        textAlign: 'center',
        textStyle: {
          color: '#eaf7ff',
          fontFamily: 'Roboto Mono',
          fontSize: fullscreen ? 24 : 20,
          fontWeight: 700,
          textShadowColor: 'rgba(0,229,255,0.55)',
          textShadowBlur: 14,
        },
      },
      {
        text: centerSub,
        left: centerX,
        top: fullscreen ? '49.5%' : '50.5%',
        textAlign: 'center',
        textStyle: {
          color: 'rgba(173,225,245,0.78)',
          fontFamily: 'Roboto Mono',
          fontSize: fullscreen ? 10 : 9,
          letterSpacing: 2,
        },
      },
    ],
    series: [
      {
        id: 'innerGearOrbit',
        name: 'Inner Gear Orbit',
        type: 'pie',
        silent: true,
        radius: fullscreen ? ['24%', '28%'] : ['22%', '26%'],
        center: centerCoord,
        startAngle: orbitPhase.value,
        clockwise: false,
        animation: false,
        z: 1,
        label: { show: false },
        labelLine: { show: false },
        data: buildGearSegments(),
      },
      {
        id: 'categoryMainRing',
        name: 'Category',
        type: 'pie',
        radius: fullscreen ? ['46%', '70%'] : ['42%', '65%'],
        center: centerCoord,
        avoidLabelOverlap: true,
        selectedMode: 'single',
        startAngle: 110,
        minAngle: 6,
        padAngle: 1,
        label: {
          show: true,
          alignTo: 'labelLine',
          distanceToLabelLine: 5,
          color: '#d7edf8',
          fontFamily: 'Roboto Mono',
          fontSize: fullscreen ? 11 : 10,
          lineHeight: fullscreen ? 16 : 15,
          rich: {
            abbr: {
              color: '#7eeeff',
              fontWeight: 600,
              fontSize: fullscreen ? 10 : 9,
            },
            val: {
              color: '#f4fbff',
              fontWeight: 700,
              fontSize: fullscreen ? 12 : 11,
            },
          },
        },
        emphasis: {
          scale: true,
          scaleSize: 5,
          label: {
            show: true,
            position: 'center',
            formatter: (params) => `{name|${params.name}}\n{value|${params.value}}\n{ratio|${(params.percent || 0).toFixed(1)}%}`,
            rich: {
              name: {
                color: '#8befff',
                fontSize: fullscreen ? 11 : 10,
                fontFamily: 'Roboto Mono',
              },
              value: {
                color: '#ffffff',
                fontSize: fullscreen ? 24 : 20,
                fontWeight: 700,
                fontFamily: 'Roboto Mono',
                padding: [4, 0, 2, 0],
              },
              ratio: {
                color: '#7fffc4',
                fontSize: fullscreen ? 11 : 10,
                fontFamily: 'Roboto Mono',
              },
            },
          },
        },
        labelLine: {
          show: true,
          smooth: 0.2,
          length: fullscreen ? 18 : 12,
          length2: fullscreen ? 24 : 16,
          minTurnAngle: 90,
          maxSurfaceAngle: 90,
          lineStyle: {
            width: 1,
            type: 'dashed',
            color: 'rgba(124,230,255,0.75)',
          },
        },
        itemStyle: {
          borderColor: '#050814',
          borderWidth: 2,
        },
        data: enriched,
        markPoint: {
          symbol: 'pin',
          symbolSize: fullscreen ? 34 : 30,
          itemStyle: {
            color: '#ff0055',
            shadowBlur: 16,
            shadowColor: 'rgba(255,0,85,0.8)',
          },
          label: {
            color: '#fff',
            fontSize: fullscreen ? 8 : 9,
            formatter: 'ALERT',
          },
          data: total ? [{ type: 'max', name: 'Peak' }] : [],
        },
      },
      {
        id: 'categoryTagRing',
        name: 'Tag Cluster',
        type: 'pie',
        silent: false,
        radius: fullscreen ? ['32%', '42%'] : ['29%', '38%'],
        center: centerCoord,
        startAngle: 95,
        padAngle: 1,
        minAngle: 3,
        itemStyle: {
          borderColor: '#050814',
          borderWidth: 1,
        },
        label: {
          show: false,
        },
        labelLine: { show: false },
        data: tagSeries,
      },
      {
        id: 'outerOrbitRing',
        name: 'Outer Orbit',
        type: 'pie',
        silent: true,
        radius: fullscreen ? ['82%', '83.5%'] : ['78%', '79.2%'],
        center: centerCoord,
        z: 0,
        animation: false,
        label: { show: false },
        labelLine: { show: false },
        data: [{ value: 100, itemStyle: { color: 'rgba(98,224,255,0.18)' } }],
      },
      {
        id: 'outerCometNode',
        name: 'Comet Node',
        type: 'pie',
        silent: true,
        radius: fullscreen ? ['82%', '83.8%'] : ['78%', '79.5%'],
        center: centerCoord,
        startAngle: -orbitPhase.value * 1.5,
        z: 3,
        animation: false,
        label: { show: false },
        labelLine: { show: false },
        data: [
          {
            value: 3,
            itemStyle: {
              color: '#b5fcff',
              shadowBlur: 20,
              shadowColor: 'rgba(0,229,255,0.95)',
            },
          },
          {
            value: 97,
            itemStyle: {
              color: 'rgba(0,0,0,0)',
            },
          },
        ],
      },
    ],
    graphic: [
      ...createHudCornerGraphics({
        fullscreen,
        left: [14, 10],
        top: [10, 8],
        right: [18, 12],
        bottom: [14, 10],
        lineLength: 34,
        lineHeight: 14,
        colorLeft: 'rgba(0,229,255,0.4)',
        colorRight: 'rgba(0,229,255,0.35)',
        z: 12,
      }),
      ...(categories.length
        ? []
        : [createNoDataGraphic('NO CATEGORY DATA', fullscreen)]),
    ],
  }
}

const emit = defineEmits(['chart-click'])

const { chartRef, setPartialOption } = useEcharts(buildOption, () => [props.stats, props.fullscreen], {
  deep: false,
  throttleMs: 90,
  debounceMs: 180,
  onClick: (params) => {
    if (params.name) {
      emit('chart-click', params)
    }
  }
})

const pauseOrbit = () => {
  if (orbitTimer) {
    clearInterval(orbitTimer)
    orbitTimer = null
  }
}

const resumeOrbit = () => {
  if (!orbitTimer) {
    orbitTimer = setInterval(() => {
      orbitPhase.value = (orbitPhase.value + 2) % 360
      setPartialOption({
        series: [
          { id: 'innerGearOrbit', startAngle: orbitPhase.value },
          { id: 'outerCometNode', startAngle: -orbitPhase.value * 1.5 },
        ],
      })
    }, 120)
  }
}

onMounted(() => {
  resumeOrbit()
})

onBeforeUnmount(() => {
  pauseOrbit()
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