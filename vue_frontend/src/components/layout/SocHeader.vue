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
      <div class="hud-item">
        <span class="hud-label">DEFCON</span>
        <span class="hud-value hud-value--cyan">LEVEL 4</span>
      </div>
      <div class="hud-divider" />
      <div class="hud-item">
        <span class="hud-label">SESSION</span>
        <span class="hud-value hud-value--cyan session-name-display">{{ currentSession }}</span>
      </div>
      <div class="hud-divider" />
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
defineProps({
  currentSession: { type: String, default: '' },
  currentTime: { type: String, default: '' },
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
  font-family: var(--font-mono);
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
  font-family: var(--font-mono);
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
