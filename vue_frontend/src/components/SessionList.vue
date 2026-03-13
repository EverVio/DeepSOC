<!--
  SessionList.vue — FUI 会话列表（可独立复用）
  Chat.vue 左侧面板已内联了完整实现；
  此组件保留供后续模块化引用。
-->
<template>
  <div class="fui-session-list">
    <!-- 搜索框 -->
    <div class="sl-search">
      <SearchIcon class="sl-icon" />
      <input
        v-model="searchQuery"
        type="text"
        placeholder="SEARCH SESSION..."
        class="sl-input"
      />
      <button v-if="searchQuery" class="sl-clear" @click="searchQuery = ''" title="清除">
        <XIcon class="sl-icon" />
      </button>
    </div>

    <!-- 列表 -->
    <div class="sl-items">
      <div
        v-for="session in filteredSessions"
        :key="session"
        class="sl-item"
        :class="{ 'sl-item--active': session === currentSession }"
        @click="$emit('select', session)"
      >
        <TerminalIcon class="sl-item-icon" />
        <span class="sl-item-name">{{ session }}</span>
        <button
          class="sl-del"
          @click.stop="handleDelete(session)"
          title="删除"
        >
          <TrashIcon class="sl-icon" />
        </button>
      </div>
      <p v-if="filteredSessions.length === 0" class="sl-empty">
        NO SESSIONS FOUND
      </p>
    </div>

    <!-- 新建会话弹窗 -->
    <div
      v-if="showDialog"
      class="sl-dialog-overlay"
      @click.self="showDialog = false"
    >
      <div class="sl-dialog fui-card">
        <p class="sl-dialog-title">NEW SESSION</p>
        <input
          ref="dialogInputRef"
          v-model="newSessionName"
          type="text"
          placeholder="Session name..."
          @keyup.enter="createSession"
        />
        <div class="sl-dialog-btns">
          <button class="secondary" @click="showDialog = false">CANCEL</button>
          <button class="primary" @click="createSession" :disabled="!newSessionName.trim()">CREATE</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { SearchIcon, XIcon, TrashIcon, TerminalIcon, PlusIcon } from 'vue-tabler-icons'

const props = defineProps({
  sessions:       { type: Array,  required: true },
  currentSession: { type: String, required: true },
})
const emit = defineEmits(['select', 'delete', 'create'])

const searchQuery    = ref('')
const showDialog     = ref(false)
const newSessionName = ref('')
const dialogInputRef = ref(null)

const filteredSessions = computed(() => {
  if (!searchQuery.value) return props.sessions
  const q = searchQuery.value.toLowerCase()
  return props.sessions.filter(s => s.toLowerCase().includes(q))
})

watch(showDialog, (v) => {
  if (v) nextTick(() => dialogInputRef.value?.focus())
})

const handleDelete = (session) => {
  if (window.confirm(`确定删除会话 "${session}" 吗？`))
    emit('delete', session)
}

const createSession = () => {
  if (!newSessionName.value.trim()) return
  emit('create', newSessionName.value.trim())
  newSessionName.value = ''
  showDialog.value = false
}
</script>

<style scoped>
.fui-session-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.sl-search {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 0.75rem;
  border-bottom: 1px solid var(--border-dim);
  flex-shrink: 0;
}
.sl-icon { width: 0.85rem; height: 0.85rem; color: var(--text-muted); flex-shrink: 0; }
.sl-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.05em;
  clip-path: none;
  padding: 0;
}
.sl-input::placeholder { color: var(--text-muted); }
.sl-input:focus { outline: none; }
.sl-clear { background: none; border: none; color: var(--text-muted); cursor: pointer;
  clip-path: none; padding: 0; letter-spacing: 0; text-transform: none; }
.sl-clear:hover { color: var(--neon-cyan); background: none; box-shadow: none; }

.sl-items { flex: 1; overflow-y: auto; padding: 0.3rem 0; }

.sl-item {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.7rem;
  cursor: pointer;
  border-left: 2px solid transparent;
  transition: background 0.15s, border-color 0.15s;
}
.sl-item:hover { background: rgba(0,229,255,0.05); border-left-color: rgba(0,229,255,0.25); }
.sl-item--active { background: rgba(0,229,255,0.1); border-left-color: var(--neon-cyan); }
.sl-item-icon { width: 0.75rem; height: 0.75rem; color: var(--text-muted); flex-shrink: 0; }
.sl-item-name {
  flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-family: var(--font-mono); font-size: 0.7rem; color: var(--text-secondary);
}
.sl-item--active .sl-item-name { color: var(--neon-cyan); }
.sl-del {
  opacity: 0; background: none; border: none; cursor: pointer; color: var(--text-muted);
  padding: 0.1rem; clip-path: none; letter-spacing: 0; text-transform: none;
  transition: opacity 0.15s, color 0.15s;
}
.sl-item:hover .sl-del { opacity: 1; }
.sl-del:hover { color: var(--neon-red); background: none; box-shadow: none; }

.sl-empty {
  padding: 1rem 0.75rem;
  font-family: var(--font-mono); font-size: 0.62rem;
  color: var(--text-muted); letter-spacing: 0.1em;
}

/* 新建会话弹窗 */
.sl-dialog-overlay {
  position: fixed; inset: 0;
  background: rgba(5, 8, 20, 0.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 200;
}
.sl-dialog {
  width: min(360px, 90vw);
  padding: 1.25rem;
  display: flex; flex-direction: column; gap: 1rem;
}
.sl-dialog-title {
  font-family: var(--font-mono); font-size: 0.7rem;
  letter-spacing: 0.15em; color: var(--neon-cyan); text-transform: uppercase;
}
.sl-dialog-btns {
  display: flex; gap: 0.6rem; justify-content: flex-end;
}
</style>
