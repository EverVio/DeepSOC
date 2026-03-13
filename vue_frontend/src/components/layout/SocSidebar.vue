<template>
  <FuiCard title="TACTICAL SESSIONS" class="session-card">
    <template #actions>
      <button class="fui-icon-btn" @click="$emit('create-session', `新会话 ${Date.now()}`)" title="新建会话">
        <PlusIcon class="btn-icon" />
      </button>
    </template>

    <div class="session-search">
      <SearchIcon class="search-icon-sm" />
      <input
        :value="searchQuery"
        type="text"
        placeholder="SEARCH SESSION..."
        class="session-search-input"
        @input="$emit('update:search-query', $event.target.value)"
      />
    </div>

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
        <button class="fui-icon-btn session-del" @click.stop="$emit('delete-session', session)" title="删除">
          <TrashIcon class="btn-icon" />
        </button>
      </div>
      <div v-if="filteredSessions.length === 0" class="session-empty">NO SESSIONS FOUND</div>
    </div>

    <div class="panel-footer">
      <button class="fui-footer-btn" @click="$emit('clear-history')">
        <TrashIcon class="btn-icon" />
        CLEAR SESSION
      </button>
    </div>
  </FuiCard>
</template>

<script setup>
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
  display: flex;
  flex-direction: column;
}

.session-card :deep(.fui-card-body) {
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.session-search {
  position: relative;
  margin-bottom: 0.7rem;
}

.search-icon-sm {
  position: absolute;
  left: 0.6rem;
  top: 50%;
  transform: translateY(-50%);
  width: 14px;
  height: 14px;
  color: #6e9ab0;
}

.session-search-input {
  width: 100%;
  height: 32px;
  padding: 0 0.6rem 0 1.9rem;
  background: rgba(3, 10, 24, 0.7);
  border: 1px solid rgba(0, 229, 255, 0.2);
  color: var(--text-main);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.06em;
}

.session-search-input::placeholder {
  color: #628296;
}

.session-search-input:focus {
  outline: none;
  border-color: rgba(0, 229, 255, 0.5);
}

.session-items {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding-right: 0.25rem;
}

.session-items::-webkit-scrollbar {
  width: 4px;
}

.session-items::-webkit-scrollbar-thumb {
  background: rgba(0, 229, 255, 0.3);
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
  font-size: 0.68rem;
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
