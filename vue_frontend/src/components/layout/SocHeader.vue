<!--
  组件职责：渲染系统顶部状态栏与全局操作入口。
  业务模块：布局头部模块
  主要数据流：全局状态/时间/操作事件 -> 顶部 UI
-->

<template>
  <header class="soc-header">
    <div class="header-brand">
      <span class="brand-name">DEEP<em>SOC</em></span>
      <span class="brand-sub">Security Operations Center</span>
    </div>

    <div class="header-hud">
      <div class="hud-item">
        <span class="hud-label">SYSTEM</span>
        <span class="hud-value hud-value--green">ONLINE</span>
      </div>
      <div class="hud-divider" />
      <div
        v-if="runtimeNotice"
        class="hud-item hud-item--notice"
        :class="{ 'is-alert': isDegraded }"
        :title="runtimeNotice"
      >
        <div class="hud-texts">
          <span class="hud-label">STATUS</span>
          <span class="hud-value" :class="isDegraded ? 'hud-value--alert' : 'hud-value--warn'">
            {{ runtimeNotice }}
          </span>
        </div>
      </div>
      <div v-if="runtimeNotice" class="hud-divider" />
      <template v-if="showSession">
        <div class="hud-item">
          <span class="hud-label">SESSION</span>
          <span class="hud-value hud-value--cyan session-name-display">{{ currentSession }}</span>
        </div>
        <div class="hud-divider" />
      </template>
      <div class="hud-item">
        <span class="hud-label">TIME</span>
        <span class="hud-value hud-value--cyan">{{ currentTime }}</span>
      </div>
    </div>

    <div class="header-line" aria-hidden="true">
      <div class="header-line-fill" />
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  currentSession: { type: String, default: '' },
  currentTime: { type: String, default: '' },
  showSession: { type: Boolean, default: false },
  runtimeNotice: { type: String, default: '' },
})

// 识别是否为告警状态（如 Ollama 失败、切换远程等关键词）
const isDegraded = computed(() => {
  const notice = String(props.runtimeNotice || '').toLowerCase()
  const keywords = ['fail', '失败', '远程', 'remote', 'fallback', '切换', '回退']
  return keywords.some(key => notice.includes(key))
})
</script>

<style scoped>
.soc-header {
  display: flex;
  align-items: center;
  padding: 0 1.25rem;
  background: rgba(5, 8, 20, 0.92);
  border-bottom: 1px solid var(--border-dim);
  position: relative;
  z-index: 10;
  gap: 1.5rem;
  flex-shrink: 0;
  height: 100%;
}

.brand-name {
  font-family: var(--font-brand);
  font-size: 1.1rem;
  font-weight: 900;
  color: var(--neon-cyan);
  letter-spacing: 0.15em;
  text-shadow: var(--neon-cyan-glow);
  line-height: 1;
}

.brand-name em {
  font-style: normal;
  color: var(--neon-purple);
  text-shadow: 0 0 8px rgba(123, 44, 191, 0.7);
}

.brand-sub {
  font-family: var(--font-ui);
  font-size: 0.8rem;
  color: #a0efef;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  display: block;
  margin-top: -1px;
  line-height: 1.2;
  text-shadow: 0 0 6px rgba(160, 239, 239, 0.18);
}

.header-hud {
  display: flex;
  align-items: center;
  gap: 0;
  margin-left: auto;
}

.hud-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 1rem;
}

.hud-label {
  font-family: var(--font-ui);
  font-size: var(--hud-label-size, 14px);
  letter-spacing: 0.11em;
  text-transform: uppercase;
  color: var(--hud-label-color, #d7dee7);
  line-height: 1.2;
}

.hud-value {
  font-family: var(--font-display);
  font-size: var(--hud-value-size, 15px);
  letter-spacing: 0.08em;
  line-height: 1.25;
  font-weight: 600;
}

.hud-value--green {
  color: var(--hud-value-color, #00ffcc);
  text-shadow: 0 0 8px rgba(0, 255, 204, 0.24);
}

.hud-value--cyan {
  color: var(--hud-value-color, #00ffcc);
  text-shadow: 0 0 8px rgba(0, 255, 204, 0.24);
}

.hud-value--warn {
  color: #ffc76a;
  text-shadow: 0 0 10px rgba(255, 199, 106, 0.2);
}

.hud-value--alert {
  color: var(--neon-orange);
  text-shadow: 0 0 8px rgba(255, 106, 0, 0.55);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.hud-item--notice {
  max-width: 360px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.18rem;
  padding: 0.18rem 0.9rem; /* increase left/right spacing */
  border: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
}

.hud-item--notice.is-alert {
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
}

.llm-dot {
  position: relative;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #fff8ea 0%, #ffe08d 28%, #ffbf4f 62%, #cf8611 100%);
  box-shadow: 0 0 0 1px rgba(255, 226, 176, 0.28), 0 0 10px rgba(255, 189, 68, 0.4);
  animation: llmBlink 2.2s ease-in-out infinite;
  flex: 0 0 auto;
}

.llm-dot--alert {
  background: radial-gradient(circle at 35% 35%, #fff 0%, var(--neon-orange) 38%, #8b3a00 100%);
  box-shadow: 0 0 0 1px rgba(255, 166, 92, 0.3), 0 0 12px rgba(255, 106, 0, 0.72), 0 0 20px rgba(255, 106, 0, 0.32);
  animation: llmAlertBlink 0.8s ease-in-out infinite;
}

.llm-dot::before {
  content: '';
  position: absolute;
  inset: -7px;
  border-radius: 50%;
  border: 1px solid rgba(255, 204, 112, 0.18);
  box-shadow: 0 0 16px rgba(255, 186, 63, 0.08);
  animation: llmHalo 2.2s ease-out infinite;
}

.llm-dot--alert::before {
  border-color: rgba(255, 106, 0, 0.35);
  box-shadow: 0 0 18px rgba(255, 106, 0, 0.16);
  animation: llmAlertHalo 0.8s ease-out infinite;
}

.llm-dot::after {
  content: '';
  position: absolute;
  inset: 2px 3px 4px 2px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.4);
  filter: blur(0.2px);
}

.hud-texts {
  display: flex;
  flex-direction: column;
  min-width: 0;
  align-items: center;
  text-align: center;
}

.hud-value--alert {
  font-size: 13px; /* larger, more prominent */
  line-height: 1.2;
}

@keyframes llmBlink {
  0% { transform: scale(1); opacity: 0.9; }
  42% { transform: scale(1.14); opacity: 0.66; }
  100% { transform: scale(1); opacity: 0.9; }
}

@keyframes llmHalo {
  0% { transform: scale(0.88); opacity: 0.52; }
  60% { transform: scale(1.16); opacity: 0.1; }
  100% { transform: scale(1.24); opacity: 0; }
}

@keyframes llmAlertBlink {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.2); opacity: 0.5; }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes llmAlertHalo {
  0% { transform: scale(0.9); opacity: 0.7; }
  70% { transform: scale(1.2); opacity: 0.14; }
  100% { transform: scale(1.28); opacity: 0; }
}

.session-name-display {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hud-divider {
  width: 1px;
  height: 26px;
  background: linear-gradient(to bottom, transparent, rgba(0, 229, 255, 0.45), transparent);
}

.header-line {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 1px;
  overflow: hidden;
}

.header-line-fill {
  width: 35%;
  height: 100%;
  background: linear-gradient(to right, transparent, rgba(0, 229, 255, 0.7), transparent);
  animation: hudSweep 4s ease-in-out infinite;
}

@keyframes hudSweep {
  0% {
    transform: translateX(-120%);
  }
  100% {
    transform: translateX(380%);
  }
}

@media (max-width: 1320px) {
  .header-hud {
    display: none;
  }
}

@media (max-width: 1024px) {
  .header-brand {
    flex: 1;
  }
}

@media (max-width: 640px) {
  .soc-header {
    padding: 0 0.65rem;
  }

  .brand-name {
    font-size: 0.88rem;
  }

  .brand-sub {
    display: none;
  }
}
</style>
