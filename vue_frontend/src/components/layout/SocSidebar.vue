<!--
  组件职责：渲染主导航侧栏并处理菜单跳转。
  业务模块：布局导航模块
  主要数据流：路由状态 -> 菜单项高亮/导航事件 -> 页面切换
-->

<template>
  <FuiCard title="TACTICAL SESSIONS" class="session-card">
    <template #actions>
      <NButton class="fui-icon-btn" quaternary circle @click="$emit('create-session', `新会话 ${Date.now()}`)" title="新建会话">
        <PlusIcon class="btn-icon" />
      </NButton>
    </template>

    <NInput
      :value="searchQuery"
      placeholder="SEARCH SESSION..."
      class="session-search-input"
      @update:value="$emit('update:search-query', $event)"
    >
      <template #prefix>
        <SearchIcon class="search-icon-sm" />
      </template>
    </NInput>

    <NScrollbar class="session-scroll">
      <div class="session-items">
        <div
          v-for="session in filteredSessions"
          :key="session"
          class="session-item"
          :class="{ 'session-item--active': session === currentSession }"
          @click="$emit('select-session', session)"
        >
          <TerminalIcon class="session-icon" />
          <span class="session-item-name">{{ session }}</span>
          <NButton class="fui-icon-btn session-del" quaternary circle @click.stop="$emit('delete-session', session)" title="删除">
            <TrashIcon class="btn-icon" />
          </NButton>
        </div>
        <div v-if="filteredSessions.length === 0" class="session-empty">NO SESSIONS FOUND</div>
      </div>
    </NScrollbar>

    <div class="panel-footer">
      <NButton class="fui-footer-btn" quaternary @click="$emit('clear-history')">
        <TrashIcon class="btn-icon" />
        CLEAR SESSION
      </NButton>
    </div>
  </FuiCard>
</template>

<script setup>
import { NButton, NInput, NScrollbar } from 'naive-ui'
import FuiCard from '../FuiCard.vue'
import { PlusIcon, SearchIcon, TerminalIcon, TrashIcon } from 'vue-tabler-icons'

defineProps({
  searchQuery: { type: String, default: '' },
  filteredSessions: { type: Array, default: () => [] },
  currentSession: { type: String, default: '' },
})

defineEmits([
  'update:search-query',
  'select-session',
  'delete-session',
  'create-session',
  'clear-history',
])
</script>

<style scoped>
.session-card {
  min-height: 260px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.session-card :deep(.fui-card-body) {
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.search-icon-sm {
  width: 14px;
  height: 14px;
  color: #6e9ab0;
}

.session-search-input {
  margin-bottom: 0.7rem;
}

.session-search-input :deep(.n-input-wrapper) {
  min-height: 32px;
  background: rgba(3, 10, 24, 0.78);
  border: 1px solid rgba(0, 229, 255, 0.2);
  box-shadow: none;
}

.session-search-input :deep(.n-input__input-el) {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  color: var(--text-main);
}

.session-search-input :deep(.n-input__placeholder) {
  color: #628296;
}

.session-search-input :deep(.n-input-wrapper:hover),
.session-search-input :deep(.n-input-wrapper.n-input-wrapper--focus) {
  border-color: rgba(0, 229, 255, 0.5);
}

.session-scroll {
  flex: 1;
  min-height: 0;
}

.session-scroll :deep(.n-scrollbar-container) {
  padding-right: 0.25rem;
}

.session-scroll :deep(.n-scrollbar-rail.n-scrollbar-rail--vertical) {
  width: 5px;
}

.session-scroll :deep(.n-scrollbar-rail__scrollbar) {
  background: rgba(0, 229, 255, 0.35);
}

.session-items {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.session-item {
  height: 34px;
  border: 1px solid rgba(0, 229, 255, 0.14);
  background: rgba(4, 12, 28, 0.78);
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0 0.52rem;
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.2s ease, background 0.2s ease;
}

.session-item:hover {
  border-color: rgba(0, 229, 255, 0.35);
  transform: translateX(2px);
}

.session-item--active {
  border-color: rgba(0, 229, 255, 0.62);
  background: linear-gradient(90deg, rgba(0, 229, 255, 0.16), rgba(0, 229, 255, 0.05));
  box-shadow: inset 0 0 10px rgba(0, 229, 255, 0.08);
}

.session-icon {
  width: 14px;
  height: 14px;
  color: var(--neon-cyan);
  flex-shrink: 0;
}

.session-item-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  letter-spacing: 0.05em;
  color: #c8e6f6;
}

.fui-icon-btn {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(0, 229, 255, 0.24);
  background: rgba(0, 229, 255, 0.06);
  color: var(--neon-cyan);
  cursor: pointer;
  transition: all 0.2s ease;
}

.fui-icon-btn:hover {
  border-color: rgba(0, 229, 255, 0.52);
  box-shadow: 0 0 10px rgba(0, 229, 255, 0.18);
}

.btn-icon {
  width: 14px;
  height: 14px;
  display: block;
  flex-shrink: 0;
  color: currentColor;
}

.fui-icon-btn :deep(svg),
.fui-icon-btn :deep(svg *),
.fui-footer-btn :deep(svg),
.fui-footer-btn :deep(svg *) {
  color: currentColor;
  stroke: currentColor;
}

.session-del {
  width: 20px;
  height: 20px;
  opacity: 0.7;
}

.session-del:hover {
  opacity: 1;
  border-color: rgba(255, 0, 85, 0.55);
  color: #ff4d84;
}

.session-empty {
  min-height: 48px;
  border: 1px dashed rgba(0, 229, 255, 0.22);
  display: grid;
  place-items: center;
  color: #6f95a9;
  font-family: var(--font-mono);
  font-size: 0.64rem;
  letter-spacing: 0.1em;
}

.panel-footer {
  margin-top: 0.7rem;
  border-top: 1px solid rgba(0, 229, 255, 0.16);
  padding-top: 0.58rem;
}

.fui-footer-btn {
  width: 100%;
  height: 30px;
  border: 1px solid rgba(0, 229, 255, 0.24);
  background: rgba(0, 229, 255, 0.06);
  color: var(--neon-cyan);
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.32rem;
  cursor: pointer;
}

.fui-footer-btn:hover {
  border-color: rgba(0, 229, 255, 0.5);
  box-shadow: inset 0 0 10px rgba(0, 229, 255, 0.1);
}
</style>
