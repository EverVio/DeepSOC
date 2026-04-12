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
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChatStore } from '../stores/chatStore'
import { NLayout, NLayoutContent, NLayoutSider } from 'naive-ui'
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
}
</style>
