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
                <pre class="agent-node__content">{{ agentDataSafe.rag.content || '...' }}</pre>
              </article>

              <article class="agent-node">
                <header class="agent-node__header">
                  <span class="agent-node__name">WEB AGENT</span>
                  <span class="agent-node__status" :class="statusClass(agentDataSafe.web.status)">
                    {{ formatAgentStatus(agentDataSafe.web.status) }}
                  </span>
                </header>
                <pre class="agent-node__content">{{ agentDataSafe.web.content || '...' }}</pre>
              </article>
            </div>
          </div>
        </section>

        <div class="terminal-text markdown-body" v-html="renderedContent"></div>
      </template>
      <span v-if="!isUser && !content" class="stream-cursor">_</span>
    </section>

    <footer class="terminal-message__actions">
      <button class="text-btn" :title="copied ? 'COPIED' : 'COPY'" @click="copyContent" :disabled="copied || !content">
        <CheckIcon v-if="copied" class="icon-mini" />
        <CopyIcon v-else class="icon-mini" />
        {{ copied ? 'COPIED' : 'COPY' }}
      </button>

      <button v-if="isUser && content" class="text-btn" title="EDIT" @click="handleEdit">
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
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

marked.use({
  renderer: {
    code({ text, lang }) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext'
      const highlighted = hljs.highlight(text, { language }).value
      return `<pre><code class="hljs ${language}">${highlighted}</code></pre>`
    }
  }
})

const props = defineProps({
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
      rag: { status: 'idle', content: '' },
      web: { status: 'idle', content: '' },
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
  },
  web: {
    status: props.agentData?.web?.status || 'idle',
    content: props.agentData?.web?.content || '',
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
  return marked.parse(props.content)
})

const formatAgentStatus = (status) => {
  if (status === 'started') return 'ANALYZING...'
  if (status === 'done') return 'DONE'
  return 'IDLE'
}

const statusClass = (status) => {
  if (status === 'done') return 'is-done'
  if (status === 'started') return 'is-running'
  return 'is-idle'
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

const handleEdit = () => {
  if (!props.messageId || !props.content) return
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
  border-left: 1px solid var(--border-dim);
  padding: 0.6rem 0.9rem 0.75rem;
  background: linear-gradient(90deg, rgba(0, 229, 255, 0.05) 0%, rgba(0, 229, 255, 0.02) 36%, transparent 100%);
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
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
  margin-bottom: 0.45rem;
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
  font-size: 0.62rem;
  font-weight: 700;
}

.terminal-message--user .meta-sigil {
  color: var(--neon-green);
}

.meta-prompt {
  font-size: 0.66rem;
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
  font-size: 0.62rem;
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
  margin: 0 0 0.58rem;
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
  padding: 0.34rem 0.42rem;
  border-bottom: 1px solid rgba(0, 229, 255, 0.14);
}

.agent-node__name {
  font-family: var(--font-mono);
  font-size: 0.58rem;
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

.agent-node__content {
  margin: 0;
  padding: 0.42rem;
  max-height: 220px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  line-height: 1.55;
  color: #8fe8ff;
}

.terminal-text {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.84rem;
  line-height: 1.65;
  color: var(--neon-cyan);
  white-space: pre-wrap;
  word-break: break-word;
}

.terminal-message--user .terminal-text {
  color: var(--neon-green);
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
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.text-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.22rem;
  padding: 0.2rem 0.42rem;
  border: 1px solid var(--border-dim);
  background: rgba(0, 0, 0, 0.18);
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 0.62rem;
  line-height: 1;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  clip-path: polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px);
}

.text-btn:hover:not(:disabled) {
  color: var(--neon-cyan);
  border-color: var(--border-active);
  background: var(--neon-cyan-dim);
  box-shadow: none;
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
  font-size: 0.84rem;
  line-height: 1.65;
  color: var(--neon-cyan);
  word-break: break-word;
}

:deep(.markdown-body p) {
  margin: 0 0 0.5rem 0;
}

:deep(.markdown-body pre) {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-dim);
  padding: 0.8rem;
  overflow-x: auto;
  margin: 0.5rem 0;
}

:deep(.markdown-body code) {
  font-family: var(--font-mono);
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
