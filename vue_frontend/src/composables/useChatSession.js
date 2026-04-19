/**
 * 模块职责：管理聊天会话请求、流式回包与消息拼接。
 * 业务模块：对话数据层
 * 主要数据流：用户输入 -> 会话请求 -> 流式消息状态
 */

import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useAppStore } from '../stores/appStore'
import { useAuthStore } from '../stores/authStore'
import { useChatStore } from '../stores/chatStore'

const DEFAULT_AGENT_DATA = () => ({
  rag: { status: 'idle', content: '', error: '', errorDetail: null },
  web: { status: 'idle', content: '', error: '', errorDetail: null },
})

const STREAM_BATCH_WINDOW_MS = 50

function formatProviderError(detail, fallbackMessage = '流式响应出错') {
  if (!detail || typeof detail !== 'object') return fallbackMessage

  const provider = detail.provider || 'provider'
  const model = detail.model || 'unknown-model'
  const status = detail.status_code ? `HTTP ${detail.status_code}` : 'HTTP error'
  const code = detail.error_code ? ` (${detail.error_code})` : ''
  const message = detail.message || fallbackMessage

  return `[${provider}/${model}] ${status}${code}: ${message}`
}

export function useChatSession({
  apiClient,
  messagesContainerRef,
  chatInputRef,
  onConfirmDeleteSession,
  onConfirmClearAllSessions,
}) {
  const chatStore = useChatStore()
  const appStore = useAppStore()
  const authStore = useAuthStore()

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
    embeddingMode,
    embeddingModel,
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

  const createNextSessionName = () => {
    const prefix = '新对话'
    const existingNumbers = sessions.value
      .map((sessionId) => {
        const match = String(sessionId || '').trim().match(/^新对话\s*(\d+)$/)
        return match ? Number.parseInt(match[1], 10) : null
      })
      .filter((value) => Number.isInteger(value) && value > 0)

    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1
    return `${prefix}${nextNumber}`
  }

  const resolveScrollContainer = (scrollbar) => {
    if (!scrollbar) return null
    const inner = scrollbar.scrollbarInstRef?.value
    if (inner?.containerRef) {
      const c = inner.containerRef
      return c.value ?? c
    }
    const candidate =
      scrollbar?.containerRef ||
      (scrollbar?.$el && scrollbar.$el.querySelector('.n-scrollbar-container')) ||
      scrollbar

    if (!candidate) return null
    return candidate?.value || candidate
  }

  const handleUnauthorized = () => {
    authStore.logout()
    appStore.clearSensitiveKeys()
    appStore.clearEditing()
    appStore.setLoading(false)
    appStore.setError('登录状态已失效，请重新登录')
  }

  onMounted(() => {
    window.addEventListener('deepsoc:unauthorized', handleUnauthorized)
  })

  onUnmounted(() => {
    window.removeEventListener('deepsoc:unauthorized', handleUnauthorized)
  })

  /** 仅用于切换会话、加载历史、编辑消息等需无视「跟随底部」策略的场景；流式跟随时由 Chat.vue 处理 */
  const scrollMessagesToBottomForced = async () => {
    const run = () => {
      const scrollbar = messagesContainerRef.value
      if (!scrollbar) return
      /** NScrollbar 对外 API：position:bottom 比手写 scrollHeight 更可靠 */
      if (typeof scrollbar.scrollTo === 'function') {
        scrollbar.scrollTo({ position: 'bottom', behavior: 'auto' })
        return
      }
      const container = resolveScrollContainer(scrollbar)
      if (container) {
        container.scrollTop = container.scrollHeight
      }
    }
    await nextTick()
    await nextTick()
    run()
    requestAnimationFrame(() => {
      run()
      requestAnimationFrame(run)
    })
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
      await scrollMessagesToBottomForced()
    } catch (err) {
      appStore.setError(err.response?.data?.error || '加载历史记录失败')
    } finally {
      appStore.setLoading(false)
    }
  }

  const handleSelectSession = async (sessionId) => {
    appStore.clearEditing()
    chatStore.setCurrentSession(sessionId)
    await loadHistory(sessionId)
  }

  const handleDeleteSession = async (sessionId) => {
    const confirmed = onConfirmDeleteSession
      ? await onConfirmDeleteSession(sessionId)
      : window.confirm(`确定要删除会话 "${sessionId}" 吗？`)
    if (!confirmed) return

    appStore.clearEditing()

    if (chatStore.sessions.length === 1 && chatStore.sessions[0] === sessionId) {
      chatStore.addSession('默认对话')
    }

    await apiClient.deleteSession(sessionId)
    chatStore.removeSession(sessionId)
    chatStore.clearSessionMessages(sessionId)
    await loadHistory(chatStore.currentSession)
  }

  const handleCreateSession = () => {
    appStore.clearEditing()

    const sessionId = createNextSessionName()
    chatStore.addSession(sessionId)
    chatStore.clearSessionMessages(sessionId)
    loadHistory(sessionId)
  }

  const handleRenameSession = async (oldId, newName) => {
    const next = (newName || '').trim()
    if (!next) {
      appStore.setError('会话名称不能为空')
      return
    }
    if (next.length > 100) {
      appStore.setError('会话名称长度不能超过 100 个字符')
      return
    }
    const oldTrim = (oldId || '').trim()
    if (!oldTrim || oldTrim === next) return
    if (sessions.value.includes(next)) {
      appStore.setError('已存在同名会话，请使用其他名称')
      return
    }

    appStore.clearEditing()
    appStore.setLoading(true)
    appStore.setError(null)
    try {
      await apiClient.renameSession(oldTrim, next)
      const wasCurrent = currentSession.value === oldTrim
      chatStore.renameSession(oldTrim, next)
      if (wasCurrent) {
        await loadHistory(next)
      }
    } catch (err) {
      appStore.setError(err.response?.data?.error || err.message || '重命名失败')
    } finally {
      appStore.setLoading(false)
    }
  }

  const handleClearAllSessions = async () => {
    const confirmed = onConfirmClearAllSessions
      ? await onConfirmClearAllSessions()
      : window.confirm('确定要删除所有会话记录吗？此操作会清空左侧全部历史会话，并重建一个默认对话。')

    if (!confirmed) {
      return
    }

    appStore.clearEditing()
    const ids = [...sessions.value]
    const results = await Promise.allSettled(ids.map((id) => apiClient.deleteSession(id)))

    const failed = []
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        failed.push(ids[index])
      }
    })

    chatStore.resetToSingleDefaultSession()

    if (failed.length) {
      appStore.setError(
        `部分会话后端清空失败（${failed.length} 个），本地列表已重置。失败项：${failed.join('、')}`,
      )
    }

    await loadHistory(chatStore.currentSession)
  }

  const buildModelOptions = () => ({
    provider: llmProvider.value,
    modelName: llmModel.value,
    embeddingMode: embeddingMode.value,
    embeddingModel: embeddingModel.value,
    providerApiKey: providerApiKey.value,
    webSearchApiKey: webSearchApiKey.value,
  })

  let activeStreamAbortController = null
  const isStreaming = ref(false)
  const streamPatchQueue = []
  let streamFlushRafId = 0
  let streamFlushTimerId = 0

  const stopGenerating = () => {
    try {
      activeStreamAbortController?.abort()
    } catch {
      // ignore
    }
    activeStreamAbortController = null
    isStreaming.value = false
    appStore.setLoading(false)
  }

  const clearStreamFlushHandles = () => {
    if (streamFlushRafId) {
      window.cancelAnimationFrame(streamFlushRafId)
      streamFlushRafId = 0
    }

    if (streamFlushTimerId) {
      clearTimeout(streamFlushTimerId)
      streamFlushTimerId = 0
    }
  }

  const flushStreamPatchQueue = () => {
    clearStreamFlushHandles()

    if (!streamPatchQueue.length) return

    const synthesisChunks = new Map()
    const thinkChunks = new Map()
    const durations = new Map()
    const agentChunks = new Map()

    while (streamPatchQueue.length) {
      const patch = streamPatchQueue.shift()
      if (!patch) continue

      if (patch.type === 'content') {
        const key = `${patch.sessionId}::${patch.messageId}`
        const prev = synthesisChunks.get(key)
        if (prev) {
          prev.chunk += patch.chunk
        } else {
          synthesisChunks.set(key, {
            sessionId: patch.sessionId,
            messageId: patch.messageId,
            chunk: patch.chunk,
          })
        }
        continue
      }

      if (patch.type === 'think') {
        const prev = thinkChunks.get(patch.sessionId)
        thinkChunks.set(patch.sessionId, `${prev || ''}${patch.chunk || ''}`)
        continue
      }

      if (patch.type === 'metadata') {
        durations.set(patch.sessionId, patch.duration)
        continue
      }

      if (patch.type === 'agent_chunk') {
        const key = `${patch.sessionId}::${patch.messageId}::${patch.agentId}`
        const prev = agentChunks.get(key)
        if (prev) {
          prev.chunk += patch.chunk
        } else {
          agentChunks.set(key, {
            sessionId: patch.sessionId,
            messageId: patch.messageId,
            agentId: patch.agentId,
            chunk: patch.chunk,
          })
        }
      }
    }

    synthesisChunks.forEach((payload) => {
      if (!payload.chunk) return
      chatStore.updateAgentChunk(payload.sessionId, payload.messageId, 'synthesis', payload.chunk)
    })

    thinkChunks.forEach((chunk, sessionId) => {
      if (!chunk) return
      chatStore.updateLastMessage(sessionId, { think_chunk: chunk })
    })

    durations.forEach((duration, sessionId) => {
      if (!duration) return
      chatStore.updateLastMessage(sessionId, { duration })
    })

    agentChunks.forEach((payload) => {
      if (!payload.chunk) return
      chatStore.updateAgentChunk(payload.sessionId, payload.messageId, payload.agentId, payload.chunk)
    })
  }

  const scheduleStreamPatchFlush = () => {
    if (!streamFlushRafId && typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      streamFlushRafId = window.requestAnimationFrame(() => {
        streamFlushRafId = 0
        flushStreamPatchQueue()
      })
    }

    if (!streamFlushTimerId) {
      streamFlushTimerId = setTimeout(() => {
        streamFlushTimerId = 0
        flushStreamPatchQueue()
      }, STREAM_BATCH_WINDOW_MS)
    }
  }

  const enqueueStreamPatch = (patch) => {
    if (!patch) return
    streamPatchQueue.push(patch)
    scheduleStreamPatchFlush()
  }

  const runStreamChat = async (
    sessionId,
    aiMessageId,
    input,
    context,
    extra,
    streamErrorSideEffect,
    streamCompleteSideEffect,
  ) => {
    const ac = new AbortController()
    activeStreamAbortController = ac
    isStreaming.value = true
    appStore.clearRuntimeNotice()
    try {
      await apiClient.streamChat(
        sessionId,
        input,
        (data) => {
          applyGeneralEvent(sessionId, aiMessageId, data)
        },
        (message) => {
          flushStreamPatchQueue()
          streamErrorSideEffect?.()
          appStore.setLoading(false)
          appStore.setError(message)
        },
        () => {
          flushStreamPatchQueue()
          appStore.setLoading(false)
          streamCompleteSideEffect?.()
        },
        context,
        useDbSearch.value,
        useWebSearch.value,
        buildModelOptions(),
        {
          mode: extra?.mode,
          agentConfigs: extra?.agentConfigs,
          idleTimeoutMs: 120000,
          maxRetries: 1,
          bufferLimitBytes: 1024 * 1024,
          signal: ac.signal,
          onAgentData: (data) => {
            enqueueStreamPatch({
              type: 'agent_chunk',
              sessionId,
              messageId: aiMessageId,
              agentId: data.agent_id,
              chunk: data.chunk || data.content || '',
            })
          },
          onAgentStatus: (data) => {
            flushStreamPatchQueue()
            applyAgentStatus(sessionId, aiMessageId, data)
          },
          onNotice: (data) => {
            const message = String(data?.message || '').trim()
            if (!message) return
            appStore.setRuntimeNotice(message)
          },
        },
      )
    } finally {
      flushStreamPatchQueue()
      isStreaming.value = false
      if (activeStreamAbortController === ac) {
        activeStreamAbortController = null
      }
    }
  }

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
      enqueueStreamPatch({
        type: 'content',
        sessionId,
        messageId: aiMessageId,
        chunk: data.chunk || '',
      })
      return
    }

    if (data.type === 'think') {
      enqueueStreamPatch({
        type: 'think',
        sessionId,
        chunk: data.chunk || '',
      })
      return
    }

    if (data.type === 'metadata') {
      enqueueStreamPatch({
        type: 'metadata',
        sessionId,
        duration: data.duration,
      })
      return
    }

    if (data.type === 'agent_chunk') {
      enqueueStreamPatch({
        type: 'agent_chunk',
        sessionId,
        messageId: aiMessageId,
        agentId: data.agent_id,
        chunk: data.chunk || data.content || '',
      })
      return
    }

    if (data.type === 'agent_status') {
      flushStreamPatchQueue()
      applyAgentStatus(sessionId, aiMessageId, data)
      return
    }

    if (data.type === 'error') {
      flushStreamPatchQueue()
      const fallbackMessage = data.message || data.chunk || '流式响应出错'
      const message = data.error_detail
        ? formatProviderError(data.error_detail, fallbackMessage)
        : fallbackMessage
      appStore.setError(message)
    }
  }

  const handleNormalSend = async (sessionId, content, extra) => {
    const historyContext = (chatStore.messages[sessionId] || [])
      .filter((message) => {
        const text = String(message?.content || '').trim()
        return text.length > 0
      })
      .map((message) => ({
        role: message.isUser ? 'user' : 'assistant',
        content: String(message.content || ''),
      }))
      .slice(-24)

    lastUserMessage.value = content

    chatStore.addMessage(sessionId, true, {
      content,
      attachmentName: extra?.attachmentName,
    })

    const isMultiAgent = extra?.mode === 'multi_agent'
    const aiMessageId = chatStore.addMessage(sessionId, false, {
      content: '',
      think_process: '',
      isMultiAgent,
      agentData: DEFAULT_AGENT_DATA(),
    })

    await scrollMessagesToBottomForced()

    appStore.setLoading(true)
    appStore.setError(null)

    const input = extra?.attachmentText ? `${content}\n\n[附件]\n${extra.attachmentText}` : content

    await runStreamChat(sessionId, aiMessageId, input, historyContext, extra, undefined, undefined)
  }

  const buildHistoryContextBeforeLastUser = (sessionId) => {
    const sessionMessages = chatStore.messages[sessionId] || []
    let lastUserIdx = -1

    for (let i = sessionMessages.length - 1; i >= 0; i -= 1) {
      if (sessionMessages[i].isUser) {
        lastUserIdx = i
        break
      }
    }

    if (lastUserIdx === -1) return []

    return sessionMessages
      .slice(0, lastUserIdx)
      .filter((message) => String(message?.content || '').trim().length > 0)
      .map((message) => ({
        role: message.isUser ? 'user' : 'assistant',
        content: String(message.content || ''),
      }))
      .slice(-24)
  }

  const submitEditedLastUserMessage = async (sessionId, messageId, editedContent, extra) => {
    if (!messageId) {
      appStore.setError('缺少要编辑的消息标识')
      appStore.clearEditing()
      return
    }

    const historySlice = chatStore.messages[sessionId]
    if (!historySlice || historySlice.length === 0) {
      appStore.setError('没有可编辑的消息')
      appStore.clearEditing()
      return
    }

    let lastUserIdx = -1
    for (let i = historySlice.length - 1; i >= 0; i -= 1) {
      if (historySlice[i].isUser) {
        lastUserIdx = i
        break
      }
    }

    if (lastUserIdx === -1 || historySlice[lastUserIdx].id !== messageId) {
      appStore.setError('只能编辑最近一条用户消息')
      appStore.clearEditing()
      return
    }

    const contextForLlm = historySlice.slice(0, lastUserIdx).map((m) => ({
      role: m.isUser ? 'user' : 'assistant',
      content: m.content || '',
    }))

    historySlice.splice(lastUserIdx)
    lastUserMessage.value = editedContent

    chatStore.addMessage(sessionId, true, {
      content: editedContent,
      attachmentName: extra?.attachmentName,
    })

    const isMultiAgent = extra?.mode === 'multi_agent'
    const aiMessageId = chatStore.addMessage(sessionId, false, {
      content: '',
      think_process: '',
      isMultiAgent,
      agentData: DEFAULT_AGENT_DATA(),
    })

    await scrollMessagesToBottomForced()

    appStore.setLoading(true)
    appStore.setError(null)

    const input = extra?.attachmentText ? `${editedContent}\n\n[附件]\n${extra.attachmentText}` : editedContent

    await runStreamChat(
      sessionId,
      aiMessageId,
      input,
      contextForLlm,
      extra,
      () => appStore.clearEditing(),
      () => {
        appStore.clearEditing()
        chatInputRef.value?.clearInput()
      },
    )
  }

  const handleSendMessage = async (content, extra) => {
    if (isEditing.value && editingMessageId.value) {
      await submitEditedLastUserMessage(currentSession.value, editingMessageId.value, content, extra)
      return
    }
    await handleNormalSend(currentSession.value, content, extra)
  }

  const handleRegenerate = async () => {
    if (loading.value || !lastUserMessage.value) return

    const sessionMessages = messages.value
    if (sessionMessages.length === 0 || sessionMessages[sessionMessages.length - 1].isUser) return

    const historyContext = buildHistoryContextBeforeLastUser(currentSession.value)
    const lastAssistantMessage = sessionMessages[sessionMessages.length - 1]
    const extra = lastAssistantMessage?.isMultiAgent ? { mode: 'multi_agent' } : undefined

    chatStore.removeLastMessage(currentSession.value)

    const isMultiAgent = extra?.mode === 'multi_agent'
    const aiMessageId = chatStore.addMessage(currentSession.value, false, {
      content: '',
      think_process: '',
      isMultiAgent,
      agentData: DEFAULT_AGENT_DATA(),
    })

    await scrollMessagesToBottomForced()

    appStore.setLoading(true)
    appStore.setError(null)

    await runStreamChat(
      currentSession.value,
      aiMessageId,
      lastUserMessage.value,
      historyContext,
      extra,
      undefined,
      undefined,
    )
  }

  const handleEditMessage = async ({ messageId, content, extra } = {}) => {
    if (loading.value || isStreaming.value) return

    const editedContent = String(content || '').trim()
    if (!messageId || !editedContent) return

    const raw = chatStore.messages[currentSession.value] || []
    let lastUserId = null
    let lastUserContent = ''
    for (let i = raw.length - 1; i >= 0; i -= 1) {
      if (raw[i].isUser && String(raw[i].content || '').trim()) {
        lastUserId = raw[i].id
        lastUserContent = raw[i].content || ''
        break
      }
    }

    if (messageId !== lastUserId) {
      appStore.setError('只能编辑最近一条用户消息')
      return
    }

    if (editedContent === String(lastUserContent || '').trim()) return

    await submitEditedLastUserMessage(currentSession.value, messageId, editedContent, extra)
  }

  const initializeChatSession = async () => {
    try {
      const response = await apiClient.getSessions()
      chatStore.hydrateSessions(response?.data?.sessions || [])
    } catch (err) {
      appStore.setError(err.response?.data?.error || '同步后端会话列表失败，已使用本地会话列表')
    }

    const localSessionMessages = chatStore.messages[currentSession.value] || []
    if (localSessionMessages.length > 0) {
      const lastUser = [...localSessionMessages].reverse().find((message) => message.isUser)
      lastUserMessage.value = lastUser ? lastUser.content : ''
      await scrollMessagesToBottomForced()
      return
    }

    await loadHistory(currentSession.value)
  }

  onUnmounted(() => {
    clearStreamFlushHandles()
    streamPatchQueue.length = 0
  })

  return {
    searchQuery,
    sessions,
    currentSession,
    messages,
    loading,
    isStreaming,
    error,
    filteredSessions,
    handleSelectSession,
    handleDeleteSession,
    handleCreateSession,
    handleRenameSession,
    handleClearAllSessions,
    handleSendMessage,
    handleRegenerate,
    handleEditMessage,
    initializeChatSession,
    stopGenerating,
  }
}
