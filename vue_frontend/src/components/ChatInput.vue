<template>
  <div class="terminal-input-shell" :class="{ 'terminal-input-shell--focused': isFocused }">
    <div class="terminal-controls">
      <div class="toggle-group">
        <label class="toggle-item" title="查询本地知识库">
          <input type="checkbox" v-model="useDbSearch" />
          <span class="toggle-core">
            <DatabaseIcon class="toggle-icon" /> DB SEARCH
          </span>
        </label>

        <label class="toggle-item" title="使用互联网搜索">
          <input type="checkbox" v-model="useWebSearch" />
          <span class="toggle-core">
            <WorldIcon class="toggle-icon" /> WEB SEARCH
          </span>
        </label>

        <label class="toggle-item" title="启用 RAG/Web 并行与综合输出">
          <input type="checkbox" v-model="isMultiAgentEnabled" />
          <span class="toggle-core">
            <BoltIcon class="toggle-icon" /> MULTI AGENT
          </span>
        </label>
      </div>

      <div v-if="attachmentText" class="attachment-chip" title="附件将随本次消息发送">
        <PaperclipIcon class="toggle-icon" />
        <span class="attachment-name">{{ attachmentName }}</span>
        <button class="chip-close" @click="removeAttachment" :disabled="loading" aria-label="移除附件">x</button>
      </div>
    </div>

    <div v-if="isMultiAgentEnabled" class="multi-agent-config">
      <div class="multi-agent-config__title">TACTICAL MODEL MATRIX</div>
      <div class="multi-agent-config__grid">
        <label class="agent-model-field">
          <span class="agent-model-label">RAG MODEL</span>
          <input
            v-model="multiAgentModels.rag"
            class="agent-model-input"
            type="text"
            placeholder="deepseek-chat"
            :disabled="loading"
          />
        </label>

        <label class="agent-model-field">
          <span class="agent-model-label">WEB MODEL</span>
          <input
            v-model="multiAgentModels.web"
            class="agent-model-input"
            type="text"
            placeholder="gpt-4o-mini"
            :disabled="loading"
          />
        </label>

        <label class="agent-model-field">
          <span class="agent-model-label">SYNTHESIS MODEL</span>
          <input
            v-model="multiAgentModels.synthesis"
            class="agent-model-input"
            type="text"
            placeholder="deepseek-reasoner"
            :disabled="loading"
          />
        </label>
      </div>
    </div>

    <div class="input-stage">
      <input
        ref="fileInputRef"
        type="file"
        accept=".txt,.docx,.xlsx"
        style="display: none"
        @change="onFileChange"
      />

      <button class="stage-btn" @click="triggerFileSelect" :disabled="loading" title="上传文件">
        <PaperclipIcon class="stage-icon" />
      </button>

      <div class="prompt-col">
        <span class="prompt-label">root@DeepSOC:~$</span>
      </div>

      <textarea
        ref="textareaRef"
        v-model="message"
        class="terminal-textarea"
        placeholder="输入诊断命令、日志片段或排障请求..."
        @keyup.enter.exact.prevent="sendMessage"
        @keyup.enter.shift.exact="addNewline"
        @input="onInput"
        @focus="setFocusState(true)"
        @blur="setFocusState(false)"
        :disabled="loading"
        rows="1"
      ></textarea>

      <button
        class="stage-btn stage-btn--send"
        @click="sendMessage"
        :disabled="!message.trim() || loading"
        title="发送"
      >
        <span v-if="loading" class="loading-dot"></span>
        <SendIcon v-else class="stage-icon" />
      </button>
    </div>

    <div class="wave-lane" aria-hidden="true" :class="{ 'is-active': isFocused || message.length > 0 }">
      <span
        v-for="index in 32"
        :key="`wave-${index}`"
        class="wave-bar"
        :style="`--delay: ${index * 20}ms; --hue: ${185 + (index % 7)}`"
      ></span>
    </div>
  </div>
</template>

<script setup>
import { computed, defineEmits, defineExpose, defineProps, nextTick, onMounted, ref } from 'vue'
import { useAppStore } from '../stores/appStore'
import { BoltIcon, DatabaseIcon, PaperclipIcon, SendIcon, WorldIcon } from 'vue-tabler-icons'
import { uploadFile as uploadFileApi } from '../api'

const props = defineProps({
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['send'])

const appStore = useAppStore()
const message = ref('')
const textareaRef = ref(null)
const fileInputRef = ref(null)
const isFocused = ref(false)
const attachmentText = ref('')
const attachmentName = ref('')
const isMultiAgentEnabled = ref(false)
const multiAgentModels = ref({
  rag: 'deepseek-chat',
  web: 'gpt-4o-mini',
  synthesis: 'deepseek-reasoner',
})

const useDbSearch = computed({
  get: () => appStore.useDbSearch,
  set: (value) => appStore.setUseDbSearch(value),
})

const useWebSearch = computed({
  get: () => appStore.useWebSearch,
  set: (value) => appStore.setUseWebSearch(value),
})

onMounted(() => {
  autoResize()
})

const setFocusState = (value) => {
  isFocused.value = value
}

const autoResize = () => {
  const el = textareaRef.value
  if (!el) return

  requestAnimationFrame(() => {
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`
  })
}

const onInput = () => {
  autoResize()
}

const buildAgentConfigs = () => ({
  rag: { model: (multiAgentModels.value.rag || 'deepseek-chat').trim() },
  web: { model: (multiAgentModels.value.web || 'gpt-4o-mini').trim() },
  synthesis: { model: (multiAgentModels.value.synthesis || 'deepseek-reasoner').trim() },
})

const sendMessage = () => {
  const content = message.value.trim()
  if (!content || props.loading) return

  emit('send', content, {
    attachmentText: attachmentText.value,
    attachmentName: attachmentName.value,
    mode: isMultiAgentEnabled.value ? 'multi_agent' : null,
    agentConfigs: isMultiAgentEnabled.value ? buildAgentConfigs() : null,
    isMultiAgent: isMultiAgentEnabled.value,
  })

  message.value = ''
  attachmentText.value = ''
  attachmentName.value = ''
  nextTick(autoResize)
}

const addNewline = (event) => {
  event.preventDefault()
  const el = textareaRef.value
  if (!el) return

  const start = el.selectionStart
  const end = el.selectionEnd

  message.value = `${message.value.slice(0, start)}\n${message.value.slice(end)}`

  nextTick(() => {
    el.selectionStart = start + 1
    el.selectionEnd = start + 1
    autoResize()
  })
}

const setContent = (content) => {
  message.value = content || ''
  nextTick(autoResize)
}

const clearInput = () => {
  message.value = ''
  nextTick(autoResize)
}

const focus = () => {
  nextTick(() => {
    const el = textareaRef.value
    if (!el) return
    el.focus()
    const end = el.value.length
    el.setSelectionRange(end, end)
  })
}

const triggerFileSelect = () => {
  if (!fileInputRef.value || props.loading) return
  fileInputRef.value.click()
}

const onFileChange = (event) => {
  const files = event.target.files
  if (!files || !files[0]) return

  const file = files[0]
  uploadFileApi(file)
    .then((res) => {
      attachmentText.value = res.text || ''
      attachmentName.value = file.name || '附件文本'
    })
    .catch((err) => {
      setContent(`【文件读取失败】${err?.message || ''}`)
    })
    .finally(() => {
      event.target.value = ''
    })
}

const removeAttachment = () => {
  attachmentText.value = ''
  attachmentName.value = ''
}

defineExpose({
  setContent,
  clearInput,
  focus,
})
</script>

<style scoped>
.terminal-input-shell {
  position: relative;
  border: 1px solid var(--border-dim);
  background: rgba(2, 8, 22, 0.75);
  padding: 0.55rem 0.75rem 0.72rem;
  clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);
  box-shadow: inset 0 0 22px rgba(0, 229, 255, 0.05);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.terminal-input-shell--focused {
  border-color: rgba(0, 229, 255, 0.55);
  box-shadow: inset 0 0 26px rgba(0, 229, 255, 0.09), 0 0 12px rgba(0, 229, 255, 0.12);
}

.terminal-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  margin-bottom: 0.55rem;
  flex-wrap: wrap;
}

.toggle-group {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.toggle-item {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.toggle-item input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.toggle-core {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  padding: 0.22rem 0.5rem;
  border: 1px solid var(--border-dim);
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  transition: all 0.15s ease;
}

.toggle-item input:checked + .toggle-core {
  border-color: rgba(0, 229, 255, 0.55);
  color: var(--neon-cyan);
  background: rgba(0, 229, 255, 0.1);
}

.toggle-icon {
  width: 0.78rem;
  height: 0.78rem;
}

.attachment-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  border: 1px solid rgba(123, 44, 191, 0.45);
  background: rgba(123, 44, 191, 0.12);
  color: #cf9bff;
  padding: 0.2rem 0.45rem;
  font-family: var(--font-mono);
  font-size: 0.62rem;
}

.attachment-name {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip-close {
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  line-height: 1;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  padding: 0 0.15rem;
  text-transform: none;
  letter-spacing: 0;
  clip-path: none;
}

.multi-agent-config {
  margin: 0.15rem 0 0.65rem;
  border: 1px solid var(--border-dim);
  background: linear-gradient(90deg, rgba(0, 229, 255, 0.08) 0%, rgba(0, 229, 255, 0.03) 55%, rgba(0, 0, 0, 0.15) 100%);
  padding: 0.48rem 0.55rem 0.55rem;
}

.multi-agent-config__title {
  font-family: var(--font-mono);
  font-size: 0.58rem;
  letter-spacing: 0.14em;
  color: var(--neon-cyan);
  margin-bottom: 0.45rem;
  text-shadow: var(--neon-cyan-glow);
}

.multi-agent-config__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.45rem;
}

.agent-model-field {
  display: flex;
  flex-direction: column;
  gap: 0.22rem;
}

.agent-model-label {
  font-family: var(--font-mono);
  font-size: 0.56rem;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
}

.agent-model-input {
  border: 1px solid var(--border-dim);
  background: rgba(2, 8, 22, 0.66);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  padding: 0.28rem 0.4rem;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.agent-model-input:focus {
  outline: none;
  border-color: rgba(0, 229, 255, 0.55);
  box-shadow: 0 0 0 1px rgba(0, 229, 255, 0.15);
}

.input-stage {
  display: grid;
  grid-template-columns: auto auto 1fr auto;
  align-items: flex-end;
  gap: 0.55rem;
  position: relative;
}

.prompt-col {
  align-self: start;
  padding-top: 0.44rem;
}

.prompt-label {
  font-family: var(--font-mono);
  font-size: 0.73rem;
  color: var(--neon-cyan);
  letter-spacing: 0.04em;
}

.terminal-textarea {
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  line-height: 1.55;
  max-height: 220px;
  min-height: 1.45rem;
  resize: none;
  overflow-y: auto;
  clip-path: none;
  padding: 0.26rem 0;
}

.terminal-textarea::placeholder {
  color: var(--text-muted);
  font-style: normal;
}

.terminal-textarea:focus {
  outline: none;
  box-shadow: none;
  border: none;
}

.stage-btn {
  width: 2rem;
  height: 2rem;
  border: 1px solid var(--border-dim);
  background: rgba(0, 229, 255, 0.06);
  color: var(--text-secondary);
  padding: 0;
  clip-path: polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px);
}

.stage-btn:hover:not(:disabled) {
  color: var(--neon-cyan);
  border-color: rgba(0, 229, 255, 0.58);
  background: rgba(0, 229, 255, 0.16);
}

.stage-btn:disabled {
  opacity: 0.4;
}

.stage-btn--send {
  border-color: rgba(0, 229, 255, 0.45);
}

.stage-icon {
  width: 1rem;
  height: 1rem;
}

.loading-dot {
  width: 0.95rem;
  height: 0.95rem;
  border-radius: 50%;
  border: 2px solid rgba(0, 229, 255, 0.2);
  border-top-color: var(--neon-cyan);
  display: inline-block;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.wave-lane {
  margin-top: 0.6rem;
  height: 24px;
  display: flex;
  align-items: flex-end;
  gap: 2px;
  overflow: hidden;
  border-top: 1px solid rgba(0, 229, 255, 0.12);
  padding-top: 0.3rem;
}

.wave-bar {
  width: 3px;
  min-height: 4px;
  border-radius: 1px;
  transform-origin: bottom;
  background: hsla(var(--hue), 100%, 62%, 0.3);
  box-shadow: 0 0 10px hsla(var(--hue), 100%, 62%, 0.5);
  animation: waveIdle 1.5s ease-in-out infinite;
  animation-delay: var(--delay);
  will-change: transform;
}

.is-active .wave-bar {
  animation: waveActive 1.5s ease-in-out infinite;
  animation-delay: var(--delay);
  background: hsla(var(--hue), 100%, 62%, 0.8);
}

@keyframes waveIdle {
  0%, 100% { transform: scaleY(0.85); }
  50% { transform: scaleY(1.15); }
}

@keyframes waveActive {
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(4.5); }
}

@media (max-width: 900px) {
  .multi-agent-config__grid {
    grid-template-columns: 1fr;
  }

  .input-stage {
    grid-template-columns: auto 1fr auto;
  }

  .prompt-col {
    grid-column: 1 / -1;
    padding-top: 0;
  }

  .terminal-textarea {
    grid-column: 1 / 3;
  }

  .attachment-name {
    max-width: 120px;
  }
}
</style>
