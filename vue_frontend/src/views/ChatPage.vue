<!--
  组件职责：聊天页外层容器，负责页面级装配与路由承接。
  业务模块：对话业务页面
  主要数据流：路由进入 -> 页面容器 -> Chat 业务组件
-->

<template>
  <n-layout has-sider class="chat-page-layout">
    <n-layout-sider
      class="chat-page-sider"
      :class="{ 'chat-page-sider--collapsed': isSessionSiderCollapsed }"
      :collapsed="isSessionSiderCollapsed"
      :collapsed-width="56"
      :width="292"
      collapse-mode="width"
      bordered
    >
      <div class="chat-page-sider-inner" :class="{ 'chat-page-sider-inner--collapsed': isSessionSiderCollapsed }">
        <SocSidebar
          :collapsed="isSessionSiderCollapsed"
          :loading="loading"
          :search-query="searchQuery"
          :filtered-sessions="filteredSessions"
          :current-session="currentSession"
          @update:search-query="searchQuery = $event"
          @select-session="handleSelectSession"
          @delete-session="handleDeleteSession"
          @rename-session="handleRenameSession"
          @create-session="handleCreateSession"
          @clear-history="handleClearAllSessions"
          @toggle-collapse="isSessionSiderCollapsed = !isSessionSiderCollapsed"
        />
      </div>
    </n-layout-sider>

    <n-layout-content class="chat-page-content">
      <ChatTerminal
        :current-session="currentSession"
        :messages="messages"
        :loading="loading"
        :streaming="isStreaming"
        :error="error"
        :entry-hint="analysisJumpHint"
        :analysis-jump-entry="analysisJumpEntry"
        :analysis-jump-history="analysisJumpHistory"
        :analysis-history-visible="analysisHistoryVisible"
        :on-send-message="handleSendMessageWithHintClear"
        :on-regenerate="handleRegenerateWithHistoryReveal"
        :on-edit-message="handleEditMessage"
        :on-apply-analysis-jump="applyAnalysisJump"
        :on-send-analysis-jump="sendAnalysisJump"
        :on-dismiss-analysis-jump="dismissAnalysisJump"
        :on-dismiss-analysis-jump-history="hideAnalysisJumpHistory"
        :on-reuse-analysis-jump="reuseAnalysisJump"
        :on-stop-generating="stopGenerating"
        :messages-container-ref="messagesContainerRef"
        :chat-input-ref="chatInputRef"
      />
    </n-layout-content>
  </n-layout>

  <n-modal
    :show="sessionConfirm.show"
    :mask-closable="true"
    :auto-focus="false"
    :show-icon="false"
    @update:show="handleSessionConfirmVisibleChange"
  >
    <section class="session-confirm-modal" :class="`session-confirm-modal--${sessionConfirm.tone}`">
      <header class="session-confirm-modal__header">
        <AlertIcon class="session-confirm-modal__icon" />
        <h3 class="session-confirm-modal__title">{{ sessionConfirm.title }}</h3>
      </header>

      <p class="session-confirm-modal__desc">{{ sessionConfirm.description }}</p>

      <footer class="session-confirm-modal__actions">
        <NButton class="session-confirm-modal__btn session-confirm-modal__btn--ghost" @click="closeSessionConfirm(false)">
          {{ sessionConfirm.cancelText }}
        </NButton>
        <NButton class="session-confirm-modal__btn session-confirm-modal__btn--danger" @click="closeSessionConfirm(true)">
          {{ sessionConfirm.confirmText }}
        </NButton>
      </footer>
    </section>
  </n-modal>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChatStore } from '../stores/chatStore'
import { NButton, NLayout, NLayoutContent, NLayoutSider, NModal } from 'naive-ui'
import { AlertTriangleIcon as AlertIcon } from 'vue-tabler-icons'
import api from '../api'
import SocSidebar from '../components/layout/SocSidebar.vue'
import { useChatSession } from '../composables/useChatSession'
import ChatTerminal from './Chat.vue'

const messagesContainerRef = ref(null)
const chatInputRef = ref(null)
const isSessionSiderCollapsed = ref(false)
const route = useRoute()
const router = useRouter()
const chatStore = useChatStore()
const analysisJumpHint = ref('')
const analysisJumpEntry = ref(null)
const analysisJumpHistoryVisibleBySession = ref({})
const sessionConfirm = ref({
  show: false,
  title: '',
  description: '',
  confirmText: '确认',
  cancelText: '取消',
  tone: 'blue',
})

let sessionConfirmResolver = null

const openSessionConfirm = (options = {}) => {
  if (sessionConfirmResolver) {
    sessionConfirmResolver(false)
    sessionConfirmResolver = null
  }

  return new Promise((resolve) => {
    sessionConfirmResolver = resolve
    sessionConfirm.value = {
      show: true,
      title: '',
      description: '',
      confirmText: '确认',
      cancelText: '取消',
      tone: 'blue',
      ...options,
    }
  })
}

const closeSessionConfirm = (accepted = false) => {
  if (!sessionConfirm.value.show && !sessionConfirmResolver) return

  const resolver = sessionConfirmResolver
  sessionConfirmResolver = null
  sessionConfirm.value = {
    ...sessionConfirm.value,
    show: false,
  }
  resolver?.(Boolean(accepted))
}

const handleSessionConfirmVisibleChange = (nextShow) => {
  if (nextShow) {
    sessionConfirm.value = {
      ...sessionConfirm.value,
      show: true,
    }
    return
  }

  closeSessionConfirm(false)
}

const confirmDeleteSession = (sessionId) =>
  openSessionConfirm({
    title: '删除会话',
    description: `会话“${sessionId}”将被永久删除，相关消息记录无法恢复。`,
    confirmText: '删除会话',
    cancelText: '保留会话',
    tone: 'blue',
  })

const confirmClearAllSessions = () =>
  openSessionConfirm({
    title: '清空全部历史会话',
    description: '清空全部历史会话，并重建一个默认对话。该操作不可恢复。',
    confirmText: '确认清空',
    cancelText: '取消操作',
    tone: 'blue',
  })

const {
  searchQuery,
  filteredSessions,
  currentSession,
  messages,
  loading,
  isStreaming,
  error,
  handleSelectSession,
  handleDeleteSession,
  handleRenameSession,
  handleCreateSession,
  handleClearAllSessions,
  handleSendMessage,
  handleRegenerate,
  handleEditMessage,
  initializeChatSession,
  stopGenerating,
} = useChatSession({
  apiClient: api,
  messagesContainerRef,
  chatInputRef,
  onConfirmDeleteSession: confirmDeleteSession,
  onConfirmClearAllSessions: confirmClearAllSessions,
})

const analysisJumpHistory = computed(() => chatStore.getAnalysisJumpHistory(currentSession.value, 3))
const analysisHistoryVisible = computed(() => Boolean(analysisJumpHistoryVisibleBySession.value[currentSession.value]))

const revealAnalysisJumpHistory = (sessionId = currentSession.value) => {
  if (!sessionId) return

  analysisJumpHistoryVisibleBySession.value = {
    ...analysisJumpHistoryVisibleBySession.value,
    [sessionId]: true,
  }
}

const hideAnalysisJumpHistory = (sessionId = currentSession.value) => {
  if (!sessionId) return

  analysisJumpHistoryVisibleBySession.value = {
    ...analysisJumpHistoryVisibleBySession.value,
    [sessionId]: false,
  }
}

watch(
  currentSession,
  (nextSession, previousSession) => {
    if (nextSession === previousSession) return
    analysisJumpEntry.value = null
    analysisJumpHint.value = ''
  },
  { flush: 'post' },
)

const handleSendMessageWithHintClear = (...args) => {
  analysisJumpHint.value = ''
  analysisJumpEntry.value = null
  revealAnalysisJumpHistory()
  return handleSendMessage(...args)
}

const handleRegenerateWithHistoryReveal = async (...args) => {
  revealAnalysisJumpHistory()
  return handleRegenerate(...args)
}

const applyAnalysisJump = (entry = analysisJumpEntry.value) => {
  if (!entry) return

  analysisJumpEntry.value = entry
  analysisJumpHint.value = '已预填图表分析问题，可直接编辑后发送。'
  chatInputRef.value?.setContent(entry.prompt || '')
  nextTick(() => chatInputRef.value?.focus())
}

const sendAnalysisJump = async (entry = analysisJumpEntry.value) => {
  if (!entry) return

  revealAnalysisJumpHistory()
  analysisJumpHint.value = ''
  analysisJumpEntry.value = null
  const input = chatInputRef.value
  if (input?.submit) {
    await input.submit()
    return
  }

  const currentDraft = input?.getContent?.()
  const content = (currentDraft || entry.prompt || '').trim()
  if (!content) return

  await handleSendMessage(content)
}

const dismissAnalysisJump = () => {
  analysisJumpEntry.value = null
  analysisJumpHint.value = ''
}

const reuseAnalysisJump = (entry) => {
  if (!entry) return

  analysisJumpEntry.value = entry
  analysisJumpHint.value = '已切换为最近的图表分析入口。'
  chatInputRef.value?.setContent(entry.prompt || '')
  nextTick(() => chatInputRef.value?.focus())
}

const SESSION_SIDEBAR_MQ = '(max-width: 768px)'
let sessionSidebarMq = null

const applySessionSidebarLayout = () => {
  if (sessionSidebarMq?.matches) isSessionSiderCollapsed.value = true
}

onMounted(async () => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    sessionSidebarMq = window.matchMedia(SESSION_SIDEBAR_MQ)
    applySessionSidebarLayout()
    sessionSidebarMq.addEventListener('change', applySessionSidebarLayout)
  }

  await initializeChatSession()

  const pendingAnalysisJump = chatStore.consumeAnalysisJumpDraft()
  if (pendingAnalysisJump) {
    analysisJumpEntry.value = pendingAnalysisJump
  }

  if (route.query.autoSend === 'true') {
    const draftText = analysisJumpEntry.value?.prompt || chatStore.draftInputs?.[currentSession.value]
    if (draftText && draftText.trim()) {
      const normalizedDraft = draftText.trim()
      chatInputRef.value?.setContent(normalizedDraft)
      analysisJumpHint.value = analysisJumpEntry.value
        ? '已生成图表分析模板，可直接编辑后发送。'
        : '已预填会话草稿，可直接编辑后发送。'
      await nextTick()
      chatInputRef.value?.focus()
      // 移除 url 中的 autoSend 参数，避免刷新后重复显示入口状态
      router.replace({ query: { ...route.query, autoSend: undefined } })
    }
  }
})

onUnmounted(() => {
  sessionSidebarMq?.removeEventListener('change', applySessionSidebarLayout)
  closeSessionConfirm(false)
})
</script>

<style scoped>
.chat-page-layout {
  width: 100%;
  height: 100%;
  min-height: 0;
  background: transparent;
}

.chat-page-sider {
  background: transparent;
  padding-right: 0.9rem;
}

.chat-page-sider--collapsed {
  padding-right: 0.35rem;
}

.chat-page-sider-inner {
  height: 100%;
  min-height: 0;
  padding: 0 0 0 15px; 
}

.chat-page-sider-inner--collapsed {
  padding-left: 2px;
}

.chat-page-content {
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.session-confirm-modal {
  width: min(92vw, 520px);
  border: 1px solid rgba(0, 229, 255, 0.22);
  background:
    radial-gradient(circle at 80% -30%, rgba(0, 229, 255, 0.12), transparent 55%),
    linear-gradient(160deg, rgba(8, 16, 34, 0.9), rgba(3, 9, 23, 0.8));
  box-shadow:
    0 0 0 1px rgba(0, 229, 255, 0.1),
    0 20px 60px rgba(0, 0, 0, 0.58);
  padding: 1.15rem 1.2rem 1rem;
  padding-left: 28px;
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

.session-confirm-modal__btn--danger {
  border: 1px solid rgba(255, 0, 85, 0.42);
  color: #ffd9e5;
  background: rgba(255, 0, 85, 0.24);
}

.session-confirm-modal__btn--danger:hover {
  border-color: rgba(255, 0, 85, 0.7);
  background: rgba(255, 0, 85, 0.38);
}

@media (max-width: 1024px) {
  .chat-page-sider {
    width: 250px !important;
    max-width: 250px;
    padding-right: 0.7rem;
  }
}

@media (max-width: 640px) {
  .chat-page-sider {
    width: 220px !important;
    max-width: 220px;
    padding-right: 0.55rem;
  }

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
