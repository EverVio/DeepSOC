/**
 * 模块职责：管理聊天会话请求、流式回包与消息拼接。
 * 业务模块：对话数据层
 * 主要数据流：用户输入 -> 会话请求 -> 流式消息状态
 */

import { storeToRefs } from 'pinia'
import { computed, nextTick, ref } from 'vue'
import { useAppStore } from '../stores/appStore'
import { useChatStore } from '../stores/chatStore'

const DEFAULT_AGENT_DATA = () => ({
  rag: { status: 'idle', content: '', error: '', errorDetail: null },
  web: { status: 'idle', content: '', error: '', errorDetail: null },
})

function formatProviderError(detail, fallbackMessage = '流式响应出错') {
  if (!detail || typeof detail !== 'object') return fallbackMessage

  const provider = detail.provider || 'provider'
  const model = detail.model || 'unknown-model'
  const status = detail.status_code ? `HTTP ${detail.status_code}` : 'HTTP error'
  const code = detail.error_code ? ` (${detail.error_code})` : ''
  const message = detail.message || fallbackMessage

  return `[${provider}/${model}] ${status}${code}: ${message}`
}

export function useChatSession({ apiClient, messagesContainerRef, chatInputRef }) {
  const chatStore = useChatStore()
  const appStore = useAppStore()

  const { sessions, currentSession, messages: messagesBySession } = storeToRefs(chatStore)
  const {
    loading,
    error,
    isEditing,
    editingMessageId,
    useDbSearch,
    useWebSearch,
    llmProvider,
    llmModel,
    providerApiKey,
    webSearchApiKey,
  } = storeToRefs(appStore)

  const lastUserMessage = ref('')
  const searchQuery = ref('')

  const messages = computed(() => messagesBySession.value[currentSession.value] || [])
  const filteredSessions = computed(() => {
    if (!searchQuery.value) return sessions.value
    const query = searchQuery.value.toLowerCase()
    return sessions.value.filter((sessionId) => sessionId.toLowerCase().includes(query))
  })

  const resolveScrollContainer = (scrollbar) => {
    const candidate =
      scrollbar?.containerRef ||
      (scrollbar?.$el && scrollbar.$el.querySelector('.n-scrollbar-container')) ||
      scrollbar

    if (!candidate) return null
    return candidate?.value || candidate
  }

  const scrollToBottom = async () => {
    await nextTick()
    const scrollbar = messagesContainerRef.value
    const container = resolveScrollContainer(scrollbar)

    if (!container) return

    const top = container.scrollHeight
    if (scrollbar && typeof scrollbar.scrollTo === 'function') {
      scrollbar.scrollTo({ top, behavior: 'auto' })
      return
    }

    container.scrollTop = top
  }

  const loadHistory = async (sessionId) => {
    appStore.setLoading(true)
    appStore.setError(null)

    try {
      const response = await apiClient.getHistory(sessionId)
      chatStore.loadHistory(sessionId, response.data.history)
      const sessionMessages = chatStore.messages[sessionId] || []
      const lastUser = [...sessionMessages].reverse().find((message) => message.isUser)
      lastUserMessage.value = lastUser ? lastUser.content : ''
      await scrollToBottom()
    } catch (err) {
      appStore.setError(err.response?.data?.error || '加载历史记录失败')
    } finally {
      appStore.setLoading(false)
    }
  }

  const handleSelectSession = async (sessionId) => {
    chatStore.setCurrentSession(sessionId)
    await loadHistory(sessionId)
  }

  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm(`确定要删除会话 "${sessionId}" 吗？`)) return

    if (chatStore.sessions.length === 1 && chatStore.sessions[0] === sessionId) {
      chatStore.addSession('默认对话')
    }

    await apiClient.clearHistory(sessionId)
    chatStore.removeSession(sessionId)
    chatStore.clearSessionMessages(sessionId)
    await loadHistory(chatStore.currentSession)
  }

  const handleCreateSession = (sessionId) => {
    chatStore.addSession(sessionId)
    chatStore.clearSessionMessages(sessionId)
    loadHistory(sessionId)
  }

  const handleClearHistory = async () => {
    if (!window.confirm(`确定要清空当前会话 "${currentSession.value}" 吗？`)) return
    await apiClient.clearHistory(currentSession.value)
    chatStore.clearSessionMessages(currentSession.value)
    await scrollToBottom()
  }

  const buildModelOptions = () => ({
    provider: llmProvider.value,
    modelName: llmModel.value,
    providerApiKey: providerApiKey.value,
    webSearchApiKey: webSearchApiKey.value,
  })

  const applyAgentStatus = (sessionId, aiMessageId, data) => {
    chatStore.updateAgentStatus(
      sessionId,
      aiMessageId,
      data.agent_id,
      data.status,
      data.error || '',
      data.error_detail || null
    )

    if (data.status === 'error') {
      const message = data.error_detail
        ? formatProviderError(data.error_detail, data.error || '智能体执行失败')
        : data.error || '智能体执行失败'
      appStore.setError(message)
    }

    if (data.agent_id === 'synthesis' && (data.status === 'done' || data.status === 'error')) {
      appStore.setLoading(false)
    }
  }

  const applyGeneralEvent = (sessionId, aiMessageId, data) => {
    if (data.type === 'content') {
      chatStore.updateAgentChunk(sessionId, aiMessageId, 'synthesis', data.chunk || '')
      return
    }

    if (data.type === 'think') {
      chatStore.updateLastMessage(sessionId, { think_chunk: data.chunk })
      return
    }

    if (data.type === 'metadata') {
      chatStore.updateLastMessage(sessionId, { duration: data.duration })
      return
    }

    if (data.type === 'agent_chunk') {
      chatStore.updateAgentChunk(sessionId, aiMessageId, data.agent_id, data.chunk || data.content || '')
      return
    }

    if (data.type === 'agent_status') {
      applyAgentStatus(sessionId, aiMessageId, data)
      return
    }

    if (data.type === 'error') {
      const message = data.error_detail
        ? formatProviderError(data.error_detail, data.chunk || '流式响应出错')
        : data.chunk || '流式响应出错'
      appStore.setError(message)
    }
  }

  const handleNormalSend = async (sessionId, content, extra) => {
    lastUserMessage.value = content

    chatStore.addMessage(sessionId, true, {
      content,
      attachmentName: extra?.attachmentName,
    })
    await scrollToBottom()

    const isMultiAgent = extra?.mode === 'multi_agent'
    const aiMessageId = chatStore.addMessage(sessionId, false, {
      content: '',
      think_process: '',
      isMultiAgent,
      agentData: DEFAULT_AGENT_DATA(),
    })
    await scrollToBottom()

    appStore.setLoading(true)
    appStore.setError(null)

    const input = extra?.attachmentText ? `${content}\n\n[附件]\n${extra.attachmentText}` : content

    await apiClient.streamChat(
      sessionId,
      input,
      (data) => {
        applyGeneralEvent(sessionId, aiMessageId, data)
        scrollToBottom()
      },
      (message) => {
        appStore.setLoading(false)
        appStore.setError(message)
        scrollToBottom()
      },
      () => {
        appStore.setLoading(false)
        scrollToBottom()
      },
      null,
      useDbSearch.value,
      useWebSearch.value,
      buildModelOptions(),
      {
        mode: extra?.mode,
        agentConfigs: extra?.agentConfigs,
        onAgentData: (data) => {
          chatStore.updateAgentChunk(sessionId, aiMessageId, data.agent_id, data.chunk || data.content || '')
          scrollToBottom()
        },
        onAgentStatus: (data) => {
          applyAgentStatus(sessionId, aiMessageId, data)
          scrollToBottom()
        },
      }
    )
  }

  const handleEditSend = async (sessionId, editedContent) => {
    const messageId = editingMessageId.value
    const history = messages.value
    lastUserMessage.value = editedContent

    const editIndex = history.findIndex((message) => message.id === messageId)
    if (editIndex === -1) {
      appStore.setError('找不到要编辑的消息')
      appStore.clearEditing()
      return
    }

    const context = history.slice(0, editIndex).map((message) => ({
      role: message.isUser ? 'user' : 'assistant',
      content: message.content,
    }))
    history[editIndex].content = editedContent

    let aiMessageIndex = editIndex + 1
    if (aiMessageIndex >= history.length) {
      chatStore.addMessage(sessionId, false, { content: '', think_process: '' })
      aiMessageIndex = editIndex + 1
    } else if (history[aiMessageIndex].isUser) {
      history.splice(aiMessageIndex, 0, {
        id: Date.now() + Math.random(),
        isUser: false,
        content: '',
        think_process: '',
        duration: null,
        isMultiAgent: false,
        agentData: DEFAULT_AGENT_DATA(),
        timestamp: new Date(),
      })
      aiMessageIndex = editIndex + 1
    } else {
      history[aiMessageIndex].content = ''
      history[aiMessageIndex].think_process = ''
      history[aiMessageIndex].duration = null
      history[aiMessageIndex].isMultiAgent = false
      history[aiMessageIndex].agentData = DEFAULT_AGENT_DATA()
    }

    if (editIndex + 2 < history.length) {
      history.splice(editIndex + 2)
    }

    await scrollToBottom()
    appStore.setLoading(true)
    appStore.setError(null)

    await apiClient.streamChat(
      sessionId,
      editedContent,
      (data) => {
        if (data.type === 'content') {
          chatStore.updateMessageAtIndex(sessionId, aiMessageIndex, { content_chunk: data.chunk })
        } else if (data.type === 'think') {
          chatStore.updateMessageAtIndex(sessionId, aiMessageIndex, { think_chunk: data.chunk })
        } else if (data.type === 'metadata') {
          chatStore.updateMessageAtIndex(sessionId, aiMessageIndex, { duration: data.duration })
        } else if (data.type === 'error') {
          const message = data.error_detail
            ? formatProviderError(data.error_detail, data.chunk || '流式响应出错')
            : data.chunk || '流式响应出错'
          appStore.setError(message)
        }

        scrollToBottom()
      },
      (message) => {
        appStore.setLoading(false)
        appStore.setError(message)
        appStore.clearEditing()
        scrollToBottom()
      },
      () => {
        appStore.setLoading(false)
        appStore.clearEditing()
        chatInputRef.value?.clearInput()
        scrollToBottom()
      },
      context,
      useDbSearch.value,
      useWebSearch.value,
      buildModelOptions()
    )
  }

  const handleSendMessage = async (content, extra) => {
    if (isEditing.value && editingMessageId.value) {
      await handleEditSend(currentSession.value, content)
    } else {
      await handleNormalSend(currentSession.value, content, extra)
    }
  }

  const handleRegenerate = async () => {
    if (loading.value || !lastUserMessage.value) return

    const sessionMessages = messages.value
    if (sessionMessages.length === 0 || sessionMessages[sessionMessages.length - 1].isUser) return

    chatStore.removeLastMessage(currentSession.value)
    await scrollToBottom()
    await handleNormalSend(currentSession.value, lastUserMessage.value)
  }

  const handleEditMessage = ({ messageId, content }) => {
    appStore.setEditing(messageId)
    chatInputRef.value?.setContent(content)
    scrollToBottom()
    nextTick(() => chatInputRef.value?.focus())
  }

  const initializeChatSession = async () => {
    await loadHistory(currentSession.value)
  }

  return {
    searchQuery,
    sessions,
    currentSession,
    messages,
    loading,
    error,
    filteredSessions,
    handleSelectSession,
    handleDeleteSession,
    handleCreateSession,
    handleClearHistory,
    handleSendMessage,
    handleRegenerate,
    handleEditMessage,
    initializeChatSession,
  }
}
