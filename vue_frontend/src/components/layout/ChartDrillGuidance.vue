<!--
  组件职责：展示图表全屏分析入口引导提示。
  业务模块：图表交互引导模块
  主要数据流：全屏状态 -> 浮条/一次性引导层 -> 用户感知
-->

<template>
  <div class="chart-drill-guidance" aria-hidden="true">
    <Transition name="chart-drill-fade">
      <div v-if="bannerVisible" class="chart-drill-banner">
        <span class="chart-drill-banner__label">ANALYSIS MODE</span>
        <span class="chart-drill-banner__text">{{ bannerText }}</span>
      </div>
    </Transition>

    <Transition name="chart-drill-fade">
      <div v-if="introVisible" class="chart-drill-intro" role="status" aria-live="polite">
        <div class="chart-drill-intro__card">
          <div class="chart-drill-intro__title">{{ introTitle }}</div>
          <div class="chart-drill-intro__text">{{ introText }}</div>
          <button class="chart-drill-intro__button" type="button" @click="emit('dismiss')">
            {{ dismissText }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
defineProps({
  bannerVisible: {
    type: Boolean,
    default: false,
  },
  introVisible: {
    type: Boolean,
    default: false,
  },
  bannerText: {
    type: String,
    default: '',
  },
  introTitle: {
    type: String,
    default: '图表分析入口已开启',
  },
  introText: {
    type: String,
    default: '',
  },
  dismissText: {
    type: String,
    default: '知道了',
  },
})

const emit = defineEmits(['dismiss'])
</script>

<style scoped>
.chart-drill-guidance {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 16;
}

.chart-drill-banner {
  position: absolute;
  top: 3rem;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.42rem 0.85rem;
  border: 1px solid rgba(0, 229, 255, 0.28);
  background: linear-gradient(180deg, rgba(7, 15, 30, 0.96), rgba(4, 10, 22, 0.9));
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35), inset 0 0 0 1px rgba(0, 229, 255, 0.08);
  color: #d9f6ff;
  font-family: var(--font-ui);
  font-size: 1rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  pointer-events: none;
  white-space: nowrap;
}

.chart-drill-banner__label {
  color: var(--neon-cyan);
  text-shadow: var(--neon-cyan-glow);
}

.chart-drill-banner__text {
  color: #b7dceb;
}

.chart-drill-intro {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.chart-drill-intro__card {
  position: absolute;
  top: 2.65rem;
  left: 50%;
  transform: translateX(-50%);
  width: min(560px, 88%);
  padding: 1.1rem 1.2rem 0.95rem;
  border: 1px solid rgba(0, 229, 255, 0.36);
  background: linear-gradient(180deg, rgba(6, 14, 28, 0.9), rgba(4, 10, 22, 0.8));
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.42), inset 0 0 18px rgba(0, 229, 255, 0.08);
  clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);
  color: #d9f6ff;
}

.chart-drill-intro__title {
  margin-bottom: 0.55rem;
  color: var(--neon-cyan);
  font-family: var(--font-ui);
  font-size: 0.88rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.chart-drill-intro__text {
  color: #b7dceb;
  font-family: var(--font-ui);
  font-size: 0.72rem;
  line-height: 1.7;
  letter-spacing: 0.06em;
}

.chart-drill-intro__button {
  margin-top: 0.95rem;
  padding: 0.38rem 0.9rem;
  border: 1px solid rgba(0, 229, 255, 0.34);
  background: rgba(0, 229, 255, 0.08);
  color: #d9f6ff;
  font-family: var(--font-ui);
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  pointer-events: auto;
}

.chart-drill-intro__button:hover {
  border-color: rgba(0, 229, 255, 0.7);
  background: rgba(0, 229, 255, 0.14);
}

.chart-drill-fade-enter-active,
.chart-drill-fade-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.chart-drill-fade-enter-from,
.chart-drill-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
