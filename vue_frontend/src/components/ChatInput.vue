<template>
  <NCard 
    class="terminal-input-shell" 
    :class="{ 'terminal-input-shell--focused': isFocused, 'terminal-input-shell--has-text': draftMessage.length > 0 }" 
    :bordered="false"
    embedded
  >
    <div class="expandable-wrapper toggle-wrapper">
      <div class="expandable-inner">
        <div class="terminal-controls">
          <NForm inline label-placement="left" :show-feedback="false" class="toggle-form">
            <NFormItem class="toggle-item" label="">
              <NSwitch v-model:value="useDbSearch" size="small" />
              <span class="toggle-core">
                <DatabaseIcon class="toggle-icon" /> DB SEARCH
              </span>
            </NFormItem>

            <NFormItem class="toggle-item" label="">
              <NSwitch v-model:value="useWebSearch" size="small" />
              <span class="toggle-core">
                <WorldIcon class="toggle-icon" /> WEB SEARCH
              </span>
            </NFormItem>

            <NFormItem class="toggle-item" label="">
              <NSwitch v-model:value="isMultiAgentEnabled" size="small" />
              <span class="toggle-core">
                <BoltIcon class="toggle-icon" /> MULTI AGENT
              </span>
            </NFormItem>
          </NForm>
        </div>
      </div>
    </div>

    <div v-if="attachmentText" class="attachment-bar">
      <PaperclipIcon class="attachment-icon" />
      <span class="attachment-name">{{ attachmentName }}</span>
      <NButton class="attachment-close" text :disabled="loading" aria-label="移除附件" @click="removeAttachment">
        <XIcon class="close-icon-svg" />
      </NButton>
    </div>

    <div v-if="isEditing" class="edit-hint-bar">
      <span class="edit-hint-text">ACTIVE OVERRIDE: 正在编辑上行指令</span>
      <NButton class="edit-hint-cancel" text type="primary" size="small" :disabled="loading" @click="cancelEdit">
        ABORT
      </NButton>
    </div>

    <div class="expandable-wrapper multi-agent-wrapper" :class="{ 'is-active': isMultiAgentEnabled }">
      <div class="expandable-inner">
        <NForm label-placement="top" :show-feedback="false" class="multi-agent-config">
          <div class="multi-agent-header">
            <div class="multi-agent-title">MODEL MATRIX</div>
            <div class="multi-agent-provider">PROVIDER: {{ normalizedProvider.toUpperCase() }}</div>
          </div>
          <NGrid class="multi-agent-grid" cols="1 s:1 m:3" :x-gap="12" :y-gap="8" responsive="screen">
            <NGi>
              <NFormItem label="RAG ENGINE" class="agent-field">
                <NSelect v-model:value="multiAgentModels.rag" :options="modelSelectOptions" :disabled="loading" />
              </NFormItem>
            </NGi>
            <NGi>
              <NFormItem label="WEB ENGINE" class="agent-field">
                <NSelect v-model:value="multiAgentModels.web" :options="modelSelectOptions" :disabled="loading" />
              </NFormItem>
            </NGi>
            <NGi>
              <NFormItem label="SYNTHESIS ENGINE" class="agent-field">
                <NSelect v-model:value="multiAgentModels.synthesis" :options="modelSelectOptions" :disabled="loading" />
              </NFormItem>
            </NGi>
          </NGrid>
        </NForm>
      </div>
    </div>

    <div class="input-stage">
      <input ref="fileInputRef" type="file" accept=".txt,.md,.log,.json,.jsonl,.xml,.yaml,.yml,.ini,.conf,.docx,.xlsx,.csv" style="display: none" @change="onFileChange" />

      <NButton class="action-btn attach-btn" quaternary circle @click="triggerFileSelect" :disabled="loading" title="上传文件">
        <PaperclipIcon class="action-icon" />
      </NButton>

      <div class="prompt-col">
        <span class="prompt-label">root@DeepSOC<span class="prompt-cursor">:~$</span></span>
      </div>

      <NInput 
        ref="textareaRef" 
        v-model:value="draftMessage" 
        class="terminal-textarea" 
        type="textarea"
        :autosize="{ minRows: 1, maxRows: 8 }" 
        placeholder="       输入诊断命令、日志片段或排障请求..."
        @keydown.enter.exact.prevent="sendMessage" 
        @focus="setFocusState(true)" 
        @blur="setFocusState(false)" 
      />

      <NButton
        class="action-btn send-btn"
        :class="{ 'send-btn--stop': streaming, 'send-btn--active': !sendButtonDisabled }"
        quaternary
        circle
        @click="onSendOrStopClick"
        :disabled="sendButtonDisabled && !streaming"
        :aria-label="streaming ? '中断信号' : '发送指令'"
      >
        <span v-if="streaming" class="stop-indicator" aria-hidden="true">
          <span class="stop-bar" />
          <span class="stop-bar" />
        </span>
        <SendIcon v-else class="action-icon send-icon" />
      </NButton>
    </div>

    <div class="energy-line" aria-hidden="true">
      <div class="energy-glow" :class="{ 'energy-glow--active': isFocused || draftMessage.length > 0 }"></div>
    </div>
  </NCard>
</template>

<script setup>
import { computed, defineEmits, defineExpose, defineProps, nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
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
import { BoltIcon, DatabaseIcon, PaperclipIcon, SendIcon, WorldIcon, XIcon } from 'vue-tabler-icons'
import { uploadFile as uploadFileApi } from '../api'

const props = defineProps({
  loading: { type: Boolean, default: false },
  streaming: { type: Boolean, default: false },
  currentSession: { type: String, default: '' },
})

const emit = defineEmits(['send', 'stop'])

const appStore = useAppStore()
const chatStore = useChatStore()
const { isEditing } = storeToRefs(appStore)

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

const normalizedProvider = computed(() => (appStore.llmProvider || 'siliconflow').trim().toLowerCase())

const providerModelOptions = computed(() => {
  const options = PROVIDER_MODEL_CANDIDATES[normalizedProvider.value]
  if (Array.isArray(options) && options.length > 0) return options
  return [appStore.llmModel || 'DeepSeek-V3.2']
})

const modelSelectOptions = computed(() => providerModelOptions.value.map((model) => ({ label: model, value: model })))

const resolvePreferredModel = () => {
  const preferred = (appStore.llmModel || '').trim()
  if (preferred && providerModelOptions.value.includes(preferred)) return preferred
  return providerModelOptions.value[0] || 'DeepSeek-V3.2'
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
  get: () => chatStore.draftInputs?.[resolvedSessionId.value] || '',
  set: (value) => chatStore.setSessionDraft(resolvedSessionId.value, value || ''),
})

const setFocusState = (value) => {
  isFocused.value = value
}

const cancelEdit = () => {
  appStore.clearEditing()
  clearInput()
}

const buildAgentConfigs = () => {
  const provider = normalizedProvider.value
  const providerApiKey = (appStore.providerApiKey || '').trim()
  const fallbackModel = resolvePreferredModel()

  const buildConfig = (modelValue) => {
    const model = (modelValue || fallbackModel).trim() || fallbackModel
    return { provider, model, provider_api_key: providerApiKey || undefined }
  }

  return {
    rag: buildConfig(multiAgentModels.value.rag),
    web: buildConfig(multiAgentModels.value.web),
    synthesis: buildConfig(multiAgentModels.value.synthesis),
  }
}

const sendButtonDisabled = computed(() => !props.streaming && !draftMessage.value.trim() && !attachmentText.value)

const onSendOrStopClick = () => {
  if (props.streaming) {
    emit('stop')
    return
  }
  sendMessage()
}

const sendMessage = () => {
  const content = draftMessage.value.trim()
  if ((!content && !attachmentText.value) || props.streaming) return

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

const getContent = () => draftMessage.value

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
      if (res && res.text) {
        attachmentText.value = res.text
        attachmentName.value = file.name || 'DATA_STREAM_ATTACHED'
      } else {
        setContent(`[SYS_ERR] 数据流解析异常或为空`)
      }
    })
    .then(() => {
      event.target.value = ''
    })
}

const removeAttachment = () => {
  attachmentText.value = ''
  attachmentName.value = ''
}

defineExpose({ setContent, clearInput, getContent, submit: sendMessage, focus })
</script>

<style scoped>
/* ==========================================================================
   架构级视觉重构：亚克力质感与微交互
   ========================================================================== */

.terminal-input-shell {
  position: relative;
  background: rgba(4, 8, 16, 0.65);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.04);
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
  padding: 0.6rem 1.2rem 0.8rem;
  box-shadow: 0 16px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: visible;
}

.terminal-input-shell::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(135deg, rgba(0, 229, 255, 0.2), rgba(255, 255, 255, 0.02) 50%, rgba(0, 229, 255, 0.05));
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  opacity: 0.5;
  transition: opacity 0.4s ease;
}

.terminal-input-shell--focused::before,
.terminal-input-shell--has-text::before {
  opacity: 1;
  background: linear-gradient(135deg, rgba(0, 229, 255, 0.5), rgba(255, 255, 255, 0.05) 50%, rgba(0, 229, 255, 0.15));
}

.terminal-input-shell :deep(.n-card__content) {
  padding: 0;
}

/* --- 高级平滑展开动画 (CSS Grid Hack) --- */
.expandable-wrapper {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.42s ease;
  opacity: 0;
}

.expandable-inner {
  overflow: hidden;
}

/* 仅在悬停时展开控制栏与多智能体面板 */
.terminal-input-shell:hover .toggle-wrapper,
.terminal-input-shell:hover .multi-agent-wrapper.is-active {
  grid-template-rows: 1fr;
  opacity: 1;
}

/* --- 顶部控制栏重构 --- */
.terminal-controls {
  padding-bottom: 0.8rem;
}

.toggle-form {
  display: flex;
  gap: 0.8rem;
}

.toggle-item {
  display: inline-flex;
  align-items: center;
}

.toggle-item :deep(.n-form-item-blank) {
  display: flex;
  align-items: center;
}

.toggle-core {
  display: inline-flex;
  align-items: center;
  margin-left: 0.5rem;
  gap: 0.3rem;
  padding: 0.2rem 0.6rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
  font-family: var(--font-ui);
  font-size: 0.65rem;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  transition: all 0.3s ease;
}

.toggle-item :deep(.n-switch.n-switch--active) + .toggle-core {
  border-color: rgba(0, 229, 255, 0.3);
  color: #fff;
  background: rgba(0, 229, 255, 0.1);
  box-shadow: 0 0 12px rgba(0, 229, 255, 0.1);
}

.toggle-icon {
  width: 0.85rem;
  height: 0.85rem;
}

/* --- 多智能体面板质感提升 --- */
.multi-agent-config {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 6px;
  padding: 0.8rem 1rem; 
  margin-bottom: 0.8rem;
}

.multi-agent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.8rem;
}

.multi-agent-title {
  font-family: var(--font-ui);
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  color: var(--neon-cyan);
}

.multi-agent-provider {
  font-family: var(--font-ui);
  font-size: 0.6rem;
  color: var(--text-secondary);
  letter-spacing: 0.08em;
}

.agent-field :deep(.n-form-item-label__text) {
  font-size: 0.6rem;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
}

.agent-field :deep(.n-base-selection) {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  transition: all 0.2s ease;
}

.agent-field :deep(.n-base-selection:hover) {
  border-color: rgba(0, 229, 255, 0.4);
}

/* --- 附件栏 & 编辑提示栏 --- */
.attachment-bar, .edit-hint-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  margin-bottom: 0.6rem;
  font-family: var(--font-ui);
  font-size: 0.75rem;
}

.attachment-bar {
  background: rgba(123, 44, 191, 0.1);
  border: 1px solid rgba(123, 44, 191, 0.3);
  color: #e2c2ff;
}

.edit-hint-bar {
  background: rgba(0, 229, 255, 0.05);
  border: 1px solid rgba(0, 229, 255, 0.2);
  color: #a1ebff;
  justify-content: space-between;
}

.attachment-icon { width: 1rem; height: 1rem; }
.attachment-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.close-icon-svg { width: 1rem; height: 1rem; opacity: 0.7; transition: opacity 0.2s; }
.close-icon-svg:hover { opacity: 1; }

/* --- 核心输入区 --- */
.input-stage {
  display: grid;
  grid-template-columns: auto auto 1fr auto;
  align-items: flex-end;
  gap: 0.8rem;
  position: relative;
  z-index: 2;
}

.prompt-col {
  padding-bottom: 0.45rem;
  user-select: none;
}

.prompt-label {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: rgba(123, 167, 188, 0.7); 
  letter-spacing: 0.02em;
}

.prompt-cursor {
  color: var(--neon-cyan);
}

.terminal-textarea {
  margin: 0;
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
  color: #F8FAFC;
  font-family: var(--font-ui);
  font-size: 0.95rem;
  line-height: 1.6;
  resize: none;
  padding: 0.4rem 0 0.3rem 1.2rem; 
  caret-color: var(--neon-cyan);
}

.terminal-textarea :deep(.n-input__textarea-el::placeholder) {
  color: rgba(255, 255, 255, 0.15);
  font-weight: 300;
}

.action-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-secondary);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  backdrop-filter: blur(8px);
}

.action-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
  color: #fff;
  transform: translateY(-2px);
}

.action-icon {
  width: 1.1rem;
  height: 1.1rem;
}

/* 与发送按钮同步交互视觉的附件按钮 */
.attach-btn:hover:not(:disabled) {
  background: transparent !important; 
  border-color: rgba(0, 229, 255, 0.4);
  border-width: 1.5px;
  box-shadow: none;
  color: #fff;
  transform: translateY(-2px);
}

.send-btn--active {
  background: transparent !important; 
  border-color: rgba(0, 229, 255, 0.3);
  border-width: 1.5px;
  box-shadow: none;
  color: var(--neon-cyan);
  box-shadow: 0 4px 12px rgba(0, 229, 255, 0.1);
}

.send-btn--active:hover:not(:disabled) {
  background: linear-gradient(135deg, rgba(0, 229, 255, 0.25), rgba(0, 136, 255, 0.1));
  border-color: var(--neon-cyan);
  box-shadow: 0 6px 20px rgba(0, 229, 255, 0.2), inset 0 0 8px rgba(255, 255, 255, 0.1);
  color: #fff;
}

.send-btn--stop {
  background: rgba(255, 0, 85, 0.1);
  border-color: rgba(255, 0, 85, 0.3);
  color: #ff4d6d;
}

.send-btn--stop:hover:not(:disabled) {
  background: rgba(255, 0, 85, 0.2);
  border-color: rgba(255, 0, 85, 0.6);
  color: #fff;
  box-shadow: 0 0 15px rgba(255, 0, 85, 0.3);
}

.stop-indicator {
  display: flex;
  gap: 3px;
  align-items: center;
  justify-content: center;
}

.stop-bar {
  width: 4px;
  height: 12px;
  background-color: currentColor;
  border-radius: 1px;
}

/* --- 极简能量条 --- */
.energy-line {
  position: absolute;
  bottom: 0;
  left: 1.2rem;
  right: 1.2rem;
  height: 1px;
  background: rgba(255, 255, 255, 0.04);
  overflow: hidden;
}

.energy-glow {
  width: 30%;
  height: 100%;
  background: linear-gradient(90deg, transparent, var(--neon-cyan), transparent);
  opacity: 0;
  transform: translateX(-100%);
  transition: opacity 0.4s ease;
}

.energy-glow--active {
  opacity: 0.8;
  animation: energy-scan 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

@keyframes energy-scan {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(300%); }
}

@media (max-width: 900px) {
  .input-stage {
    grid-template-columns: auto 1fr auto;
    gap: 0.6rem;
  }
  .prompt-col {
    grid-column: 1 / -1;
    padding-bottom: 0;
  }
  .terminal-textarea {
    grid-column: 1 / 3;
  }
}
</style>