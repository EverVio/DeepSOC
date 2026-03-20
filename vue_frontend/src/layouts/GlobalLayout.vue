<template>
  <n-layout has-sider class="global-layout">
    <n-layout-sider
      class="global-sider"
      :collapsed="isCollapsed"
      :collapsed-width="68"
      :width="236"
      collapse-mode="width"
      bordered
      @mouseenter="handleSiderEnter"
      @mouseleave="handleSiderLeave"
    >
      <div class="sider-inner" :class="{ 'sider-inner--collapsed': isCollapsed }">
        <div class="sider-brand">
          <span class="brand-main">DEEP</span>
          <span class="brand-accent">SOC</span>
        </div>

        <n-menu
          class="sider-menu"
          :collapsed="isCollapsed"
          :collapsed-width="68"
          :collapsed-icon-size="18"
          :value="activeMenuKey"
          :options="menuOptions"
          @update:value="handleMenuChange"
        />
      </div>
    </n-layout-sider>

    <n-layout class="main-layout">
      <n-layout-header class="main-header" bordered>
        <SocHeader :current-session="currentSession" :current-time="currentTime" />
      </n-layout-header>

      <n-layout-content class="main-content">
        <router-view />
      </n-layout-content>
    </n-layout>
  </n-layout>
</template>

<script setup>
import { computed, h, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { NLayout, NLayoutContent, NLayoutHeader, NLayoutSider, NMenu } from 'naive-ui'
import { MenuIcon, SettingsIcon, TerminalIcon } from 'vue-tabler-icons'
import { useRoute, useRouter } from 'vue-router'
import SocHeader from '../components/layout/SocHeader.vue'
import { useClock } from '../composables/useClock'
import { useChatStore } from '../stores/chatStore'

const route = useRoute()
const router = useRouter()
const chatStore = useChatStore()

const { currentTime } = useClock()
const { currentSession } = storeToRefs(chatStore)

const isCollapsed = ref(true)

const renderMenuIcon = (IconComponent) => () => h(IconComponent, { class: 'menu-icon' })

const menuOptions = [
  {
    label: '安全态势大屏',
    key: '/dashboard',
    icon: renderMenuIcon(MenuIcon),
  },
  {
    label: '分析终端',
    key: '/chat',
    icon: renderMenuIcon(TerminalIcon),
  },
  {
    label: '系统设置',
    key: '/settings',
    icon: renderMenuIcon(SettingsIcon),
  },
]

const activeMenuKey = computed(() => {
  if (route.path.startsWith('/chat')) return '/chat'
  if (route.path.startsWith('/settings')) return '/settings'
  return '/dashboard'
})

const handleMenuChange = (key) => {
  if (key !== route.path) {
    router.push(key)
  }
}

const handleSiderEnter = () => {
  isCollapsed.value = false
}

const handleSiderLeave = () => {
  isCollapsed.value = true
}
</script>

<style scoped>
.global-layout {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
  z-index: 1;
}

.global-sider {
  z-index: 130;
  background: linear-gradient(180deg, rgba(6, 14, 30, 0.96), rgba(4, 10, 22, 0.96));
  box-shadow: 8px 0 24px rgba(0, 0, 0, 0.42);
}

.sider-inner {
  height: 100%;
  padding: 0.62rem 0.26rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.sider-brand {
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  color: var(--neon-cyan);
  text-shadow: var(--neon-cyan-glow);
  letter-spacing: 0.09em;
  font-family: var(--font-brand);
  border: 1px solid rgba(0, 229, 255, 0.24);
  background: rgba(0, 229, 255, 0.06);
  clip-path: polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px);
}

.brand-main {
  font-weight: 700;
  font-size: 0.78rem;
}

.brand-accent {
  font-weight: 900;
  font-size: 0.82rem;
  color: #8d5ef7;
}

.sider-inner--collapsed .sider-brand {
  font-size: 0;
  gap: 0;
}

.sider-inner--collapsed .brand-main,
.sider-inner--collapsed .brand-accent {
  display: none;
}

.sider-menu {
  flex: 1;
}

.sider-menu :deep(.n-menu-item-content) {
  height: 40px;
  margin: 0.25rem 0;
  border: 1px solid transparent;
  clip-path: polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px);
}

.sider-menu :deep(.n-menu-item-content:hover) {
  border-color: rgba(0, 229, 255, 0.34);
  background: rgba(0, 229, 255, 0.08);
}

.sider-menu :deep(.n-menu-item-content--selected) {
  border-color: rgba(0, 229, 255, 0.58);
  background: linear-gradient(90deg, rgba(0, 229, 255, 0.16), rgba(0, 229, 255, 0.04));
}

.sider-menu :deep(.n-menu-item-content__title) {
  font-family: var(--font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.08em;
}

.sider-menu :deep(.menu-icon) {
  width: 16px;
  height: 16px;
}

.main-layout {
  width: 100%;
  height: 100%;
  background: transparent;
}

.main-header {
  height: 52px;
  padding: 0;
  background: transparent;
}

.main-content {
  height: calc(100% - 52px);
  padding: 0.85rem;
  overflow: hidden;
}

@media (max-width: 1024px) {
  .main-header {
    height: 48px;
  }

  .main-content {
    height: calc(100% - 48px);
    padding: 0.7rem;
  }
}

@media (max-width: 640px) {
  .main-content {
    padding: 0.56rem;
  }
}
</style>
