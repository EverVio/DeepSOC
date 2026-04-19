<!--
  组件职责：渲染主导航侧栏并处理菜单跳转。
  业务模块：布局导航模块
  主要数据流：路由状态 -> 菜单项高亮/导航事件 -> 页面切换
-->

<template>
  <FuiCard
    :title="collapsed ? '' : '历史会话'"
    class="session-card"
    :class="{ 'session-card--collapsed': collapsed, 'session-card--expandable': collapsed }"
    @click="collapsed && $emit('toggle-collapse')"
  >
    <template v-if="!collapsed" #actions>
      <NButton
        class="fui-icon-btn"
        quaternary
        circle
        @click.stop="$emit('toggle-collapse')"
        title="收起会话栏"
      >
        <ChevronLeftIcon class="btn-icon" />
      </NButton>
    </template>

    <template v-if="!collapsed">
      <button type="button" class="session-create-bar" @click="$emit('create-session')">
        <PlusIcon class="session-create-bar__icon" />
        <span class="session-create-bar__text">新建会话...</span>
      </button>

      <NInput
        :value="searchQuery"
        placeholder="搜索会话..."
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
            <div class="session-item-actions">
              <NButton
                class="fui-icon-btn session-rename"
                quaternary
                circle
                :disabled="loading"
                @click.stop="openRenameModal(session)"
                title="重命名"
              >
                <PencilIcon class="btn-icon" />
              </NButton>
              <NButton
                class="fui-icon-btn session-del"
                quaternary
                circle
                :disabled="loading"
                @click.stop="$emit('delete-session', session)"
                title="删除"
              >
                <TrashIcon class="btn-icon" />
              </NButton>
            </div>
          </div>
          <div v-if="filteredSessions.length === 0" class="session-empty">NO SESSIONS FOUND</div>
        </div>
      </NScrollbar>

      <div class="panel-footer">
        <NButton
          class="fui-footer-btn"
          quaternary
          :disabled="loading"
          title="清空左侧全部会话并保留默认对话"
          @click="$emit('clear-history')"
        >
          <TrashIcon class="btn-icon footer-trash-icon" />
          清空历史会话
        </NButton>
      </div>
    </template>

    <div v-else class="session-collapsed-state">
      <div class="session-expand-hint">
        <ChevronsRightIcon class="session-expand-hint__icon" />
      </div>
    </div>
  </FuiCard>

  <NModal
    :show="renameModalVisible"
    :mask-closable="false"
    :auto-focus="false"
    :show-icon="false"
    @update:show="handleRenameModalVisibleChange"
  >
    <section class="session-confirm-modal">
      <header class="session-confirm-modal__header">
        <PencilIcon class="session-confirm-modal__icon" />
        <h3 class="session-confirm-modal__title">重命名会话</h3>
      </header>

      <p class="session-confirm-modal__desc">请输入新的会话名称。</p>

      <NInput
        v-model:value="renameDraft"
        class="session-confirm-modal__input"
        placeholder="新的会话名称"
        :maxlength="100"
        show-count
        @keyup.enter="confirmRename"
      />

      <footer class="session-confirm-modal__actions">
        <NButton class="session-confirm-modal__btn session-confirm-modal__btn--ghost" @click="closeRenameModal">
          取消
        </NButton>
        <NButton
          class="session-confirm-modal__btn session-confirm-modal__btn--primary"
          :disabled="!renameDraft.trim() || loading"
          :loading="loading"
          @click="confirmRename"
        >
          确定
        </NButton>
      </footer>
    </section>
  </NModal>
</template>

<script setup>
import { ref } from 'vue'
import { NButton, NInput, NModal, NScrollbar } from 'naive-ui'
import FuiCard from '../FuiCard.vue'
import {
  ChevronLeftIcon,
  ChevronsRightIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TerminalIcon,
  TrashIcon,
} from 'vue-tabler-icons'

defineProps({
  collapsed: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  searchQuery: { type: String, default: '' },
  filteredSessions: { type: Array, default: () => [] },
  currentSession: { type: String, default: '' },
})

const emit = defineEmits([
  'update:search-query',
  'select-session',
  'delete-session',
  'rename-session',
  'create-session',
  'clear-history',
  'toggle-collapse',
])

const renameModalVisible = ref(false)
const renameTarget = ref('')
const renameDraft = ref('')

const openRenameModal = (session) => {
  renameTarget.value = session
  renameDraft.value = session
  renameModalVisible.value = true
}

const closeRenameModal = () => {
  renameModalVisible.value = false
}

const handleRenameModalVisibleChange = (nextShow) => {
  if (nextShow) {
    renameModalVisible.value = true
    return
  }

  closeRenameModal()
}

const confirmRename = () => {
  const next = renameDraft.value.trim()
  if (!next || !renameTarget.value) return
  emit('rename-session', renameTarget.value, next)
  renameModalVisible.value = false
}
</script>

<style scoped>
.session-card {
  min-height: 260px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.session-card :deep(.fui-card-header .fui-card-title) {
  font-size: 1rem; 
  font-weight: 500;  
}

.session-card--collapsed {
  min-height: 180px;
}

.session-card--collapsed :deep(.fui-card-header) {
  display: none !important;
}

.session-card--expandable {
  cursor: pointer;
}

.session-card--expandable :deep(.fui-card-header),
.session-card--expandable :deep(.fui-card-body) {
  pointer-events: none;
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

.session-create-bar {
  width: 100%;
  min-height: 32px;
  margin-bottom: 0.55rem;
  border: 1px solid rgba(0, 229, 255, 0.2);
  background: rgba(3, 10, 24, 0.78);
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0 0.65rem;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.session-create-bar:hover {
  border-color: rgba(0, 229, 255, 0.5);
  box-shadow: inset 0 0 10px rgba(0, 229, 255, 0.08);
}

.session-create-bar__icon {
  width: 13px;
  height: 13px;
  color: var(--neon-cyan);
  flex-shrink: 0;
}

.session-create-bar__text {
  font-family: var(--font-ui);
  font-size: 0.85rem;
  letter-spacing: 0.06em;
  color: #92b9cc;
}

.session-collapsed-state {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.session-expand-hint {
  margin-top: 0.1rem;
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.26rem;
  border: 1px dashed rgba(0, 229, 255, 0.36);
  background: rgba(0, 229, 255, 0.06);
}

.session-expand-hint__icon {
  width: 14px;
  height: 14px;
  color: var(--neon-cyan);
}

.session-search-input :deep(.n-input-wrapper) {
  min-height: 32px;
  background: rgba(3, 10, 24, 0.78);
  border: 1px solid rgba(0, 229, 255, 0.2);
  box-shadow: none;
}

.session-search-input :deep(.n-input__input-el) {
  font-family: var(--font-ui);
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
  font-family: var(--font-ui);
  font-size: 0.85rem;
  letter-spacing: 0.05em;
  color: #c8e6f6;
}

.session-item-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  flex-shrink: 0;
}

.session-rename {
  width: 20px;
  height: 20px;
  opacity: 0.75;
}

.session-rename:hover {
  opacity: 1;
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
  font-family: var(--font-ui);
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
  height: 40px;
  border: 1px solid rgba(0, 229, 255, 0.24);
  background: rgba(0, 229, 255, 0.06);
  color: var(--neon-cyan);
  font-family: var(--font-ui);
  font-size: 0.85rem;
  letter-spacing: 0.1em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  cursor: pointer;
}

.fui-footer-btn :deep(.n-button__content) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
}

.footer-trash-icon {
  flex-shrink: 0;
  margin-right: 0.18rem;
}

.fui-footer-btn:hover {
  border-color: rgba(0, 229, 255, 0.5);
  box-shadow: inset 0 0 10px rgba(0, 229, 255, 0.1);
}

.session-rename-modal__footer {
  margin-top: 1rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.62rem;
}

.session-confirm-modal {
  width: min(92vw, 520px);
  border: 1px solid rgba(0, 229, 255, 0.22);
  background:
    radial-gradient(circle at 80% -30%, rgba(0, 229, 255, 0.12), transparent 55%),
    linear-gradient(160deg, rgba(8, 16, 34, 0.98), rgba(3, 9, 23, 0.96));
  box-shadow:
    0 0 0 1px rgba(0, 229, 255, 0.1),
    0 20px 60px rgba(0, 0, 0, 0.58);
  padding: 1.15rem 1.2rem 1rem;
  clip-path: polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px);
}

.session-confirm-modal__header {
  display: flex;
  align-items: flex-start;
  gap: 0.72rem;
}

.session-confirm-modal__icon {
  width: 18px;
  height: 18px;
  color: var(--neon-cyan);
  margin-top: 0.12rem;
  flex-shrink: 0;
}

.session-confirm-modal__title {
  margin: 0;
  color: #e6f4ff;
  font-family: var(--font-ui);
  font-size: 1.05rem;
  letter-spacing: 0.04em;
  line-height: 1.35;
}

.session-confirm-modal__desc {
  margin-top: 0.8rem;
  color: #bdd9e8;
  font-family: var(--font-ui);
  font-size: 0.92rem;
  line-height: 1.7;
  padding-left: 28px;
}

.session-confirm-modal__input {
  margin-top: 0.95rem;
}

.session-confirm-modal__input :deep(.n-input-wrapper) {
  min-height: 36px;
  background: rgba(3, 10, 24, 0.78);
  border: 1px solid rgba(0, 229, 255, 0.2);
  box-shadow: none;
}

.session-confirm-modal__input :deep(.n-input-wrapper:hover),
.session-confirm-modal__input :deep(.n-input-wrapper.n-input-wrapper--focus) {
  border-color: rgba(0, 229, 255, 0.5);
}

.session-confirm-modal__input :deep(.n-input__input-el) {
  font-family: var(--font-ui);
  color: #d9f5ff;
}

.session-confirm-modal__input :deep(.n-input__placeholder),
.session-confirm-modal__input :deep(.n-input__count) {
  color: #628296;
}

.session-confirm-modal__actions {
  margin-top: 1rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.62rem;
}

.session-confirm-modal__btn {
  min-width: 118px;
}

.session-confirm-modal__btn--ghost {
  border: 1px solid rgba(0, 229, 255, 0.26);
  color: var(--neon-cyan);
  background: rgba(0, 229, 255, 0.08);
}

.session-confirm-modal__btn--ghost:hover {
  border-color: rgba(0, 229, 255, 0.5);
  background: rgba(0, 229, 255, 0.18);
}

.session-confirm-modal__btn--primary {
  border: 1px solid rgba(0, 229, 255, 0.28);
  color: #dffbff;
  background: rgba(0, 229, 255, 0.2);
}

.session-confirm-modal__btn--primary:hover {
  border-color: rgba(0, 229, 255, 0.58);
  background: rgba(0, 229, 255, 0.34);
}

@media (max-width: 640px) {
  .session-confirm-modal {
    width: min(94vw, 420px);
    padding: 0.95rem 0.92rem 0.88rem;
  }

  .session-confirm-modal__actions {
    flex-direction: column-reverse;
  }

  .session-confirm-modal__btn {
    width: 100%;
  }
}
</style>
