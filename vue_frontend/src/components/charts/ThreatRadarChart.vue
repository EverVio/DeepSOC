<template>
  <div class="chart-wrap">
    <div class="radar-scan-overlay" :style="scanOverlayStyle" aria-hidden="true">
      <div ref="hexContainerRef" class="radar-scan-hex">
        <canvas ref="particleCanvasRef" class="radar-particles"></canvas>
      </div>
    </div>
    <div ref="chartRef" class="chart-canvas"></div>
    <div v-if="loading" class="cyber-loading-mask">
      <div class="cyber-spinner"></div>
      <span>EVALUATING THREAT POSTURE...</span>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount, onActivated, onDeactivated } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import { useEcharts } from '../../composables/useEcharts'
import { createCyberTooltip, createHudCornerGraphics, createNoDataGraphic } from './cyberChartTheme'
import { FLOW_COLORS, RISK_COLORS } from '../../constants/colorPalette'

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
  if (fullscreen) return { center: ['50%', '50%'], radius: '75%' }
  return { center: ['50%', '50%'], radius: '60%' }
}

const rateLevel = (value, max) => {
  if (!max) return { grade: 'C', color: RISK_COLORS.low }
  const ratio = value / max
  if (ratio >= 0.76) return { grade: 'A', color: RISK_COLORS.critical }
  if (ratio >= 0.5) return { grade: 'B', color: RISK_COLORS.high }
  return { grade: 'C', color: RISK_COLORS.medium }
}

const TACTIC_ABBR = {
  'Initial Access': 'INIT ACCESS',
  Execution: 'EXEC',
  Persistence: 'PRST',
  'Privilege Escalation': 'PRIV ESC',
  'Defense Evasion': 'EVASION',
  'Credential Access': 'CRED ACCESS',
  Discovery: 'DSCOV',
  'Lateral Movement': 'LAT MOV',
  Collection: 'COLL',
  'Command and Control': 'C&C',
  Exfiltration: 'EXFIL',
  Impact: 'IMPACT',
}

const abbreviateTactic = (name) => TACTIC_ABBR[String(name)] || String(name).toUpperCase()

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

const scanOverlayStyle = computed(() => {
  const { center, radius } = getRadarLayout(props.fullscreen)
  const radiusPercent = Number.parseFloat(String(radius).replace('%', '')) || 68
  const { indicators } = getThreatValues()
  const n = indicators.length || 5
  const points = Array.from({ length: n }).map((_, i) => {
    const angleDeg = 90 - (360 / n) * i
    const angleRad = (angleDeg * Math.PI) / 180
    const x = 50 + 50 * Math.cos(angleRad)
    const y = 50 - 50 * Math.sin(angleRad)
    return `${x.toFixed(2)}% ${y.toFixed(2)}%`
  })

  return {
    '--scan-center-x': center[0],
    '--scan-center-y': center[1],
    '--scan-radius': radiusPercent, 
    '--scan-clip': `polygon(${points.join(', ')})`,
    '--scan-breathe-min': props.fullscreen ? '0.38' : '0.36',
    '--scan-breathe-max': props.fullscreen ? '0.56' : '0.52',
  }
})

const buildOption = () => {
  const fullscreen = props.fullscreen
  const { indicators, indicatorMax, totalValues, verifiedValues, verifiedDisplayValues } = getThreatValues()
  const maxVal = Math.max(...indicatorMax, 1)
  const { center: radarCenter, radius: radarRadius } = getRadarLayout(fullscreen)

  const indicatorConfig = indicators.map((item, idx) => {
    const value = Number(totalValues[idx]) || 0
    const level = rateLevel(value, maxVal)
    const gradeStyle = `grade${level.grade}`
    const shortName = abbreviateTactic(item)
    return {
      name: `{en|${shortName}}\n{${gradeStyle}|${level.grade}}`,
      max: Number(indicatorMax[idx]) || maxVal,
    }
  })

  return {
    backgroundColor: 'transparent',
    tooltip: createCyberTooltip({
      className: 'cyber-tooltip category-tooltip',
      trigger: 'item',
      formatter: (params) => {
        if (!Array.isArray(params.value)) return ''
        const rows = indicators
          .map((item, idx) => {
            const value = params.seriesName === 'Verified Threats'
              ? Number(verifiedValues[idx]) || 0
              : Number(totalValues[idx]) || 0
            const tone = rateLevel(value, maxVal)
            const displayName = item
            return `
              <div class="cyber-tip-row">
                <span style="color: #7ba7bc; display: inline-flex; align-items: center; gap: 6px;">
                  <i class="state-dot" style="background:${tone.color}"></i>${displayName.toUpperCase()}: 
                </span>
                <strong style="color: #ffffff; font-family: 'Roboto Mono'; font-size: ${fullscreen ? '12px' : '12px'};">${value}</strong>
              </div>`
          })
          .join('')
        return `
          <div class="cyber-tip-body">
            <div class="cyber-tip-title" style="color: #8befff; font-family: 'Roboto Mono'; font-weight: 500; font-size: ${fullscreen ? '12px' : '12px'};">
              ${params.seriesName || 'THREAT PROFILE'}
            </div>
            ${rows}
          </div>
        `
      },
    }),
    radar: {
      center: radarCenter,
      radius: radarRadius,
      splitNumber: fullscreen ? 4 : 5,
      axisName: {
        color: '#eef5ff',
        fontFamily: 'Roboto Mono',
        nameGap: fullscreen ? 24 : 14,
        fontSize: fullscreen ? 12 : 12,
        fontWeight: 500,
        rich: {
          en: {
            color: '#00e5ff',
            fontSize: fullscreen ? 20 : 12,
            lineHeight: fullscreen ? 30 : 12,
            fontWeight: 500,
            textShadowColor: 'rgba(0, 229, 255, 0.6)',
            textShadowBlur: 2,
            align: 'center',
          },
          gradeA: {
            color: '#ff5b75',
            fontSize: fullscreen ? 24 : 14,
            lineHeight: fullscreen ? 24 : 18,
            fontWeight: 500,
            fontFamily: 'Roboto Mono',
            textShadowColor: 'rgba(255, 91, 117, 0.95)',
            textShadowBlur: 2,
            align: 'center',
          },
          gradeB: {
            color: '#7fffc4',
            fontSize: fullscreen ? 24 : 14,
            lineHeight: fullscreen ? 24 : 18,
            fontWeight: 500,
            fontFamily: 'Roboto Mono',
            marginLeft: 4,
            textShadowColor: 'rgba(127, 255, 196, 0.9)',
            textShadowBlur: 2,
            align: 'center',
          },
          gradeC: {
            color: '#8befff',
            fontSize: fullscreen ? 24 : 14,
            lineHeight: fullscreen ? 24 : 18,
            fontWeight: 500,
            fontFamily: 'Roboto Mono',
            marginLeft: 4,
            textShadowColor: 'rgba(139, 239, 255, 0.82)',
            textShadowBlur: 2,
            align: 'center',
          },
        },
      },
      splitArea: {
        areaStyle: {
          color: fullscreen ? ['rgba(0,229,255,0.03)', 'rgba(0,229,255,0.1)'] : ['rgba(0,229,255,0.015)', 'rgba(0,229,255,0.05)'],
        },
      },
      axisLine: {
        lineStyle: {
          color: 'rgba(0,229,255,0.58)',
          width: fullscreen ? 1.8 : 1.2,
          shadowBlur: 10,
          shadowColor: 'rgba(0,229,255,0.42)',
        },
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(0,255,157,0.5)',
          width: fullscreen ? 1.2 : 0.9,
          type: 'dashed',
          shadowBlur: 6,
          shadowColor: 'rgba(0,255,157,0.22)',
        },
      },
      indicator: indicatorConfig,
    },
    series: [
      {
        id: 'baselineEnvelope',
        name: 'Baseline Envelope',
        type: 'radar',
        silent: true,
        z: 1,
        symbol: 'none',
        lineStyle: { color: 'rgba(103,154,176,0.65)', width: 1, type: 'dashed' },
        areaStyle: { opacity: 0 },
        data: [{ value: totalValues.map((value) => Math.max(1, Math.round(value * 0.75))) }],
      },
      {
        id: 'threatProfileLayer',
        type: 'radar',
        name: 'Total Threats',
        z: 3,
        symbol: 'diamond',
        symbolSize: fullscreen ? 6 : 5,
        showSymbol: true,
        lineStyle: { color: RISK_COLORS.critical, width: fullscreen ? 2.6 : 1.8, shadowBlur: 14, shadowColor: 'rgba(255,23,68,0.62)' },
        areaStyle: { color: 'rgba(255,23,68,0.3)', shadowBlur: 18, shadowColor: 'rgba(255,23,68,0.48)' },
        itemStyle: { color: RISK_COLORS.critical, borderColor: '#ffd6e4', borderWidth: 1 },
        data: [{ value: totalValues, name: 'Total Threats' }],
      },
      {
        id: 'verifiedThreatLayer',
        type: 'radar',
        name: 'Verified Threats',
        z: 4,
        symbol: 'circle',
        symbolSize: fullscreen ? 4 : 3,
        showSymbol: true,
        lineStyle: { color: FLOW_COLORS.normal, width: fullscreen ? 2.1 : 1.35, type: 'dashed', shadowBlur: 12, shadowColor: 'rgba(0,229,255,0.58)' },
        areaStyle: { color: 'rgba(0,229,255,0.06)' },
        itemStyle: { color: FLOW_COLORS.normal, borderColor: '#dff8ff', borderWidth: 1 },
        data: [{ value: verifiedDisplayValues, name: 'Verified Threats' }],
      },
    ],
    graphic: [
      ...createHudCornerGraphics({ fullscreen, z: 10 }),
      ...(totalValues.reduce((sum, value) => sum + (Number(value) || 0), 0) ? [] : [createNoDataGraphic('NO THREAT DATA', fullscreen)]),
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

const hexContainerRef = ref(null)
const particleCanvasRef = ref(null)
let animationFrameId = null
const particles = []

class Particle {
  constructor(w, h) {
    this.reset(w, h)
  }
  reset(w, h) {
    this.x = Math.random() * w
    this.y = Math.random() * h
    this.size = Math.random() * 1.6 + 0.7
    this.vx = (Math.random() - 0.5) * 0.34
    this.vy = (Math.random() - 0.5) * 0.34
    this.life = Math.random() * Math.PI * 2
  }
  update(w, h) {
    this.x += this.vx
    this.y += this.vy
    this.life += 0.025
    if (this.x < 0 || this.x > w || this.y < 0 || this.y > h) this.reset(w, h)
  }
  draw(ctx) {
    const alpha = ((Math.sin(this.life) + 1) / 2) * 0.58 + 0.2
    ctx.globalAlpha = alpha
    ctx.fillStyle = '#7bffd4'
    ctx.shadowBlur = 9
    ctx.shadowColor = 'rgba(0,255,157,0.85)'
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
  }
}

const renderParticles = () => {
  const canvas = particleCanvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const { width, height } = canvas
  ctx.clearRect(0, 0, width, height)
  particles.forEach(p => {
    p.update(width, height)
    p.draw(ctx)
  })
  animationFrameId = requestAnimationFrame(renderParticles)
}

const startParticles = () => {
  if (!animationFrameId) {
    animationFrameId = requestAnimationFrame(renderParticles)
  }
}

const stopParticles = () => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
}

useResizeObserver(hexContainerRef, (entries) => {
  const entry = entries[0]
  const canvas = particleCanvasRef.value
  if (!canvas || !entry) return
  const { width, height } = entry.contentRect
  canvas.width = width
  canvas.height = height
  particles.length = 0
  const count = props.fullscreen ? 55 : 30
  for (let i = 0; i < count; i++) particles.push(new Particle(width, height))
})

onMounted(startParticles)
onActivated(startParticles)
onDeactivated(stopParticles)
onBeforeUnmount(stopParticles)
</script>

<style scoped>
.chart-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  container-type: size; 
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
  width: calc(var(--scan-radius, 68) * 1cqmin);
  height: calc(var(--scan-radius, 68) * 1cqmin);
  transform: translate(-50%, -50%);
  clip-path: var(--scan-clip);
  background: radial-gradient(circle, rgba(0, 255, 157, 0.1) 0%, rgba(0, 255, 157, 0.02) 48%, rgba(0, 255, 157, 0) 78%);
  box-shadow:
    inset 0 0 30px rgba(0, 255, 157, 0.18),
    0 0 18px rgba(0, 255, 157, 0.22);
  animation: radar-hex-breathe 5.2s ease-in-out infinite;
}

.radar-particles {
  width: 100%;
  height: 100%;
  position: absolute;
  inset: 0;
  z-index: 1;
}

.radar-scan-hex::before {
  content: '';
  position: absolute;
  inset: 6%;
  border: 1px solid rgba(0, 255, 157, 0.32);
  border-radius: 50%;
  box-shadow:
    inset 0 0 12px rgba(0, 255, 157, 0.22),
    0 0 14px rgba(0, 255, 157, 0.16);
  animation: radar-ring-pulse 2.8s ease-in-out infinite;
}

.radar-scan-hex::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  z-index: 2;
  background: conic-gradient(
    from 0deg,
    transparent 0deg,
    rgba(0, 255, 157, 0.07) 164deg,
    rgba(0, 255, 157, 0.55) 338deg,
    rgba(220, 255, 240, 0.98) 360deg
  );
  mix-blend-mode: screen;
  filter: drop-shadow(0 0 8px rgba(0, 255, 157, 0.52));
  animation: radar-sweep-rotate 3.2s linear infinite;
  transform-origin: center;
}

@keyframes radar-sweep-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes radar-hex-breathe {
  0%, 100% {
    opacity: var(--scan-breathe-min, 0.42);
    transform: translate(-50%, -50%) scale(0.985);
  }
  50% {
    opacity: var(--scan-breathe-max, 0.64);
    transform: translate(-50%, -50%) scale(1.015);
  }
}

@keyframes radar-ring-pulse {
  0%,
  100% {
    opacity: 0.58;
    transform: scale(0.985);
  }
  50% {
    opacity: 0.95;
    transform: scale(1.01);
  }
}

@media (max-height: 860px) {
  .chart-canvas { min-height: 175px; }
}

</style>