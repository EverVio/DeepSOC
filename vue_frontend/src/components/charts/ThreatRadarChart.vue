<template>
  <div class="chart-wrap">
    <div class="radar-scan-overlay" :style="scanOverlayStyle" aria-hidden="true">
      <div class="radar-scan-hex"></div>
    </div>
    <div ref="chartRef" class="chart-canvas"></div>
    <div v-if="loading" class="chart-mask">EVALUATING THREAT POSTURE...</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
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

const getRadarLayout = (fullscreen) => {
  if (fullscreen) {
    return {
      center: ['50%', '55%'],
      radius: '74%',
    }
  }

  return {
    center: ['50%', '54%'],
    radius: '68%',
  }
}

const scanOverlayStyle = computed(() => {
  const { center, radius } = getRadarLayout(props.fullscreen)
  const radiusPercent = Number.parseFloat(String(radius).replace('%', '')) || 68
  const overlayHalfPercent = `${radiusPercent / 2}%`
  return {
    '--scan-center-x': center[0],
    '--scan-center-y': center[1],
    '--scan-size': overlayHalfPercent,
    '--scan-breathe-min': props.fullscreen ? '0.38' : '0.36',
    '--scan-breathe-max': props.fullscreen ? '0.56' : '0.52',
  }
})

const rateLevel = (value, max) => {
  if (!max) return { grade: 'C', color: '#7ba7bc' }
  const ratio = value / max
  if (ratio >= 0.76) return { grade: 'A', color: '#ff0055' }
  if (ratio >= 0.5) return { grade: 'B', color: '#ff6a00' }
  return { grade: 'C', color: '#00ff9d' }
}

const getThreatValues = () => {
  const radarTactics = props.stats?.radar_tactics || {}
  const indicators = Array.isArray(radarTactics.indicators) ? radarTactics.indicators : []

  if (indicators.length) {
    const totalValues = (radarTactics.total_values || []).map((value) => Number(value) || 0)
    const verifiedValues = (radarTactics.verified_values || []).map((value) => Number(value) || 0)
    const normalizedTotal = indicators.map((_, idx) => totalValues[idx] || 0)
    const normalizedVerified = indicators.map((_, idx) => verifiedValues[idx] || 0)
    const verifiedDisplayValues = normalizedVerified.map((value, idx) => {
      const limit = Math.max(0, Math.round((normalizedTotal[idx] || 0) * 0.86))
      return Math.min(value, limit)
    })
    return {
      indicators: indicators.map((item) => String(item.name || 'Unknown')),
      indicatorMax: indicators.map((item, idx) => Math.max(Number(item.max) || 0, normalizedTotal[idx], normalizedVerified[idx], 1)),
      totalValues: normalizedTotal,
      verifiedValues: normalizedVerified,
      verifiedDisplayValues,
    }
  }

  const threat = props.stats?.threat_distribution || []
  const high = Number(threat.find((item) => item.level === 'high')?.value || 0)
  const medium = Number(threat.find((item) => item.level === 'medium')?.value || 0)
  const low = Number(threat.find((item) => item.level === 'low')?.value || 0)
  const fallbackIndicators = ['Initial Access', 'Execution', 'Defense Evasion', 'Collection', 'Command and Control']
  const fallbackTotal = [high, medium, low, Math.round((high + medium) * 0.55), Math.round((high + low) * 0.48)]
  const fallbackVerified = fallbackTotal.map((value) => Math.max(0, Math.round(value * 0.62)))
  const fallbackVerifiedDisplay = fallbackVerified.map((value, idx) => Math.min(value, Math.max(0, Math.round(fallbackTotal[idx] * 0.86))))
  return {
    indicators: fallbackIndicators,
    indicatorMax: fallbackTotal.map((value, idx) => Math.max(value, fallbackVerified[idx], 1)),
    totalValues: fallbackTotal,
    verifiedValues: fallbackVerified,
    verifiedDisplayValues: fallbackVerifiedDisplay,
  }
}

const buildOption = () => {
  const fullscreen = props.fullscreen
  const { indicators, indicatorMax, totalValues, verifiedValues, verifiedDisplayValues } = getThreatValues()
  const maxVal = Math.max(...indicatorMax, 1)
  const { center: radarCenter, radius: radarRadius } = getRadarLayout(fullscreen)
  const indicatorConfig = indicators.map((item, idx) => {
    const value = Number(totalValues[idx]) || 0
    const level = rateLevel(value, maxVal)
    return {
      name: `{en|${item}}\n{grade|${level.grade}}\n{cross|+}`,
      max: Number(indicatorMax[idx]) || maxVal,
    }
  })

  return {
    backgroundColor: 'transparent',
    tooltip: createCyberTooltip({
      size: 'lg',
      trigger: 'item',
      formatter: (params) => {
        if (!Array.isArray(params.value)) return ''

        const rows = indicators
          .map((item, idx) => {
            const value = params.seriesName === 'Verified Threats'
              ? Number(verifiedValues[idx]) || 0
              : Number(totalValues[idx]) || 0
            const tone = rateLevel(value, maxVal)
            const displayName = params.seriesName === 'Verified Threats' ? `${item} · Verified` : item
            return `<div class="cyber-tip-row"><span><i class="state-dot" style="background:${tone.color}"></i>${displayName}</span><strong>${value}</strong></div>`
          })
          .join('')
        return [
          '<div class="cyber-tip-body">',
          `<div class="cyber-tip-head">${params.seriesName || 'THREAT PROFILE'}</div>`,
          rows,
          '</div>',
        ].join('')
      },
    }),
    radar: {
      center: radarCenter,
      radius: radarRadius,
      splitNumber: fullscreen ? 4 : 5,
      axisName: {
        color: '#eef5ff',
        fontFamily: 'Roboto Mono',
        fontSize: fullscreen ? 9 : 10,
        fontWeight: 600,
        rich: {
          en: {
            color: '#c7f1ff',
            fontSize: fullscreen ? 9 : 10,
            lineHeight: fullscreen ? 13 : 14,
            fontWeight: 700,
          },
          zh: {
            color: '#87c0d8',
            fontSize: fullscreen ? 8 : 9,
            lineHeight: fullscreen ? 12 : 13,
          },
          grade: {
            color: '#00ff9d',
            fontSize: fullscreen ? 8 : 9,
            lineHeight: fullscreen ? 12 : 13,
            fontWeight: 700,
          },
          cross: {
            color: 'rgba(0,229,255,0.9)',
            fontSize: fullscreen ? 9 : 10,
            lineHeight: fullscreen ? 11 : 12,
            fontWeight: 700,
          },
        },
      },
      splitArea: {
        areaStyle: {
          color: fullscreen
            ? ['rgba(0,229,255,0.02)', 'rgba(0,229,255,0.07)']
            : ['rgba(0,229,255,0.015)', 'rgba(0,229,255,0.05)'],
        },
      },
      axisLine: {
        lineStyle: {
          color: 'rgba(0,229,255,0.42)',
          shadowBlur: 8,
          shadowColor: 'rgba(0,229,255,0.35)',
        },
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(0,255,157,0.35)',
          type: 'dashed',
        },
      },
      indicator: indicatorConfig,
    },
    series: [
      {
        id: 'radarHaloRing',
        name: 'Radar Halo',
        type: 'pie',
        radius: fullscreen ? ['76%', '77.5%'] : ['70%', '71.5%'],
        center: radarCenter,
        silent: true,
        z: 0,
        animation: false,
        label: { show: false },
        labelLine: { show: false },
        data: [{ value: 100, itemStyle: { color: 'rgba(0,229,255,0.2)' } }],
      },
      {
        id: 'baselineEnvelope',
        name: 'Baseline Envelope',
        type: 'radar',
        silent: true,
        z: 1,
        symbol: 'none',
        lineStyle: {
          color: 'rgba(103,154,176,0.65)',
          width: 1,
          type: 'dashed',
        },
        areaStyle: {
          opacity: 0,
        },
        data: [
          {
            value: totalValues.map((value) => Math.max(1, Math.round(value * 0.75))),
          },
        ],
      },
      {
        id: 'threatProfileLayer',
        type: 'radar',
        name: 'Total Threats',
        z: 3,
        symbol: 'diamond',
        symbolSize: fullscreen ? 6 : 5,
        showSymbol: true,
        lineStyle: {
          color: '#ff0055',
          width: 1.8,
          shadowBlur: 10,
          shadowColor: 'rgba(255,0,85,0.5)',
        },
        areaStyle: {
          color: 'rgba(255,0,85,0.26)',
          shadowBlur: 16,
          shadowColor: 'rgba(255,0,85,0.42)',
        },
        itemStyle: {
          color: '#ff0055',
          borderColor: '#ffd6e4',
          borderWidth: 1,
        },
        data: [
          {
            value: totalValues,
            name: 'Total Threats',
          },
        ],
      },
      {
        id: 'verifiedThreatLayer',
        type: 'radar',
        name: 'Verified Threats',
        z: 4,
        symbol: 'circle',
        symbolSize: fullscreen ? 4 : 3,
        showSymbol: true,
        lineStyle: {
          color: '#00e5ff',
          width: 1.35,
          type: 'dashed',
          shadowBlur: 8,
          shadowColor: 'rgba(0,229,255,0.48)',
        },
        areaStyle: {
          color: 'rgba(0,229,255,0.04)',
        },
        itemStyle: {
          color: '#00e5ff',
          borderColor: '#dff8ff',
          borderWidth: 1,
        },
        data: [
          {
            value: verifiedDisplayValues,
            name: 'Verified Threats',
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
        bottom: [12, 8],
        lineLength: 30,
        lineHeight: 14,
        colorLeft: 'rgba(0,229,255,0.45)',
        colorRight: 'rgba(0,229,255,0.4)',
        z: 10,
      }),
      ...(totalValues.reduce((sum, value) => sum + (Number(value) || 0), 0)
        ? []
        : [createNoDataGraphic('NO THREAT DATA', fullscreen)]),
    ],
  }
}

const emit = defineEmits(['chart-click'])

const { chartRef } = useEcharts(buildOption, () => [props.stats, props.fullscreen], {
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
  overflow: hidden;
}

.chart-canvas {
  width: 100%;
  height: 100%;
  min-height: 205px;
  position: relative;
  z-index: 1;
}

.radar-scan-overlay {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.radar-scan-hex {
  position: absolute;
  left: var(--scan-center-x, 50%);
  top: var(--scan-center-y, 54%);
  width: calc(var(--scan-size, 68%) * 2);
  height: calc(var(--scan-size, 68%) * 2);
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: conic-gradient(from 0deg, rgba(0, 229, 255, 0) 0deg, rgba(0, 255, 180, 0.02) 80deg, rgba(0, 229, 255, 0.18) 92deg, rgba(0, 229, 255, 0.02) 108deg, rgba(0, 229, 255, 0) 122deg, rgba(0, 229, 255, 0) 360deg);
  border: 1px solid rgba(0, 229, 255, 0.1);
  box-shadow: inset 0 0 18px rgba(0, 229, 255, 0.08);
  filter: saturate(0.85);
  animation: radar-hex-breathe 5.2s ease-in-out infinite;
}

.radar-scan-hex::before,
.radar-scan-hex::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
}

.radar-scan-hex::before {
  background: none;
  opacity: 0;
}

.radar-scan-hex::after {
  background: conic-gradient(from 0deg, rgba(0, 229, 255, 0) 0deg, rgba(0, 229, 255, 0.05) 82deg, rgba(0, 229, 255, 0.34) 90deg, rgba(0, 229, 255, 0.07) 98deg, rgba(0, 229, 255, 0) 112deg, rgba(0, 229, 255, 0) 360deg);
  mix-blend-mode: screen;
  filter: blur(1px);
  transform-origin: center;
  animation: radar-sweep-rotate 6.2s linear infinite;
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

@keyframes radar-sweep-rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes radar-hex-breathe {
  0%, 100% {
    opacity: var(--scan-breathe-min, 0.36);
    transform: translate(-50%, -50%) scale(0.985);
  }
  50% {
    opacity: var(--scan-breathe-max, 0.52);
    transform: translate(-50%, -50%) scale(1.01);
  }
}
</style>