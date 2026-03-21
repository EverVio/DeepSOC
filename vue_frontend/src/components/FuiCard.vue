<!--
  组件职责：统一封装科幻风卡片容器与边框光效。
  业务模块：基础容器组件
  主要数据流：标题/插槽/动作区 -> 卡片骨架 -> 业务内容承载
-->

<template>
  <section
    ref="containerRef"
    class="fui-card-root"
    :class="[`fui-card--${variant}`, { 'fui-card--glow': glow }]"
    :style="customStyle"
  >
    <svg class="fui-card-svg" :viewBox="`0 0 ${cardWidth} ${cardHeight}`" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <radialGradient :id="highlightGradientId" cx="50%" cy="6%" r="80%">
          <stop offset="0%" stop-color="rgba(166, 220, 255, 0.18)" />
          <stop offset="45%" stop-color="rgba(13, 22, 43, 0)" />
          <stop offset="100%" stop-color="rgba(13, 22, 43, 0)" />
        </radialGradient>

        <pattern :id="scanPatternId" patternUnits="userSpaceOnUse" width="8" height="8">
          <rect width="8" height="8" fill="transparent" />
          <path d="M0 0 H8 M0 4 H8" stroke="rgba(0, 229, 255, 0.08)" stroke-width="0.6" />
          <circle cx="1.2" cy="1.2" r="0.55" fill="rgba(0, 229, 255, 0.11)" />
        </pattern>
      </defs>

      <path class="surface-base" :d="cardPath" />
      <path class="surface-highlight" :d="cardPath" :fill="`url(#${highlightGradientId})`" />
      <path class="surface-pattern" :d="cardPath" :fill="`url(#${scanPatternId})`" />
      <path class="surface-border" :d="cardPath" :stroke="resolvedStroke" />
    </svg>

    <header v-if="title || $slots.header || $slots.actions" class="fui-card-header">
      <div class="fui-card-header-left">
        <span class="status-dot" aria-hidden="true" />
        <slot name="header">
          <span class="fui-card-title">{{ title }}</span>
        </slot>
      </div>

      <div v-if="$slots.actions" class="fui-card-header-right">
        <slot name="actions" />
      </div>
    </header>

    <div class="fui-card-body">
      <slot />
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  title: { type: String, default: '' },
  variant: { type: String, default: 'default' },
  glow: { type: Boolean, default: false },
  clip: { type: Number, default: 14 },
  stroke: { type: String, default: '' },
})

const accentPalette = {
  default: { color: '#00E5FF', rgb: '0, 229, 255' },
  primary: { color: '#00E5FF', rgb: '0, 229, 255' },
  success: { color: '#43F3A2', rgb: '67, 243, 162' },
  warning: { color: '#FFB34F', rgb: '255, 179, 79' },
  danger: { color: '#FF4975', rgb: '255, 73, 117' },
}

const containerRef = ref(null)
const width = ref(120)
const height = ref(120)

let resizeObserver = null

const updateSize = () => {
  if (!containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  width.value = Math.max(120, Math.round(rect.width || 120))
  height.value = Math.max(120, Math.round(rect.height || 120))
}

onMounted(() => {
  updateSize()
  if (typeof ResizeObserver === 'undefined' || !containerRef.value) return
  resizeObserver = new ResizeObserver(() => {
    updateSize()
  })
  resizeObserver.observe(containerRef.value)
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})

const uid = Math.random().toString(36).slice(2, 10)
const highlightGradientId = `fui-highlight-${uid}`
const scanPatternId = `fui-pattern-${uid}`

const variantAccent = computed(() => accentPalette[props.variant] || accentPalette.default)
const resolvedStroke = computed(() => props.stroke || variantAccent.value.color)

const cardWidth = computed(() => width.value)
const cardHeight = computed(() => height.value)

const clipSize = computed(() => {
  const minSide = Math.min(cardWidth.value, cardHeight.value)
  return Math.max(8, Math.min(props.clip, Math.floor(minSide / 2) - 2))
})

const buildCardPath = (w, h, c) => `M ${c} 0 H ${w} V ${h - c} L ${w - c} ${h} H 0 V ${c} Z`

const cardPath = computed(() => buildCardPath(cardWidth.value, cardHeight.value, clipSize.value))

const customStyle = computed(() => ({
  '--card-accent': variantAccent.value.color,
  '--card-accent-rgb': variantAccent.value.rgb,
}))
</script>

<style scoped>
.fui-card-root {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  isolation: isolate;
  background: radial-gradient(circle at 50% 0%, rgba(152, 205, 255, 0.09), rgba(13, 22, 43, 0.6) 42%, rgba(13, 22, 43, 0.6));
  box-shadow:
    inset 0 0 0 1px rgba(var(--card-accent-rgb), 0.22),
    inset 0 0 24px rgba(var(--card-accent-rgb), 0.1),
    inset 0 -28px 46px rgba(2, 8, 18, 0.44);
  transition: box-shadow 0.25s ease;
}

.fui-card-root:hover {
  box-shadow:
    inset 0 0 0 1px rgba(var(--card-accent-rgb), 0.38),
    inset 0 0 30px rgba(var(--card-accent-rgb), 0.14),
    inset 0 -30px 50px rgba(2, 8, 18, 0.5);
}

.fui-card--glow {
  box-shadow:
    inset 0 0 0 1px rgba(var(--card-accent-rgb), 0.42),
    inset 0 0 36px rgba(var(--card-accent-rgb), 0.18),
    inset 0 -34px 54px rgba(2, 8, 18, 0.52);
}

.fui-card-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
}

.surface-base {
  fill: rgba(13, 22, 43, 0.6);
}

.surface-highlight {
  opacity: 0.85;
}

.surface-pattern {
  opacity: 0.42;
}

.surface-border {
  fill: none;
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
  stroke-linejoin: round;
}

.fui-card-header,
.fui-card-body {
  position: relative;
  z-index: 1;
}

.fui-card-header {
  min-height: 38px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  border-bottom: 1px solid rgba(var(--card-accent-rgb), 0.2);
  padding: 0.55rem 1rem;
  background: linear-gradient(90deg, rgba(var(--card-accent-rgb), 0.07), transparent 62%);
}

.fui-card-header-left {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
}

.fui-card-header-right {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--card-accent, var(--neon-cyan));
  box-shadow: 0 0 6px rgba(var(--card-accent-rgb), 0.72);
  animation: dotPulse 1.2s ease-in-out infinite;
}

@keyframes dotPulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}

.fui-card-title {
  font-family: var(--font-ui);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--card-accent, var(--neon-cyan));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fui-card-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>
