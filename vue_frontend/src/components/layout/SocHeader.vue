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

    <div class="header-controls">
      <button class="hud-btn" @click="$emit('toggle-sidebar')" :title="isSidebarOpen ? '收起左栏' : '展开左栏'">
        <MenuIcon class="hud-icon" />
      </button>
      <button class="hud-btn" @click="$emit('open-settings')" title="设置">
        <SettingsIcon class="hud-icon" />
      </button>
    </div>

    <div class="header-line" aria-hidden="true">
      <div class="header-line-fill" />
    </div>
  </header>
</template>

<script setup>
import { MenuIcon, SettingsIcon } from 'vue-tabler-icons'

defineProps({
  currentSession: { type: String, default: '' },
  currentTime: { type: String, default: '' },
  isSidebarOpen: { type: Boolean, default: true },
})

defineEmits(['toggle-sidebar', 'open-settings'])
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
  font-size: 0.55rem;
  color: var(--text-muted);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  display: block;
  margin-top: 2px;
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
  font-size: 0.52rem;
  letter-spacing: 0.11em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.hud-value {
  font-family: var(--font-display);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
}

.hud-value--green {
  color: var(--neon-green);
  text-shadow: var(--neon-green-glow);
}

.hud-value--cyan {
  color: var(--neon-cyan);
  text-shadow: var(--neon-cyan-glow);
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

.header-controls {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-left: 0.8rem;
}

.hud-btn {
  width: 32px;
  height: 32px;
  border: 1px solid rgba(0, 229, 255, 0.28);
  background: rgba(0, 229, 255, 0.08);
  color: var(--neon-cyan);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  clip-path: polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px);
  transition: all 0.2s ease;
}

.hud-btn:hover {
  border-color: rgba(0, 229, 255, 0.68);
  box-shadow: 0 0 12px rgba(0, 229, 255, 0.24), inset 0 0 8px rgba(0, 229, 255, 0.2);
  transform: translateY(-1px);
}

.hud-icon {
  width: 17px;
  height: 17px;
  display: block;
  flex-shrink: 0;
}

.hud-btn :deep(svg),
.hud-btn :deep(svg *) {
  color: currentColor;
  stroke: currentColor;
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

  .header-controls {
    margin-left: 0;
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
