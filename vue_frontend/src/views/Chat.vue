<template>
  <!-- SOC 大屏根容器：CSS Grid 驱动 -->
  <div class="soc-dashboard">

    <!-- ══════════════════════════════════════════════════════
         顶部 HUD 状态栏
    ══════════════════════════════════════════════════════ -->
    <header class="soc-header">
      <div class="header-brand">
        <span class="brand-name">DEEP<em>SOC</em></span>
        <span class="brand-sub">Security Operations Center</span>
      </div>

      <div class="header-hud">
        <div class="hud-item">
          <span class="hud-label">SYSTEM</span>
          <span class="hud-value hud-value--green">ONLINE</span>
        </div>
        <div class="hud-divider" />
        <div class="hud-item">
          <span class="hud-label">DEFCON</span>
          <span class="hud-value hud-value--cyan">LEVEL 4</span>
        </div>
        <div class="hud-divider" />
        <div class="hud-item">
          <span class="hud-label">SESSION</span>
          <span class="hud-value hud-value--cyan session-name-display">{{ currentSession }}</span>
        </div>
        <div class="hud-divider" />
        <div class="hud-item">
          <span class="hud-label">TIME</span>
          <span class="hud-value hud-value--cyan">{{ currentTime }}</span>
        </div>
      </div>

      <div class="header-controls">
        <button class="hud-btn" @click="toggleSidebar" :title="isSidebarOpen ? '收起面板' : '展开面板'">
          <MenuIcon class="hud-icon" />
        </button>
        <button class="hud-btn" @click="openSettingsModal" title="设置">
          <SettingsIcon class="hud-icon" />
        </button>
      </div>

      <!-- 底部装饰线 -->
      <div class="header-line" aria-hidden="true">
        <div class="header-line-fill" />
      </div>
    </header>

    <!-- ══════════════════════════════════════════════════════
         主内容区：左面板 + 中央终端
    ══════════════════════════════════════════════════════ -->
    <main class="soc-main" :class="{ 'sidebar-collapsed': !isSidebarOpen }">

      <!-- 左侧：会话管理面板 -->
      <aside class="panel-left" v-show="isSidebarOpen">
        <FuiCard title="TACTICAL SESSIONS" class="h-full">
          <template #actions>
            <button class="fui-icon-btn" @click="handleCreateSession('新会话 ' + Date.now())" title="新建会话">
              <PlusIcon class="btn-icon" />
            </button>
          </template>

          <!-- 搜索框 -->
          <div class="session-search">
            <SearchIcon class="search-icon-sm" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="SEARCH SESSION..."
              class="session-search-input"
            />
          </div>

          <!-- 会话列表 -->
          <div class="session-items">
            <div
              v-for="session in filteredSessions"
              :key="session"
              class="session-item"
              :class="{ 'session-item--active': session === currentSession }"
              @click="handleSelectSession(session)"
            >
              <TerminalIcon class="session-icon" />
              <span class="session-item-name">{{ session }}</span>
              <button
                class="fui-icon-btn session-del"
                @click.stop="handleDeleteSession(session)"
                title="删除"
              >
                <TrashIcon class="btn-icon" />
              </button>
            </div>
            <div v-if="filteredSessions.length === 0" class="session-empty">
              NO SESSIONS FOUND
            </div>
          </div>

          <!-- 底部操作 -->
          <div class="panel-footer">
            <button class="fui-footer-btn" @click="handleClearHistory">
              <TrashIcon class="btn-icon" />
              CLEAR SESSION
            </button>
          </div>
        </FuiCard>
      </aside>

      <!-- 中央：战术分析终端 -->
      <section class="panel-center">
        <FuiCard class="h-full terminal-card">
          <template #header>
            <div class="terminal-header-left">
              <span class="status-dot-inline" />
              <span class="terminal-title">TACTICAL ANALYSIS TERMINAL</span>
            </div>
            <div class="terminal-header-right">
              <span class="terminal-meta">{{ currentSession }}</span>
              <span class="terminal-meta">大模型故障日志诊断</span>
            </div>
          </template>

          <!-- 错误提示 -->
          <div v-if="error" class="fui-error-bar">
            <AlertIcon class="btn-icon" /> {{ error }}
          </div>

          <!-- 消息流 -->
          <div class="messages-viewport" ref="messagesContainerRef">
            <!-- 空态 -->
            <div v-if="messages.length === 0" class="terminal-empty">
              <div class="terminal-empty-art">
                <svg height="4em" viewBox="0 0 24 24" width="4em" xmlns="http://www.w3.org/2000/svg">
                  <path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588z" fill="#00E5FF"/>
                </svg>
              </div>
              <p class="terminal-empty-text">
                <span class="prompt-prefix">root@DeepSOC:~$</span>
                &nbsp;_
              </p>
              <p class="terminal-empty-hint">awaiting tactical input...</p>
            </div>

            <!-- 消息列表 -->
            <ChatMessage
              v-for="(msg, index) in messages"
              :key="msg.id"
              :is-user="msg.isUser"
              :content="msg.content"
              :attachment-name="msg.attachmentName"
              :think-process="msg.think_process"
              :duration="msg.duration"
              :timestamp="msg.timestamp"
              :message-id="msg.id"
              :allow-regenerate="!msg.isUser && index === messages.length - 1 && !loading"
              @regenerate="handleRegenerate"
              @edit="handleEditMessage"
            />

            <!-- 流式加载指示 -->
            <div
              v-if="loading && messages.length > 0 &&
                    !messages[messages.length - 1].isUser &&
                    !messages[messages.length - 1].content &&
                    !messages[messages.length - 1].think_process"
              class="terminal-loading"
            >
              <span class="loading-cursor">█</span>
              <span class="loading-text">ANALYZING...</span>
            </div>
          </div>

          <!-- 输入区 -->
          <div class="terminal-input-zone">
            <ChatInput
              ref="chatInputRef"
              :loading="loading"
              @send="handleSendMessage"
            />
          </div>
        </FuiCard>
      </section>
    </main>

    <!-- ══════════════════════════════════════════════════════
         设置模态框（功能保留，样式 FUI 化）
    ══════════════════════════════════════════════════════ -->
    <div
      v-if="showSettingsModal"
      class="fui-modal-overlay"
      @click.self="closeSettingsModal"
    >
      <FuiCard title="SYSTEM CONFIG" class="fui-modal-card" :clip="18">
        <template #actions>
          <button class="fui-icon-btn" @click="closeSettingsModal"><XIcon class="btn-icon" /></button>
        </template>

        <div class="modal-body">
          <div class="modal-field">
            <label class="modal-label">EXPORT SESSION</label>
            <select class="fui-select" v-model="selectedSessionForExport">
              <option v-for="s in sessions" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>

          <div class="modal-field">
            <label class="modal-label">AI MODEL</label>
            <select class="fui-select" v-model="selectedModel">
              <option v-for="m in availableModels" :key="m" :value="m">{{ m }}</option>
            </select>
          </div>

          <div class="modal-actions">
            <button class="primary" :disabled="isExporting" @click="handleExportSelectedSession">
              <DownloadIcon class="btn-icon" />
              {{ isExporting ? 'EXPORTING...' : 'EXPORT HTML' }}
            </button>
            <button class="danger" @click="handleLogoutFromModal">
              <LogoutIcon class="btn-icon" />
              LOGOUT
            </button>
          </div>
        </div>
      </FuiCard>
    </div>

  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, computed, ref, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useStore } from '../store'
import api from '../api'
import FuiCard from '../components/FuiCard.vue'
import ChatMessage from '../components/ChatMessage.vue'
import ChatInput from '../components/ChatInput.vue'
import {
  DownloadIcon, TrashIcon, LogoutIcon, MenuIcon, SettingsIcon,
  XIcon, PlusIcon, SearchIcon, TerminalIcon, AlertTriangleIcon as AlertIcon,
} from 'vue-tabler-icons'

const store = useStore()
const router = useRouter()
const messagesContainerRef = ref(null)
const chatInputRef = ref(null)
const lastUserMessage = ref('')
const isSidebarOpen = ref(true)
const searchQuery = ref('')

// ── 计算属性 ─────────────────────────────────────────────
const sessions       = computed(() => store.sessions)
const currentSession = computed(() => store.currentSession)
const messages       = computed(() => store.messages[currentSession.value] || [])
const loading        = computed(() => store.loading)
const error          = computed(() => store.error)
const isEditing      = computed(() => store.isEditing)
const editingMessageId = computed(() => store.editingMessageId)
const useDbSearch    = computed(() => store.useDbSearch)
const useWebSearch   = computed(() => store.useWebSearch)

const filteredSessions = computed(() => {
  if (!searchQuery.value) return sessions.value
  const q = searchQuery.value.toLowerCase()
  return sessions.value.filter(s => s.toLowerCase().includes(q))
})

// ── 实时时钟 ─────────────────────────────────────────────
const currentTime = ref('')
let clockTimer = null
const updateClock = () => {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString('zh-CN', { hour12: false })
}
updateClock()

// ── 设置模态框 ────────────────────────────────────────────
const showSettingsModal = ref(false)
const isExporting = ref(false)
const selectedSessionForExport = ref(currentSession.value)
const selectedModel = ref('DeepSeek-R1')
const availableModels = ref(['DeepSeek-R1:7b', 'Qwen3:8b', 'Llama3:8b'])

watch(() => currentSession.value, (v) => {
  if (!showSettingsModal.value) selectedSessionForExport.value = v
}, { immediate: true })

watch(sessions, (v) => {
  if (!v.includes(selectedSessionForExport.value))
    selectedSessionForExport.value = v[0] || ''
}, { immediate: true })

const openSettingsModal = () => {
  selectedSessionForExport.value = currentSession.value
  showSettingsModal.value = true
}
const closeSettingsModal = () => { showSettingsModal.value = false }

// ── 工具函数 ──────────────────────────────────────────────
const toggleSidebar = () => { isSidebarOpen.value = !isSidebarOpen.value }

const scrollToBottom = async () => {
  await nextTick()
  const c = messagesContainerRef.value
  if (c) c.scrollTop = c.scrollHeight
}

const loadHistory = async (sessionId) => {
  store.setLoading(true)
  store.setError(null)
  try {
    const res = await api.getHistory(sessionId)
    store.loadHistory(sessionId, res.data.history)
    const msgs = store.messages[sessionId] || []
    const last = [...msgs].reverse().find(m => m.isUser)
    lastUserMessage.value = last ? last.content : ''
    await scrollToBottom()
  } catch (err) {
    store.setError(err.response?.data?.error || '加载历史记录失败')
  } finally {
    store.setLoading(false)
  }
}

const loadGlossary = async () => {
  try {
    const res = await api.getGlossary()
    store.setGlossary(res.data.terms || {})
  } catch {}
}

// ── 会话操作 ─────────────────────────────────────────────
const handleSelectSession = async (sessionId) => {
  store.setCurrentSession(sessionId)
  await loadHistory(sessionId)
}

const handleDeleteSession = async (sessionId) => {
  if (!window.confirm(`确定要删除会话 "${sessionId}" 吗？`)) return
  if (store.sessions.length === 1 && store.sessions[0] === sessionId)
    store.addSession('默认对话')
  await api.clearHistory(sessionId)
  store.removeSession(sessionId)
  store.clearSessionMessages(sessionId)
  await loadHistory(store.currentSession)
}

const handleCreateSession = (sessionId) => {
  store.addSession(sessionId)
  store.clearSessionMessages(sessionId)
  loadHistory(sessionId)
}

const handleClearHistory = async () => {
  if (!window.confirm(`确定要清空当前会话 "${currentSession.value}" 吗？`)) return
  await api.clearHistory(currentSession.value)
  store.clearSessionMessages(currentSession.value)
  await scrollToBottom()
}

// ── 发送消息 ─────────────────────────────────────────────
const handleSendMessage = async (content, extra) => {
  if (isEditing.value && editingMessageId.value)
    await handleEditSend(currentSession.value, content)
  else
    await handleNormalSend(currentSession.value, content, extra)
}

const handleNormalSend = async (sessionId, content, extra) => {
  lastUserMessage.value = content
  store.addMessage(sessionId, true, {
    content,
    attachmentName: extra?.attachmentName,
  })
  await scrollToBottom()
  store.addMessage(sessionId, false, { content: '', think_process: '' })
  await scrollToBottom()
  store.setLoading(true)
  store.setError(null)

  const input = extra?.attachmentText ? `${content}\n\n[附件]\n${extra.attachmentText}` : content
  await api.streamChat(
    sessionId, input,
    (data) => {
      if (data.type === 'content') store.updateLastMessage(sessionId, { content_chunk: data.chunk })
      else if (data.type === 'think')    store.updateLastMessage(sessionId, { think_chunk: data.chunk })
      else if (data.type === 'metadata') store.updateLastMessage(sessionId, { duration: data.duration })
      else if (data.type === 'error')    store.setError(data.chunk || '流式响应出错')
      scrollToBottom()
    },
    (msg) => { store.setLoading(false); store.setError(msg); scrollToBottom() },
    ()    => { store.setLoading(false); scrollToBottom() },
    null, useDbSearch.value, useWebSearch.value
  )
}

const handleEditSend = async (sessionId, editedContent) => {
  const messageId = editingMessageId.value
  const history   = messages.value
  lastUserMessage.value = editedContent

  const editIndex = history.findIndex(m => m.id === messageId)
  if (editIndex === -1) { store.setError('找不到要编辑的消息'); store.clearEditing(); return }

  const context = history.slice(0, editIndex).map(m => ({ role: m.isUser ? 'user' : 'assistant', content: m.content }))
  history[editIndex].content = editedContent

  let aiIdx = editIndex + 1
  if (aiIdx >= history.length) {
    store.addMessage(sessionId, false, { content: '', think_process: '' }); aiIdx = editIndex + 1
  } else if (history[aiIdx].isUser) {
    history.splice(aiIdx, 0, { id: Date.now() + Math.random(), isUser: false, content: '', think_process: '', duration: null, timestamp: new Date() })
    aiIdx = editIndex + 1
  } else {
    history[aiIdx].content = ''; history[aiIdx].think_process = ''; history[aiIdx].duration = null
  }
  if (editIndex + 2 < history.length) history.splice(editIndex + 2)

  await scrollToBottom()
  store.setLoading(true); store.setError(null)

  await api.streamChat(
    sessionId, editedContent,
    (data) => {
      if (data.type === 'content') store.updateMessageAtIndex(sessionId, aiIdx, { content_chunk: data.chunk })
      else if (data.type === 'think')    store.updateMessageAtIndex(sessionId, aiIdx, { think_chunk: data.chunk })
      else if (data.type === 'metadata') store.updateMessageAtIndex(sessionId, aiIdx, { duration: data.duration })
      else if (data.type === 'error')    store.setError(data.chunk || '流式响应出错')
      scrollToBottom()
    },
    (msg) => { store.setLoading(false); store.setError(msg); store.clearEditing(); scrollToBottom() },
    ()    => { store.setLoading(false); store.clearEditing(); chatInputRef.value?.clearInput(); scrollToBottom() },
    context, useDbSearch.value, useWebSearch.value
  )
}

const handleRegenerate = async () => {
  if (loading.value || !lastUserMessage.value) return
  const msgs = messages.value
  if (msgs.length === 0 || msgs[msgs.length - 1].isUser) return
  store.removeLastMessage(currentSession.value)
  await scrollToBottom()
  await handleNormalSend(currentSession.value, lastUserMessage.value)
}

const handleEditMessage = ({ messageId, content }) => {
  store.setEditing(messageId)
  chatInputRef.value?.setContent(content)
  scrollToBottom()
  nextTick(() => chatInputRef.value?.focus())
}

// ── 导出功能 ─────────────────────────────────────────────
const ensureSessionMessages = async (sessionId) => {
  let msgs = store.messages[sessionId]
  if (msgs?.length > 0) return msgs
  const res = await api.getHistory(sessionId)
  store.loadHistory(sessionId, res.data.history)
  return store.messages[sessionId] || []
}

const buildExportHtml = (sessionName, exportTime, msgs) => {
  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>DeepSOC 聊天记录 - ${sessionName}</title>
<style>body{font-family:monospace;background:#050814;color:#00E5FF;max-width:900px;margin:0 auto;padding:20px}
.msg{margin:12px 0;padding:12px;border:1px solid rgba(0,229,255,0.3)}.user{color:#00FF9D}.ai{color:#00E5FF}</style>
</head><body><h1>DeepSOC — ${sessionName}</h1><p>导出时间: ${exportTime}</p>`
  msgs.forEach(m => {
    html += `<div class="msg ${m.isUser ? 'user' : 'ai'}"><strong>${m.isUser ? 'USER' : 'AI'}</strong><pre>${m.content || ''}</pre></div>`
  })
  html += `</body></html>`
  return html
}

const exportSessionToHtml = async (sessionId) => {
  const msgs = await ensureSessionMessages(sessionId)
  const html = buildExportHtml(sessionId, new Date().toLocaleString('zh-CN'), msgs)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `DeepSOC_${sessionId}_${Date.now()}.html`; a.click()
  URL.revokeObjectURL(url)
}

const handleExportSelectedSession = async () => {
  if (isExporting.value || !selectedSessionForExport.value) return
  isExporting.value = true
  try { await exportSessionToHtml(selectedSessionForExport.value) }
  catch (e) { alert(e.message || '导出失败') }
  finally { isExporting.value = false }
}

const handleLogout = () => {
  if (!window.confirm('确定要退出登录吗？')) return false
  store.clearApiKey(); router.push('/login'); return true
}
const handleLogoutFromModal = () => { if (handleLogout()) closeSettingsModal() }

// ── 生命周期 ─────────────────────────────────────────────
onMounted(() => {
  loadGlossary()
  loadHistory(currentSession.value)
  clockTimer = setInterval(updateClock, 1000)
})
onBeforeUnmount(() => { clearInterval(clockTimer) })
</script>

<style scoped>
/* ── 根布局 ─────────────────────────────────────────────── */
.soc-dashboard {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-rows: 52px 1fr;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  padding: 0;
}

/* ── 顶部 HUD 状态栏 ─────────────────────────────────────── */
.soc-header {
  display: flex;
  align-items: center;
  padding: 0 1.25rem;
  background: rgba(5, 8, 20, 0.92);
  border-bottom: 1px solid var(--border-dim);
  position: relative;
  z-index: 10;
  gap: 1.5rem;
  flex-shrink: 0;
}

.brand-name {
  font-family: var(--font-brand);
  font-size: 1.1rem;
  font-weight: 900;
  color: var(--neon-cyan);
  letter-spacing: 0.15em;
  text-shadow: var(--neon-cyan-glow);
  line-height: 1;
}
.brand-name em {
  font-style: normal;
  color: var(--neon-purple);
  text-shadow: 0 0 8px rgba(123, 44, 191, 0.7);
}
.brand-sub {
  font-family: var(--font-mono);
  font-size: 0.55rem;
  color: var(--text-muted);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  display: block;
  margin-top: 2px;
}

.header-hud {
  display: flex;
  align-items: center;
  gap: 0;
  margin-left: auto;
}
.hud-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 1rem;
}
.hud-label {
  font-family: var(--font-mono);
  font-size: 0.5rem;
  color: var(--text-muted);
  letter-spacing: 0.15em;
  text-transform: uppercase;
}
.hud-value {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  margin-top: 1px;
}
.hud-value--cyan   { color: var(--neon-cyan); }
.hud-value--green  { color: var(--neon-green); text-shadow: 0 0 6px rgba(0,255,157,0.5); }
.session-name-display {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hud-divider {
  width: 1px;
  height: 28px;
  background: var(--border-dim);
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.hud-btn {
  background: transparent;
  border: 1px solid var(--border-dim);
  color: var(--text-secondary);
  padding: 0.3rem;
  clip-path: none;
  border-radius: 2px;
  transition: all 0.2s;
  letter-spacing: 0;
  text-transform: none;
}
.hud-btn:hover {
  border-color: var(--neon-cyan);
  color: var(--neon-cyan);
  background: var(--neon-cyan-dim);
  box-shadow: none;
}
.hud-icon { width: 1.1rem; height: 1.1rem; display: block; }

/* 底部装饰线 */
.header-line {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 1px;
  background: var(--border-dim);
  overflow: hidden;
}
.header-line-fill {
  height: 100%;
  width: 30%;
  background: linear-gradient(90deg, transparent 0%, var(--neon-cyan) 50%, transparent 100%);
  animation: lineScan 4s linear infinite;
}
@keyframes lineScan {
  from { transform: translateX(-100%); }
  to   { transform: translateX(400%); }
}

/* ── 主内容区 CSS Grid ──────────────────────────────────── */
.soc-main {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 10px;
  padding: 10px;
  overflow: hidden;
  transition: grid-template-columns 0.3s ease;
}
.soc-main.sidebar-collapsed {
  grid-template-columns: 0 1fr;
}

/* 左侧面板 */
.panel-left {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: opacity 0.3s ease;
}
.sidebar-collapsed .panel-left {
  opacity: 0;
  pointer-events: none;
}

/* h-full 工具类：让 FuiCard 撑满父容器 */
.h-full {
  height: 100%;
}

/* ── 会话列表内部 ──────────────────────────────────────── */
.session-search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--border-dim);
  flex-shrink: 0;
}
.search-icon-sm { width: 0.9rem; height: 0.9rem; color: var(--text-muted); flex-shrink: 0; }
.session-search-input {
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.05em;
  width: 100%;
  clip-path: none;
  padding: 0;
}
.session-search-input::placeholder { color: var(--text-muted); font-style: normal; }
.session-search-input:focus { outline: none; }

.session-items {
  flex: 1;
  overflow-y: auto;
  padding: 0.4rem 0;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  transition: background 0.15s;
  border-left: 2px solid transparent;
}
.session-item:hover {
  background: rgba(0, 229, 255, 0.05);
  border-left-color: rgba(0, 229, 255, 0.3);
}
.session-item--active {
  background: rgba(0, 229, 255, 0.1);
  border-left-color: var(--neon-cyan);
}
.session-icon { width: 0.8rem; height: 0.8rem; color: var(--text-muted); flex-shrink: 0; }
.session-item-name {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text-secondary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.session-item--active .session-item-name { color: var(--neon-cyan); }
.session-del { opacity: 0; padding: 0.15rem; transition: opacity 0.15s; }
.session-item:hover .session-del { opacity: 1; }

.session-empty {
  padding: 1rem 0.75rem;
  font-family: var(--font-mono);
  font-size: 0.65rem;
  color: var(--text-muted);
  letter-spacing: 0.1em;
}

.panel-footer {
  border-top: 1px solid var(--border-dim);
  padding: 0.5rem;
  flex-shrink: 0;
}
.fui-footer-btn {
  width: 100%;
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  padding: 0.4rem 0.75rem;
  background: transparent;
  color: var(--text-muted);
  border-color: var(--border-dim);
  gap: 0.4rem;
}
.fui-footer-btn:hover {
  color: var(--neon-red);
  border-color: rgba(255, 0, 85, 0.5);
  background: rgba(255, 0, 85, 0.08);
  box-shadow: none;
}

.fui-icon-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.2rem;
  display: flex;
  align-items: center;
  clip-path: none;
  letter-spacing: 0;
  text-transform: none;
  font-size: inherit;
  transition: color 0.15s;
}
.fui-icon-btn:hover { color: var(--neon-cyan); background: transparent; box-shadow: none; }
.btn-icon { width: 0.9rem; height: 0.9rem; display: block; }

/* ── 中央终端面板 ─────────────────────────────────────── */
.panel-center {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.terminal-card {
  /* FuiCard body 需要 flex 列布局来让消息区撑满 */
}
/* 覆盖 FuiCard body 为 flex 列 */
.terminal-card :deep(.fui-card-body) {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.terminal-header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.status-dot-inline {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--neon-cyan);
  box-shadow: 0 0 6px var(--neon-cyan);
  flex-shrink: 0;
  animation: dotPulse 2.4s ease-in-out infinite;
}
@keyframes dotPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }

.terminal-title {
  font-family: var(--font-ui);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--neon-cyan);
}
.terminal-header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-left: auto;
}
.terminal-meta {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  color: var(--text-muted);
  letter-spacing: 0.06em;
}

/* 错误条 */
.fui-error-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 1rem;
  background: rgba(255, 0, 85, 0.1);
  border-bottom: 1px solid rgba(255, 0, 85, 0.35);
  color: var(--neon-red);
  font-family: var(--font-mono);
  font-size: 0.8rem;
  flex-shrink: 0;
}

/* 消息视口 */
.messages-viewport {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem 2.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* 空态 */
.terminal-empty {
  margin: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  opacity: 0.6;
}
.terminal-empty-art svg { filter: drop-shadow(0 0 8px rgba(0,229,255,0.4)); }
.terminal-empty-text {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: var(--text-secondary);
}
.prompt-prefix { color: var(--neon-cyan); }
.terminal-empty-hint {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  color: var(--text-muted);
  letter-spacing: 0.1em;
}

/* 流式加载指示 */
.terminal-loading {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--neon-cyan);
  align-self: flex-start;
}
.loading-cursor {
  animation: blink 0.8s step-end infinite;
  color: var(--neon-cyan);
}
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
.loading-text { color: var(--text-secondary); letter-spacing: 0.1em; font-size: 0.7rem; }

/* 输入区 */
.terminal-input-zone {
  border-top: 1px solid var(--border-dim);
  padding: 0.75rem 1rem;
  flex-shrink: 0;
  background: rgba(0, 0, 0, 0.25);
}

/* ── 设置模态框 ───────────────────────────────────────── */
.fui-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(5, 8, 20, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.fui-modal-card {
  width: min(480px, 90vw);
}
.modal-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.25rem;
}
.modal-label {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  color: var(--text-muted);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  display: block;
  margin-bottom: 0.4rem;
}
.fui-select {
  width: 100%;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid var(--border-dim);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0;
  appearance: none;
  cursor: pointer;
}
.fui-select:focus {
  outline: none;
  border-color: var(--neon-cyan);
  box-shadow: 0 0 0 1px var(--neon-cyan-dim);
}
.modal-actions {
  display: flex;
  gap: 0.75rem;
  flex-direction: column;
}
</style>
