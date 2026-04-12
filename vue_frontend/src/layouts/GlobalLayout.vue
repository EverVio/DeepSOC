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
          :collapsed-icon-size="20"
          :value="activeMenuKey"
          :options="menuOptions"
          @update:value="handleMenuChange"
        />
      </div>
    </n-layout-sider>

    <n-layout class="main-layout">
      <n-layout-header class="main-header" bordered>
        <SocHeader
          :current-session="currentSession"
          :current-time="currentTime"
          :show-session="showSession"
        />
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
import { MenuIcon, SearchIcon, SettingsIcon, TerminalIcon } from 'vue-tabler-icons'
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
const showSession = computed(() => route.path.startsWith('/chat'))

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
    label: '情报查询',
    key: '/intel',
    icon: renderMenuIcon(SearchIcon),
  },
  {
    label: '系统设置',
    key: '/settings',
    icon: renderMenuIcon(SettingsIcon),
  },
]

const activeMenuKey = computed(() => {
  if (route.path.startsWith('/intel')) return '/intel'
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
/* 定义局部主题变量以便统一调优 */
:local {
  --theme-cyan: #00e5ff;
  --theme-purple: #8d5ef7;
  --menu-bg-hover: rgba(0, 229, 255, 0.08);
  --menu-bg-active: rgba(0, 229, 255, 0.12);
  --transition-bezier: cubic-bezier(0.16, 1, 0.3, 1);
}

.global-layout {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
  z-index: 1;
}

/* 优化侧边栏背景与阴影。移除了自定义的 width transition，交还给 Naive UI */
.global-sider {
  z-index: 130;
  background: linear-gradient(180deg, rgba(6, 14, 30, 0.98), rgba(2, 6, 16, 0.98));
  box-shadow: 4px 0 24px rgba(0, 229, 255, 0.05);
}

.sider-inner {
  height: 100%;
  padding: 0.75rem 0.35rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* 品牌标识区域：增加动态呼吸光效 */
@keyframes brand-pulse {
  0%, 100% { text-shadow: 0 0 6px rgba(141, 94, 247, 0.6); }
  50% { text-shadow: 0 0 12px rgba(141, 94, 247, 0.9); }
}

.sider-brand {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  color: var(--theme-cyan);
  text-shadow: 0 0 8px rgba(0, 229, 255, 0.5);
  letter-spacing: 0.1em;
  font-family: var(--font-brand);
  border: 1px solid rgba(0, 229, 255, 0.2);
  background: linear-gradient(135deg, rgba(0, 229, 255, 0.08) 0%, transparent 100%);
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
  /* 仅针对视觉属性施加动画，避免影响宽度 */
  transition: background-color 0.3s, border-color 0.3s, text-shadow 0.3s;
}

.brand-main {
  font-weight: 700;
  font-size: 0.85rem;
}

.brand-accent {
  font-weight: 900;
  font-size: 0.9rem;
  color: var(--theme-purple);
  animation: brand-pulse 4s infinite ease-in-out;
}

.sider-inner--collapsed .sider-brand {
  border-color: transparent;
  background: transparent;
  text-shadow: none;
}

.sider-inner--collapsed .brand-main,
.sider-inner--collapsed .brand-accent {
  display: none;
}

/* 导航菜单容器 */
.sider-menu {
  flex: 1;
}

/* 菜单项基础样式：使用明确的属性 transition 替代 all，防止破坏 Naive 的内部 padding/width 动画 */
.sider-menu :deep(.n-menu-item-content) {
  height: 44px;
  margin: 0.35rem 0;
  border: 1px solid transparent;
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
  position: relative;
  transition: background-color 0.25s, border-color 0.25s, transform 0.25s var(--transition-bezier), box-shadow 0.25s;
}

/* 悬浮态：X轴微光推移，模拟机械按键 */
.sider-menu :deep(.n-menu-item-content:hover) {
  border-color: rgba(0, 229, 255, 0.4);
  background: var(--menu-bg-hover);
  transform: translateX(4px);
}

/* 选中态：增加高亮左侧边框（利用盒阴影实现内发光）与渐变背景 */
.sider-menu :deep(.n-menu-item-content--selected) {
  border-color: rgba(0, 229, 255, 0.6);
  background: linear-gradient(90deg, var(--menu-bg-active), transparent);
  box-shadow: inset 3px 0 0 var(--theme-cyan);
}

/* 消除原有的被选中的默认文字颜色偏移 */
.sider-menu :deep(.n-menu-item-content--selected .n-menu-item-content__title) {
  color: #fff;
  font-weight: 600;
  text-shadow: 0 0 4px rgba(255, 255, 255, 0.3);
}

/* 选中态图标：增加赛博全息发光效果 */
.sider-menu :deep(.n-menu-item-content--selected .menu-icon) {
  color: var(--theme-cyan);
  filter: drop-shadow(0 0 6px var(--theme-cyan));
}

.sider-menu :deep(.n-menu-item-content__title) {
  font-family: var(--font-ui);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  transition: color 0.3s ease;
}

.sider-menu :deep(.menu-icon) {
  width: 18px;
  height: 18px;
  transition: filter 0.3s ease, color 0.3s ease;
}

/* 布局调整 */
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
  .main-header { height: 48px; }
  .main-content {
    height: calc(100% - 48px);
    padding: 0.7rem;
  }
}

@media (max-width: 640px) {
  .main-content { padding: 0.56rem; }
}
</style>