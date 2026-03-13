import { useAuthStore } from '../stores/authStore'
import { useChatStore } from '../stores/chatStore'
import { ref, watch } from 'vue'

export function useChatSettings({ router, apiClient, currentSession, sessions }) {
  const authStore = useAuthStore()
  const chatStore = useChatStore()

  const showSettingsModal = ref(false)
  const isExporting = ref(false)
  const selectedSessionForExport = ref(currentSession.value)
  const selectedModel = ref('DeepSeek-R1')
  const availableModels = ref(['DeepSeek-R1:7b', 'Qwen3:8b', 'Llama3:8b'])

  watch(
    () => currentSession.value,
    (sessionId) => {
      if (!showSettingsModal.value) {
        selectedSessionForExport.value = sessionId
      }
    },
    { immediate: true }
  )

  watch(
    sessions,
    (sessionList) => {
      if (!sessionList.includes(selectedSessionForExport.value)) {
        selectedSessionForExport.value = sessionList[0] || ''
      }
    },
    { immediate: true }
  )

  const openSettingsModal = () => {
    selectedSessionForExport.value = currentSession.value
    showSettingsModal.value = true
  }

  const closeSettingsModal = () => {
    showSettingsModal.value = false
  }

  const ensureSessionMessages = async (sessionId) => {
    const cachedMessages = chatStore.messages[sessionId]
    if (cachedMessages?.length > 0) {
      return cachedMessages
    }

    const response = await apiClient.getHistory(sessionId)
    chatStore.loadHistory(sessionId, response.data.history)
    return chatStore.messages[sessionId] || []
  }

  const buildExportHtml = (sessionName, exportTime, sessionMessages) => {
    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>DeepSOC 聊天记录 - ${sessionName}</title><style>body{font-family:monospace;background:#050814;color:#00E5FF;max-width:900px;margin:0 auto;padding:20px}.msg{margin:12px 0;padding:12px;border:1px solid rgba(0,229,255,0.3)}.user{color:#00FF9D}.ai{color:#00E5FF}</style></head><body><h1>DeepSOC - ${sessionName}</h1><p>导出时间: ${exportTime}</p>`

    sessionMessages.forEach((message) => {
      html += `<div class="msg ${message.isUser ? 'user' : 'ai'}"><strong>${message.isUser ? 'USER' : 'AI'}</strong><pre>${message.content || ''}</pre></div>`
    })

    html += `</body></html>`
    return html
  }

  const exportSessionToHtml = async (sessionId) => {
    const sessionMessages = await ensureSessionMessages(sessionId)
    const html = buildExportHtml(sessionId, new Date().toLocaleString('zh-CN'), sessionMessages)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `DeepSOC_${sessionId}_${Date.now()}.html`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleExportSelectedSession = async () => {
    if (isExporting.value || !selectedSessionForExport.value) return

    isExporting.value = true
    try {
      await exportSessionToHtml(selectedSessionForExport.value)
    } catch (e) {
      alert(e.message || '导出失败')
    } finally {
      isExporting.value = false
    }
  }

  const handleLogout = () => {
    if (!window.confirm('确定要退出登录吗？')) return false

    authStore.clearApiKey()
    router.push('/login')
    return true
  }

  const handleLogoutFromModal = () => {
    if (handleLogout()) {
      closeSettingsModal()
    }
  }

  return {
    showSettingsModal,
    isExporting,
    selectedSessionForExport,
    selectedModel,
    availableModels,
    openSettingsModal,
    closeSettingsModal,
    handleExportSelectedSession,
    handleLogoutFromModal,
  }
}
