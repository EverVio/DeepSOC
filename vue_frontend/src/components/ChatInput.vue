<template>
  <NCard class="terminal-input-shell" :class="{ 'terminal-input-shell--focused': isFocused }" :bordered="false" embedded>
    <div class="terminal-controls">
      <NForm inline label-placement="left" :show-feedback="false" class="toggle-form">
        <NFormItem class="toggle-item" label="">
          <NSwitch v-model:value="useDbSearch" size="small" />
          <span class="toggle-core"><DatabaseIcon class="toggle-icon" /> DB SEARCH</span>
        </NFormItem>

        <NFormItem class="toggle-item" label="">
          <NSwitch v-model:value="useWebSearch" size="small" />
          <span class="toggle-core"><WorldIcon class="toggle-icon" /> WEB SEARCH</span>
        </NFormItem>

        <NFormItem class="toggle-item" label="">
          <NSwitch v-model:value="isMultiAgentEnabled" size="small" />
          <span class="toggle-core"><BoltIcon class="toggle-icon" /> MULTI AGENT</span>
        </NFormItem>
      </NForm>

      <div v-if="attachmentText" class="attachment-chip" title="附件将随本次消息发送">
        <PaperclipIcon class="toggle-icon" />
        <span class="attachment-name">{{ attachmentName }}</span>
        <NButton class="chip-close" text :disabled="loading" aria-label="移除附件" @click="removeAttachment">x</NButton>
      </div>
    </div>

    <NForm v-if="isMultiAgentEnabled" label-placement="top" :show-feedback="false" class="multi-agent-config">
      <div class="multi-agent-config__title">TACTICAL MODEL MATRIX</div>
      <div class="multi-agent-provider">PROVIDER: {{ normalizedProvider.toUpperCase() }}</div>
      <NGrid class="multi-agent-config__grid" cols="1 s:1 m:3" :x-gap="8" :y-gap="8" responsive="screen">
        <NGi>
          <NFormItem label="RAG MODEL" class="agent-model-field">
            <NSelect v-model:value="multiAgentModels.rag" :options="modelSelectOptions" :disabled="loading" />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="WEB MODEL" class="agent-model-field">
            <NSelect v-model:value="multiAgentModels.web" :options="modelSelectOptions" :disabled="loading" />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="SYNTHESIS MODEL" class="agent-model-field">
            <NSelect v-model:value="multiAgentModels.synthesis" :options="modelSelectOptions" :disabled="loading" />
          </NFormItem>
        </NGi>
      </NGrid>
    </NForm>

    <div class="input-stage">
      <input
        ref="fileInputRef"
        type="file"
        accept=".txt,.docx,.xlsx"
        style="display: none"
        @change="onFileChange"
      />

      <NButton class="stage-btn" quaternary circle @click="triggerFileSelect" :disabled="loading" title="上传文件">
        <PaperclipIcon class="stage-icon" />
      </NButton>

      <div class="prompt-col">
        <span class="prompt-label">root@DeepSOC:~$</span>
      </div>

      <NInput
        ref="textareaRef"
        v-model:value="draftMessage"
        class="terminal-textarea"
        type="textarea"
        :autosize="{ minRows: 1, maxRows: 8 }"
        placeholder="输入诊断命令、日志片段或排障请求..."
        :disabled="loading"
        @keydown.enter.exact.prevent="sendMessage"
        @focus="setFocusState(true)"
        @blur="setFocusState(false)"
      />

      <NButton
        class="stage-btn stage-btn--send"
        quaternary
        circle
        @click="sendMessage"
        :disabled="!draftMessage.trim() || loading"
        title="发送"
      >
        <span v-if="loading" class="loading-dot"></span>
        <SendIcon v-else class="stage-icon" />
      </NButton>
    </div>

    <div class="wave-lane" aria-hidden="true" :class="{ 'is-active': isFocused || draftMessage.length > 0 }">
      <span
        v-for="index in 32"
        :key="`wave-${index}`"
        class="wave-bar"
        :style="`--delay: ${index * 20}ms; --hue: ${185 + (index % 7)}`"
      ></span>
    </div>
  </NCard>
</template>

<script setup>
import { computed, defineEmits, defineExpose, defineProps, nextTick, ref, watch } from 'vue'
import {
  NButton,
  NCard,
  NForm,
  NFormItem,
  NGi,
  NGrid,
  NInput,
  NSelect,
  NSwitch,
} from 'naive-ui'
import { useAppStore } from '../stores/appStore'
import { useChatStore } from '../stores/chatStore'
import { BoltIcon, DatabaseIcon, PaperclipIcon, SendIcon, WorldIcon } from 'vue-tabler-icons'
import { uploadFile as uploadFileApi } from '../api'

const props = defineProps({
  loading: {
    type: Boolean,
    default: false,
  },
  currentSession: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['send'])

const appStore = useAppStore()
const chatStore = useChatStore()

const PROVIDER_MODEL_CANDIDATES = {
  ollama: ['DeepSeek-R1:7b', 'Qwen3:8b', 'Llama3:8b'],
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  minimax: ['MiniMax-M2.5'],
  siliconflow: ['DeepSeek-V3.2', 'DeepSeek-R1', 'Qwen2.5-72B'],
}

const textareaRef = ref(null)
const fileInputRef = ref(null)
const isFocused = ref(false)
const attachmentText = ref('')
const attachmentName = ref('')
const isMultiAgentEnabled = ref(false)

const normalizedProvider = computed(() => (appStore.llmProvider || 'ollama').trim().toLowerCase())

const providerModelOptions = computed(() => {
  const options = PROVIDER_MODEL_CANDIDATES[normalizedProvider.value]
  if (Array.isArray(options) && options.length > 0) {
    return options
  }
  return [appStore.llmModel || 'DeepSeek-R1:7b']
})

const modelSelectOptions = computed(() => providerModelOptions.value.map((model) => ({ label: model, value: model })))

const resolvePreferredModel = () => {
  const preferred = (appStore.llmModel || '').trim()
  if (preferred && providerModelOptions.value.includes(preferred)) {
    return preferred
  }
  return providerModelOptions.value[0] || 'DeepSeek-R1:7b'
}

const multiAgentModels = ref({
  rag: resolvePreferredModel(),
  web: resolvePreferredModel(),
  synthesis: resolvePreferredModel(),
})

watch(
  [normalizedProvider, () => appStore.llmModel],
  () => {
    const fallback = resolvePreferredModel()
    for (const key of ['rag', 'web', 'synthesis']) {
      const current = (multiAgentModels.value[key] || '').trim()
      if (!current || !providerModelOptions.value.includes(current)) {
        multiAgentModels.value[key] = fallback
      }
    }
  },
  { immediate: true }
)

const useDbSearch = computed({
  get: () => appStore.useDbSearch,
  set: (value) => appStore.setUseDbSearch(value),
})

const useWebSearch = computed({
  get: () => appStore.useWebSearch,
  set: (value) => appStore.setUseWebSearch(value),
})

const resolvedSessionId = computed(() => {
  const candidate = (props.currentSession || chatStore.currentSession || '').trim()
  return candidate || '默认对话'
})

const draftMessage = computed({
  get: () => {
    return chatStore.draftInputs?.[resolvedSessionId.value] || ''
  },
  set: (value) => {
    chatStore.setSessionDraft(resolvedSessionId.value, value || '')
  },
})

const setFocusState = (value) => {
  isFocused.value = value
}

const buildAgentConfigs = () => {
  const provider = normalizedProvider.value
  const providerApiKey = (appStore.providerApiKey || '').trim()
  const fallbackModel = resolvePreferredModel()

  const buildConfig = (modelValue) => {
    const model = (modelValue || fallbackModel).trim() || fallbackModel
    return {
      provider,
      model,
      provider_api_key: providerApiKey || undefined,
    }
  }

  return {
    rag: buildConfig(multiAgentModels.value.rag),
    web: buildConfig(multiAgentModels.value.web),
    synthesis: buildConfig(multiAgentModels.value.synthesis),
  }
}

const sendMessage = () => {
  const content = draftMessage.value.trim()
  if (!content || props.loading) return

  emit('send', content, {
    attachmentText: attachmentText.value,
    attachmentName: attachmentName.value,
    mode: isMultiAgentEnabled.value ? 'multi_agent' : null,
    agentConfigs: isMultiAgentEnabled.value ? buildAgentConfigs() : null,
    isMultiAgent: isMultiAgentEnabled.value,
  })

  chatStore.clearSessionDraft(resolvedSessionId.value)
  attachmentText.value = ''
  attachmentName.value = ''
}

const setContent = (content) => {
  draftMessage.value = content || ''
}

const clearInput = () => {
  chatStore.clearSessionDraft(resolvedSessionId.value)
}

const focus = () => {
  nextTick(() => {
    if (textareaRef.value && typeof textareaRef.value.focus === 'function') {
      textareaRef.value.focus()
    }
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

.terminal-input-shell :deep(.n-card__content) {
  padding: 0;
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

.toggle-form {
  display: inline-flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.toggle-form :deep(.n-form-item) {
  margin-bottom: 0;
}

.toggle-item {
  display: inline-flex;
  align-items: center;
}

.toggle-core {
  display: inline-flex;
  align-items: center;
  margin-left: 0.75rem;
  gap: 0.28rem;
  padding: 0.22rem 0.5rem;
  border: 1px solid var(--border-dim);
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.toggle-item :deep(.n-switch) {
  --n-rail-color: rgba(0, 229, 255, 0.12);
  --n-rail-color-active: rgba(0, 229, 255, 0.36);
}

.toggle-item :deep(.n-switch.n-switch--active) + .toggle-core {
  border-color: rgba(0, 229, 255, 0.55);
  color: var(--neon-cyan);
  background: rgba(0, 229, 255, 0.1);
}

.toggle-icon {
  width: 0.78rem;
  height: 0.78rem;
}

.multi-agent-provider {
  font-family: var(--font-mono);
  font-size: 0.58rem;
  color: #7ba7bc;
  letter-spacing: 0.08em;
  margin-bottom: 0.45rem;
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
  min-width: 0;
  height: auto;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  padding: 0;
  color: inherit;
}

.multi-agent-config {
  margin: 0.15rem 0 0.65rem;
  border: 1px solid var(--border-dim);
  background: linear-gradient(90deg, rgba(0, 229, 255, 0.08) 0%, rgba(0, 229, 255, 0.03) 55%, rgba(0, 0, 0, 0.15) 100%);
  padding: 0.48rem 0.55rem 0.55rem;
}

.multi-agent-config :deep(.n-form-item-label__text) {
  font-family: var(--font-mono);
  font-size: 0.56rem;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
}

.multi-agent-config :deep(.n-base-selection) {
  background: rgba(2, 8, 22, 0.85);
  border: 1px solid var(--border-dim);
}

.multi-agent-config__title {
  font-family: var(--font-mono);
  font-size: 0.58rem;
  letter-spacing: 0.14em;
  color: var(--neon-cyan);
  margin-bottom: 0.45rem;
  text-shadow: var(--neon-cyan-glow);
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
  min-height: 1.45rem;
}

.terminal-textarea :deep(.n-input-wrapper) {
  background: transparent;
  box-shadow: none;
  border: none;
  padding: 0;
}

.terminal-textarea :deep(.n-input__textarea-el) {
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  line-height: 1.55;
  resize: none;
  clip-path: none;
  padding: 0.26rem 0;
}

.terminal-textarea :deep(.n-input__textarea-el::placeholder) {
  color: var(--text-muted);
}

.stage-btn {
  width: 2rem;
  height: 2rem;
  padding: 0;
  --n-border: 1px solid var(--border-dim);
  --n-color: rgba(0, 229, 255, 0.06);
  --n-color-hover: rgba(0, 229, 255, 0.16);
  --n-color-pressed: rgba(0, 229, 255, 0.22);
  --n-text-color: var(--text-secondary);
  --n-text-color-hover: var(--neon-cyan);
  --n-text-color-pressed: var(--neon-cyan);
}

.stage-btn--send {
  --n-border: 1px solid rgba(0, 229, 255, 0.45);
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
  to {
    transform: rotate(360deg);
  }
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
  0%,
  100% {
    transform: scaleY(0.85);
  }
  50% {
    transform: scaleY(1.15);
  }
}

@keyframes waveActive {
  0%,
  100% {
    transform: scaleY(1);
  }
  50% {
    transform: scaleY(4.5);
  }
}

@media (max-width: 900px) {
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
