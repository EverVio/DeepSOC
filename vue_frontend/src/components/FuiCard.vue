<template>
  <n-card
    class="fui-card-root"
    :class="[`fui-card--${variant}`, { 'fui-card--glow': glow }]"
    :style="customStyle"
    :bordered="false"
    embedded
  >
    <template v-if="title || $slots.header" #header>
      <div class="fui-card-header-left">
        <span class="status-dot" aria-hidden="true" />
        <slot name="header">
          <span class="fui-card-title">{{ title }}</span>
        </slot>
      </div>
    </template>

    <template v-if="$slots.actions" #header-extra>
      <div class="fui-card-header-right">
        <slot name="actions" />
      </div>
    </template>

    <div class="fui-card-body">
      <slot />
    </div>

    <span class="corner corner-tl" aria-hidden="true" />
    <span class="corner corner-tr" aria-hidden="true" />
    <span class="corner corner-bl" aria-hidden="true" />
    <span class="corner corner-br" aria-hidden="true" />
    <div class="scanline-overlay" aria-hidden="true" />
  </n-card>
</template>

<script setup>
import { computed } from 'vue'
import { NCard } from 'naive-ui'

const props = defineProps({
  title: { type: String, default: '' },
  variant: { type: String, default: 'default' },
  glow: { type: Boolean, default: false },
  clip: { type: Number, default: 14 },
})

const customStyle = computed(() => ({
  '--card-clip': `${props.clip}px`,
}))
</script>

<style scoped>
.fui-card-root {
  position: relative;
  display: flex;
  flex-direction: column;
  background: rgba(13, 22, 43, 0.8);
  border: 1px solid var(--border-dim);
  clip-path: polygon(
    var(--card-clip) 0,
    100% 0,
    100% calc(100% - var(--card-clip)),
    calc(100% - var(--card-clip)) 100%,
    0 100%,
    0 var(--card-clip)
  );
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
  overflow: hidden;
}

.fui-card-root :deep(.n-card-header) {
  border-bottom: 1px solid var(--border-dim);
  padding: 0.55rem 1rem;
  background: linear-gradient(90deg, rgba(0, 229, 255, 0.06) 0%, transparent 60%);
}

.fui-card-root :deep(.n-card__content) {
  padding: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 1;
}

.fui-card--default { --card-accent: var(--neon-cyan); --card-dot: var(--neon-cyan); }
.fui-card--primary { --card-accent: var(--neon-cyan); --card-dot: var(--neon-cyan); }
.fui-card--success { --card-accent: var(--neon-green); --card-dot: var(--neon-green); }
.fui-card--warning { --card-accent: var(--neon-orange); --card-dot: var(--neon-orange); }
.fui-card--danger { --card-accent: var(--neon-red); --card-dot: var(--neon-red); }

.fui-card-root:hover {
  border-color: rgba(0, 229, 255, 0.45);
}

.fui-card--glow {
  border-color: rgba(0, 229, 255, 0.45);
  box-shadow: 0 0 12px rgba(0, 229, 255, 0.12), inset 0 0 20px rgba(0, 229, 255, 0.03);
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
  background: var(--card-dot, var(--neon-cyan));
  box-shadow: 0 0 6px var(--card-dot, var(--neon-cyan));
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
  color: var(--card-dot, var(--neon-cyan));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fui-card-body {
  flex: 1;
  overflow: hidden;
  position: relative;
  z-index: 1;
}

.corner {
  position: absolute;
  width: 10px;
  height: 10px;
  border-color: var(--card-dot, var(--neon-cyan));
  border-style: solid;
  opacity: 0.55;
  z-index: 2;
  transition: opacity 0.25s ease;
  pointer-events: none;
}

.fui-card-root:hover .corner {
  opacity: 0.9;
}

.corner-tl {
  top: 3px;
  left: 3px;
  border-width: 1px 0 0 1px;
}

.corner-tr {
  top: 3px;
  right: 3px;
  border-width: 1px 1px 0 0;
}

.corner-bl {
  bottom: 3px;
  left: 3px;
  border-width: 0 0 1px 1px;
}

.corner-br {
  bottom: 3px;
  right: 3px;
  border-width: 0 1px 1px 0;
}

.scanline-overlay {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0px,
    transparent 3px,
    rgba(0, 229, 255, 0.018) 3px,
    rgba(0, 229, 255, 0.018) 4px
  );
  pointer-events: none;
  z-index: 0;
}
</style>
