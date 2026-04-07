<template>
  <div class="chart-wrap" @mouseleave="scheduleOrbitResume">
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
let orbitResumeTimer = null

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

const isInteractiveCategoryHit = (params) =>
  params?.componentType === 'series' &&
  params?.seriesType === 'pie' &&
  params?.event?.target?.type === 'sector'

// 增强齿轮环视觉表现，形成大小不一的科技刻度感
const buildGearSegments = () =>
  Array.from({ length: 48 }, (_, index) => {
    const isMajor = index % 8 === 0
    return {
      value: isMajor ? 2 : 1,
      itemStyle: {
        color: isMajor ? 'rgba(0,229,255,0.45)' : (index % 2 === 0 ? 'rgba(0,229,255,0.18)' : 'rgba(0,229,255,0.02)'),
        borderWidth: 0,
      },
    }
  })

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

  // 图例分屏排布逻辑
  const mid = Math.ceil(legendData.length / 2)
  const leftLegend = legendData.slice(0, mid)
  const rightLegend = legendData.slice(mid)

  const sharedLegendConfig = {
    type: 'scroll',
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
      width: fullscreen ? 140 : 'auto',
      overflow: 'truncate'
    },
    itemWidth: fullscreen ? 10 : 8,
    itemHeight: fullscreen ? 10 : 8,
    itemGap: fullscreen ? 16 : 12,
  }

  const legendConfig = fullscreen
    ? [
        {
          ...sharedLegendConfig,
          orient: 'vertical',
          left: '2%',
          top: 'middle',
          height: '75%',
          data: leftLegend,
        },
        {
          ...sharedLegendConfig,
          orient: 'vertical',
          right: '2%',
          top: 'middle',
          height: '75%',
          data: rightLegend,
        },
      ]
    : {
        ...sharedLegendConfig,
        orient: 'horizontal',
        left: 'center',
        bottom: 10,
        width: '94%',
        data: legendData,
      }

  return {
    backgroundColor: 'transparent',

    animation: true,
    animationDuration: 100,       
    animationDurationUpdate: 400, 
    animationEasing: 'cubicOut',  

    // 新增：使用全局 DOM Tooltip，复用 cyberChartTheme.css 中的样式
    tooltip: createCyberTooltip({
      className: 'cyber-tooltip category-tooltip', 
      trigger: 'item',
      formatter: (params) => {
        // 仅对主分类环显示提示
        if (params.seriesId !== 'categoryMainRing') return '';
        
        const conf = params.data?.confidence || 0;
        const percent = (params.percent || 0).toFixed(1);
        
        return `
          <div class="cyber-tip-body">
            <div class="cyber-tip-title" style="color: #8befff; font-family: 'Roboto Mono'; font-weight: 700; font-size: ${fullscreen ? '12px' : '11px'};">
              ${params.name}
            </div>
            <div class="cyber-tip-row">
              <span style="color: #7ba7bc;">COUNT: </span> 
              <strong style="color: #ffffff; font-family: 'Roboto Mono'; font-size: ${fullscreen ? '12px' : '11px'};">${params.value}</strong>
            </div>
            <div class="cyber-tip-row">
              <span style="color: #7ba7bc;">SHARE: </span> 
              <strong style="color: #7fffc4; font-family: 'Roboto Mono'; font-size: ${fullscreen ? '11px' : '10px'};">${percent}%</strong>
            </div>
            <div class="cyber-tip-row">
              <span style="color: #7ba7bc;">CONF:  </span> 
              <strong style="color: #ff0055; font-family: 'Roboto Mono'; font-size: ${fullscreen ? '11px' : '10px'};">${conf.toFixed(1)}%</strong>
            </div>
          </div>
        `;
      }
    }),

    legend: legendConfig,
    title: [
      {
        show: fullscreen,
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
        show: fullscreen,
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
      // 新增：内圈彗星光效
      {
        id: 'innerCometNode',
        name: 'Inner Comet',
        type: 'pie',
        silent: true,
        radius: fullscreen ? ['20%', '21.5%'] : ['18%', '19.5%'],
        center: centerCoord,
        startAngle: orbitPhase.value * 3,
        z: 3,
        animation: false,
        label: { show: false },
        labelLine: { show: false },
        data: [
          {
            value: 4,
            itemStyle: {
              color: '#7effa1',
              shadowBlur: 14,
              shadowColor: 'rgba(126,255,161,0.9)',
            },
          },
          { value: 96, itemStyle: { color: 'rgba(0,0,0,0)' } },
        ],
      },
      {
        id: 'categoryMainRing',
        name: 'Category',
        type: 'pie',
        radius: fullscreen ? ['46%', '70%'] : ['42%', '65%'],
        animationType: 'expansion',
        animationDuration: 500,     
        animationEasing: 'cubicOut',
        animationDelay: (idx) => idx * 15,
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
          labelLine: {
            show: true,
            lineStyle: {
              width: 2,
              color: 'rgba(0,229,255,0.8)',
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
        animationDuration: 400,
        animationDelay: (idx) => idx * 10,
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
  throttleMs: 40, // 降低节流阈值以匹配更高帧率动画
  debounceMs: 150,
  onMouseOver: (params) => {
    if (!isInteractiveCategoryHit(params)) return

    if (orbitResumeTimer) {
      clearTimeout(orbitResumeTimer)
      orbitResumeTimer = null
    }

    pauseOrbit()
  },
  onMouseOut: (params) => {
    if (!isInteractiveCategoryHit(params)) return

    scheduleOrbitResume()
  },
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

const scheduleOrbitResume = () => {
  if (orbitResumeTimer) {
    clearTimeout(orbitResumeTimer)
  }

  orbitResumeTimer = setTimeout(() => {
    orbitResumeTimer = null
    resumeOrbit()
  }, 80)
}

const resumeOrbit = () => {
  if (orbitResumeTimer) {
    clearTimeout(orbitResumeTimer)
    orbitResumeTimer = null
  }

  if (!orbitTimer) {
    orbitTimer = setInterval(() => {
      orbitPhase.value = (orbitPhase.value + 1) % 360
      setPartialOption({
        series: [
          { id: 'innerGearOrbit', startAngle: orbitPhase.value },
          { id: 'innerCometNode', startAngle: orbitPhase.value * 3 },
        ],
      })
    }, 40) // 从120ms缩短到40ms (~25fps) 使动态更流畅
  }
}

onMounted(() => {
  resumeOrbit()
})

onBeforeUnmount(() => {
  if (orbitResumeTimer) {
    clearTimeout(orbitResumeTimer)
    orbitResumeTimer = null
  }
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