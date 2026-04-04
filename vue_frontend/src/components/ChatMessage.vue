<template>
  <article class="terminal-message" :class="isUser ? 'terminal-message--user' : 'terminal-message--ai'">
    <header class="terminal-message__meta">
      <div class="meta-left">
        <span class="meta-sigil">{{ isUser ? 'USR' : 'AI' }}</span>
        <span class="meta-prompt">{{ promptLabel }}</span>
        <span v-if="isUser && attachmentName" class="meta-attachment">[ATTACH: {{ attachmentName }}]</span>
      </div>
      <div class="meta-right">
        <span v-if="!isUser && thinkProcess" class="think-toggle" @click="toggleThink" role="button" tabindex="0" @keydown.enter.prevent="toggleThink" @keydown.space.prevent="toggleThink">
          <ChevronDownIcon v-if="!showThink" class="icon-mini" />
          <ChevronUpIcon v-else class="icon-mini" />
          THINK {{ displayTime }}s
        </span>
        <span class="timestamp">{{ formatTime(timestamp) }}</span>
      </div>
    </header>

    <section v-if="!isUser && thinkProcess && showThink" class="think-panel">
      <pre class="terminal-text think-text">{{ thinkProcess }}</pre>
    </section>

    <section class="terminal-message__body">
      <pre v-if="isUser" class="terminal-text">{{ content || '' }}</pre>
      <template v-else>
        <section v-if="isMultiAgent" class="agent-accordion">
          <button
            class="agent-accordion__trigger"
            type="button"
            @click="toggleAgentPanel"
            :aria-expanded="showAgentPanel"
          >
            <span>VIEW TACTICAL ANALYSIS PROCESS</span>
            <ChevronDownIcon v-if="!showAgentPanel" class="icon-mini" />
            <ChevronUpIcon v-else class="icon-mini" />
          </button>

          <div v-if="showAgentPanel" class="agent-accordion__body">
            <div class="agent-grid">
              <article class="agent-node">
                <header class="agent-node__header">
                  <span class="agent-node__name">RAG AGENT</span>
                  <span class="agent-node__status" :class="statusClass(agentDataSafe.rag.status)">
                    {{ formatAgentStatus(agentDataSafe.rag.status) }}
                  </span>
                </header>
                <div
                  class="agent-node__content markdown-body message-markdown"
                  v-html="ragRendered"
                  @click="onMarkdownClick"
                ></div>
                <p v-if="agentDataSafe.rag.error" class="agent-node__error">{{ formatAgentError(agentDataSafe.rag) }}</p>
              </article>

              <article class="agent-node">
                <header class="agent-node__header">
                  <span class="agent-node__name">WEB AGENT</span>
                  <span class="agent-node__status" :class="statusClass(agentDataSafe.web.status)">
                    {{ formatAgentStatus(agentDataSafe.web.status) }}
                  </span>
                </header>
                <div
                  class="agent-node__content markdown-body message-markdown"
                  v-html="webRendered"
                  @click="onMarkdownClick"
                ></div>
                <p v-if="agentDataSafe.web.error" class="agent-node__error">{{ formatAgentError(agentDataSafe.web) }}</p>
              </article>
            </div>
          </div>
        </section>

        <div
          class="terminal-text markdown-body message-markdown"
          v-html="renderedContent"
          @click="onMarkdownClick"
        ></div>
      </template>
      <span v-if="!isUser && !content" class="stream-cursor">_</span>
    </section>

    <footer class="terminal-message__actions">
      <button class="text-btn" :title="copied ? 'COPIED' : 'COPY'" @click="copyContent" :disabled="copied || !content">
        <CheckIcon v-if="copied" class="icon-mini" />
        <CopyIcon v-else class="icon-mini" />
        {{ copied ? 'COPIED' : 'COPY' }}
      </button>

      <button v-if="isUser && content && canEdit" class="text-btn" title="EDIT" @click="handleEdit">
        <PencilIcon class="icon-mini" /> EDIT
      </button>

      <button v-if="allowRegenerate" class="text-btn" title="REGENERATE" @click="$emit('regenerate')">
        <RefreshIcon class="icon-mini" /> REGEN
      </button>
    </footer>
  </article>
</template>

<script setup>
import { computed, defineEmits, defineProps, onUnmounted, ref, watch } from 'vue'
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, CopyIcon, PencilIcon, RefreshIcon } from 'vue-tabler-icons'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

const CODE_COPY_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`
const CODE_CHECK_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`

const utf8ToBase64 = (str) => btoa(unescape(encodeURIComponent(str)))

const decodeFromCodeB64 = (b64) => {
  try {
    return decodeURIComponent(escape(atob(b64)))
  } catch {
    return ''
  }
}

marked.use({
  renderer: {
    code({ text, lang }) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext'
      const highlighted = hljs.highlight(text, { language }).value
      const payload = utf8ToBase64(text)
      return `<div class="code-block-wrapper"><button type="button" class="code-copy-btn" data-code-b64="${payload}" title="复制代码" aria-label="复制代码">${CODE_COPY_ICON_SVG}</button><pre><code class="hljs ${language}">${highlighted}</code></pre></div>`
    }
  }
})

const sanitizeMarkdown = (markdownText) => {
  const rendered = marked.parse(markdownText || '')
  return DOMPurify.sanitize(rendered, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
    ADD_TAGS: ['button', 'svg', 'path', 'rect'],
    ADD_ATTR: [
      'data-code-b64',
      'aria-hidden',
      'stroke-linecap',
      'stroke-linejoin',
      'viewBox',
      'xmlns',
      'width',
      'height',
      'fill',
      'stroke',
      'stroke-width',
      'rx',
      'ry',
      'd',
    ],
  })
}

const ragRendered = computed(() => {
  return sanitizeMarkdown(props.agentData?.rag?.content || '...')
})

const webRendered = computed(() => {
  return sanitizeMarkdown(props.agentData?.web?.content || '...')
})

const props = defineProps({
  canEdit: { type: Boolean, default: false },
  isUser: { type: Boolean, required: true },
  content: { type: String, required: true },
  attachmentName: { type: String, default: '' },
  timestamp: { type: Date, required: true },
  thinkProcess: { type: String, default: '' },
  duration: { type: Number, default: null },
  allowRegenerate: { type: Boolean, default: false },
  messageId: { type: [String, Number], default: null },
  isMultiAgent: { type: Boolean, default: false },
  agentData: {
    type: Object,
    default: () => ({
      rag: { status: 'idle', content: '', error: '', errorDetail: null },
      web: { status: 'idle', content: '', error: '', errorDetail: null },
    }),
  },
})

const emit = defineEmits(['regenerate', 'edit'])

const showThink = ref(false)
const showAgentPanel = ref(false)
const copied = ref(false)
const displayTime = ref(props.duration ? props.duration.toFixed(1) : '0.0')
let timerId = null

const promptLabel = computed(() => {
  if (props.isUser) return 'root@DeepSOC:~$'
  return 'ai@DeepSOC:/analysis#'
})

const agentDataSafe = computed(() => ({
  rag: {
    status: props.agentData?.rag?.status || 'idle',
    content: props.agentData?.rag?.content || '',
    error: props.agentData?.rag?.error || '',
    errorDetail: props.agentData?.rag?.errorDetail || null,
  },
  web: {
    status: props.agentData?.web?.status || 'idle',
    content: props.agentData?.web?.content || '',
    error: props.agentData?.web?.error || '',
    errorDetail: props.agentData?.web?.errorDetail || null,
  },
}))

const toggleThink = () => {
  showThink.value = !showThink.value
}

const toggleAgentPanel = () => {
  showAgentPanel.value = !showAgentPanel.value
}

const renderedContent = computed(() => {
  if (!props.content) return ''
  return sanitizeMarkdown(props.content)
})

const formatAgentStatus = (status) => {
  if (status === 'started') return 'ANALYZING...'
  if (status === 'done') return 'DONE'
  if (status === 'error') return 'ERROR'
  return 'IDLE'
}

const statusClass = (status) => {
  if (status === 'done') return 'is-done'
  if (status === 'started') return 'is-running'
  if (status === 'error') return 'is-error'
  return 'is-idle'
}

const formatAgentError = (agent) => {
  if (!agent?.errorDetail) {
    return agent?.error || '执行失败'
  }

  const detail = agent.errorDetail
  const provider = detail.provider || 'provider'
  const model = detail.model || 'unknown-model'
  const status = detail.status_code ? `HTTP ${detail.status_code}` : 'HTTP error'
  const code = detail.error_code ? ` (${detail.error_code})` : ''
  const message = detail.message || agent.error || '执行失败'

  return `[${provider}/${model}] ${status}${code}: ${message}`
}

watch(
  () => props.thinkProcess,
  (nextValue, prevValue) => {
    if (props.isUser) return
    if (!nextValue) return
    if (props.duration) return
    if (prevValue) return
    if (timerId) return

    const startTime = Date.now()
    displayTime.value = '0.0'
    timerId = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000
      displayTime.value = elapsed.toFixed(1)
    }, 100)
  }
)

watch(
  () => props.duration,
  (nextDuration) => {
    if (!nextDuration) return
    if (timerId) {
      clearInterval(timerId)
      timerId = null
    }
    displayTime.value = nextDuration.toFixed(1)
  },
  { immediate: true }
)

onUnmounted(() => {
  if (timerId) clearInterval(timerId)
})

const copyContent = () => {
  if (!props.content || copied.value) return
  navigator.clipboard.writeText(props.content)
    .then(() => {
      copied.value = true
      setTimeout(() => {
        copied.value = false
      }, 1500)
    })
    .catch(() => {})
}

const codeCopyTimers = new WeakMap()

const onMarkdownClick = (e) => {
  const btn = e.target.closest?.('.code-copy-btn')
  if (!btn || !e.currentTarget.contains(btn)) return
  e.preventDefault()
  e.stopPropagation()
  void handleCodeCopyButton(btn)
}

const handleCodeCopyButton = async (btn) => {
  const b64 = btn.getAttribute('data-code-b64')
  let text = b64 ? decodeFromCodeB64(b64) : ''
  if (!text) {
    const code = btn.closest('.code-block-wrapper')?.querySelector('pre code')
    text = (code?.innerText ?? '').replace(/\u00a0/g, ' ')
  }
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy')
    } finally {
      document.body.removeChild(ta)
    }
  }
  const prevHtml = btn.innerHTML
  btn.innerHTML = CODE_CHECK_ICON_SVG
  btn.classList.add('code-copy-btn--done')
  const oldT = codeCopyTimers.get(btn)
  if (oldT) clearTimeout(oldT)
  const t = window.setTimeout(() => {
    btn.innerHTML = prevHtml || CODE_COPY_ICON_SVG
    btn.classList.remove('code-copy-btn--done')
    codeCopyTimers.delete(btn)
  }, 1400)
  codeCopyTimers.set(btn, t)
}

const handleEdit = () => {
  if (!props.canEdit || !props.messageId || !props.content) return
  emit('edit', {
    messageId: props.messageId,
    content: props.content,
  })
}

const formatTime = (date) => {
  if (!date) return '--:--'
  return new Date(date).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}
</script>

<style scoped>
.terminal-message {
  position: relative;
  border-left: 2px solid var(--border-dim); /* 加粗左侧边框线 */
  padding: 1.5rem 3rem 1.5rem;
  background: linear-gradient(90deg, rgba(0, 229, 255, 0.08) 0%, rgba(0, 229, 255, 0.02) 25%, transparent 100%);
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
  transition: background 0.2s ease, border-left-color 0.2s ease;
}

.terminal-message:hover {
  background: linear-gradient(90deg, rgba(0, 229, 255, 0.12) 0%, rgba(0, 229, 255, 0.03) 30%, transparent 100%);
  border-left-color: rgba(0, 229, 255, 0.8);
}

.terminal-message--user {
  border-left-color: rgba(0, 255, 157, 0.5);
  background: linear-gradient(90deg, rgba(0, 255, 157, 0.08) 0%, rgba(0, 255, 157, 0.02) 30%, transparent 100%);
}


.terminal-message--ai {
  border-left-color: rgba(0, 229, 255, 0.55);
}

.terminal-message__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  margin-bottom: 0.65rem;
  padding-bottom: 0.45rem;
  border-bottom: 1px dashed rgba(0, 229, 255, 0.15); 
  font-family: var(--font-mono);
  letter-spacing: 0.06em;
}

.meta-left,
.meta-right {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
}

.meta-sigil {
  color: var(--neon-cyan);
  font-size: 1rem;
  font-weight: 700;
}

.terminal-message--user .meta-sigil {
  color: var(--neon-green);
}

.meta-prompt {
  font-size: 1rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta-attachment {
  font-size: 0.62rem;
  color: var(--neon-purple);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.timestamp {
  font-size: 1rem;
  color: var(--text-muted);
}

.think-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.22rem;
  font-size: 0.62rem;
  color: var(--neon-purple);
  cursor: pointer;
  user-select: none;
}

.think-toggle:focus-visible {
  outline: 1px solid var(--neon-purple);
  outline-offset: 2px;
}

.think-panel {
  margin: 0 0 0.55rem;
  border: 1px solid var(--neon-purple-dim);
  background: rgba(123, 44, 191, 0.08);
  padding: 0.5rem 0.65rem;
}

.terminal-message__body {
  position: relative;
  min-height: 1.2rem;
}

.agent-accordion {
  margin: 0 0 2rem;
  border: 1px solid var(--border-dim);
  background: linear-gradient(90deg, rgba(0, 229, 255, 0.08) 0%, rgba(0, 229, 255, 0.03) 52%, rgba(0, 0, 0, 0.16) 100%);
}

.agent-accordion__trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  border: none;
  border-bottom: 1px solid rgba(0, 229, 255, 0.18);
  background: rgba(2, 8, 22, 0.55);
  color: var(--neon-cyan);
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  padding: 0.4rem 0.52rem;
  cursor: pointer;
  text-align: left;
}

.agent-accordion__body {
  padding: 0.52rem;
}

.agent-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.45rem;
}

.agent-node {
  border: 1px solid rgba(0, 229, 255, 0.18);
  background: rgba(0, 0, 0, 0.22);
  min-height: 120px;
}

.agent-node__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.35rem;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid rgba(0, 229, 255, 0.14);
}

.agent-node__name {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  letter-spacing: 0.09em;
  color: var(--text-secondary);
}

.agent-node__status {
  font-family: var(--font-mono);
  font-size: 0.56rem;
  letter-spacing: 0.08em;
}

.agent-node__status.is-running {
  color: var(--neon-cyan);
}

.agent-node__status.is-done {
  color: var(--neon-green);
}

.agent-node__status.is-idle {
  color: var(--text-muted);
}

.agent-node__status.is-error {
  color: #ff6b93;
}

.agent-node__content {
  margin: 0;
  padding: 1rem 1.5rem;
  max-height: 400px;
  overflow: auto;
  font-family: var(--font-mono);
  font-size: 1rem;
  line-height: 1.55;
  color: #8fe8ff;
}

.agent-node__content :deep(p),
.agent-node__content :deep(li) {
  font-size: 1rem;
  margin-bottom: 0.4rem;
}

.agent-node__error {
  margin: 0;
  border-top: 1px solid rgba(255, 107, 147, 0.35);
  padding: 0.35rem 0.42rem 0.45rem;
  font-family: var(--font-mono);
  font-size: 0.62rem;
  line-height: 1.4;
  color: #ff9bb7;
  white-space: pre-wrap;
  word-break: break-word;
}

.terminal-text {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 1rem;
  line-height: 1.8;
  color: #e5b8b8; /* 柔和的灰青色替代高亮青色 */
  white-space: pre-wrap;
  word-break: break-word;
}

.terminal-message--user .terminal-text {
  color: #a3ebd5; 
}

.think-text {
  color: #cf9bff;
  font-size: 0.76rem;
}

.stream-cursor {
  display: inline-block;
  margin-left: 0.3rem;
  color: var(--neon-cyan);
  font-family: var(--font-mono);
  animation: blink 0.8s step-end infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.terminal-message__actions {
  margin-top: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  transition: opacity 0.2s ease;
}

.terminal-message:hover .terminal-message__actions {
  opacity: 1; /* 鼠标进入卡片区域时激活 */
}
.text-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.22rem;
  padding: 0.2rem 0.5rem;
  border: 1px solid rgba(0, 229, 255, 0.15); /* 降低边框初始对比度 */
  background: rgba(0, 0, 0, 0.2);
  color: #7ba7bc; /* 降低文字初始对比度 */
  font-family: var(--font-mono);
  font-size: 0.62rem;
  line-height: 1.2;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  clip-path: polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px);
  transition: all 0.2s ease;
}

.text-btn:hover:not(:disabled) {
  color: var(--neon-cyan);
  border-color: rgba(0, 229, 255, 0.5);
  background: rgba(0, 229, 255, 0.1);
}

.text-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.icon-mini {
  width: 0.78rem;
  height: 0.78rem;
}

:deep(.markdown-body) {
  font-family: var(--font-mono);
  font-size: 1rem;
  line-height: 1.8;
  color: var(--neon-cyan);
  word-break: break-word;
}

:deep(.markdown-body p) {
  margin: 0 0 0.2rem 0 !important;
  line-height: 1.6;
}

.message-markdown :deep(.code-block-wrapper) {
  position: relative;
  margin: 0.6rem 0;
}

.message-markdown :deep(.code-copy-btn) {
  position: absolute;
  z-index: 3;
  top: 8px;
  right: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  margin: 0;
  border: 1px solid rgba(0, 229, 255, 0.28);
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.82);
  color: rgba(0, 229, 255, 0.85);
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}

.message-markdown :deep(.code-copy-btn:hover) {
  background: rgba(0, 229, 255, 0.12);
  border-color: rgba(0, 229, 255, 0.45);
  color: #e0fbff;
}

.message-markdown :deep(.code-copy-btn--done) {
  border-color: rgba(67, 243, 162, 0.45);
  color: var(--neon-green, #43f3a2);
}

.message-markdown :deep(.code-block-wrapper pre) {
  background: #0f172a !important;
  border: 1px solid rgba(0, 229, 255, 0.22) !important;
  padding: 2rem 0.9rem 0.9rem;
  overflow-x: auto;
  margin: 0;
  border-radius: 4px;
}

.message-markdown :deep(pre) {
  background: #0f172a !important;
  border: 1px solid rgba(0, 229, 255, 0.22) !important;
  padding: 0.9rem;
  overflow-x: auto;
  margin: 0.6rem 0;
  border-radius: 4px;
}

.message-markdown :deep(pre code),
.message-markdown :deep(pre code.hljs) {
  font-family: var(--font-mono);
  background: transparent !important;
}

.message-markdown :deep(pre .hljs),
.message-markdown :deep(code.hljs) {
  background: transparent !important;
}

.message-markdown :deep(:not(pre) code) {
  font-family: var(--font-mono);
  background: rgba(0, 229, 255, 0.1) !important;
  border: 1px solid rgba(0, 229, 255, 0.18);
  border-radius: 3px;
  padding: 0.12em 0.35em;
  font-size: 0.92em;
  color: #b8e8ff;
}

:deep(.markdown-body pre) {
  background: rgba(3, 8, 18, 0.6);
  border: 1px solid rgba(0, 229, 255, 0.2);
  padding: 0.9rem;
  overflow-x: auto;
  margin: 0.6rem 0;
  border-radius: 4px; /* 代码块允许轻微圆角，与终端整体风格不冲突且更易读 */
}

:deep(.markdown-body code) {
  font-family: var(--font-mono);
}

:deep(.markdown-body > *:first-child) {
  margin-top: 0 !important;
}
:deep(.markdown-body > *:last-child) {
  margin-bottom: 0 !important;
}

:deep(.markdown-body h1),
:deep(.markdown-body h2),
:deep(.markdown-body h3),
:deep(.markdown-body h4),
:deep(.markdown-body h5),
:deep(.markdown-body h6) {
  font-size: 1.05rem; 
  color: #00E5FF; 
  margin: 1.4rem 0 0.6rem 0; 
  font-weight: 700;
  line-height: 1.4;
}

:deep(.markdown-body ul),
:deep(.markdown-body ol) {
  margin: 0.1rem 0 !important;
  padding-left: 2.5rem; 
}

:deep(.agent-node__content.markdown-body ul),
:deep(.agent-node__content.markdown-body ol) {
  margin: 0.5rem 0;
  padding-left: 2rem;
}

:deep(.markdown-body li) {
  margin-bottom: 0.1rem;
}

:deep(.markdown-body li > ul),
:deep(.markdown-body li > ol) {
  margin-bottom: 0;
  margin-top: 0.4rem;
}

:deep(.markdown-body strong),
:deep(.markdown-body b) {
  color: #00E5FF; 
  font-weight: 700;
}

@media (max-width: 900px) {
  .terminal-message {
    padding: 0.55rem 0.7rem 0.65rem;
  }

  .terminal-text {
    font-size: 0.8rem;
  }

  .terminal-message__meta {
    flex-direction: column;
    align-items: flex-start;
  }

  .agent-grid {
    grid-template-columns: 1fr;
  }
}
</style>
