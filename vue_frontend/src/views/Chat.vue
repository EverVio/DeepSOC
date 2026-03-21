<!--
  组件职责：聊天页面容器，组织消息流、输入区与会话控制。
  业务模块：对话业务页面
  主要数据流：会话状态/消息列表 -> 子组件渲染 -> 用户交互事件
-->

<template>
  <div class="terminal-shell">
    <FuiCard class="terminal-card">
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

      <NAlert v-if="error" class="terminal-alert" type="error" :show-icon="true">
        <template #icon>
          <AlertIcon class="btn-icon" />
        </template>
        {{ error }}
      </NAlert>

      <NScrollbar class="messages-viewport" :ref="messagesContainerRef">
        <div class="messages-viewport-inner">
          <div v-if="isEmptyState" class="terminal-empty">
            <div class="terminal-empty-art">
              <svg height="4em" viewBox="0 0 24 24" width="4em" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588z"
                  fill="#00E5FF"
                />
              </svg>
            </div>
            <p class="terminal-empty-text"><span class="prompt-prefix">root@DeepSOC:~$</span>&nbsp;_</p>
            <p class="terminal-empty-hint">awaiting tactical input...</p>
          </div>

          <ChatMessage
            v-for="(msg, index) in displayMessages"
            :key="msg.id"
            :is-user="msg.isUser"
            :content="msg.content"
            :attachment-name="msg.attachmentName"
            :think-process="msg.think_process"
            :duration="msg.duration"
            :timestamp="msg.timestamp"
            :message-id="msg.id"
            :is-multi-agent="msg.isMultiAgent"
            :agent-data="msg.agentData"
            :allow-regenerate="!msg.isUser && index === displayMessages.length - 1 && !loading"
            @regenerate="onRegenerate"
            @edit="onEditMessage"
          />

          <div
            v-if="loading && lastDisplayMessage && !lastDisplayMessage.isUser && !lastDisplayMessage.content && !lastDisplayMessage.think_process"
            class="terminal-loading"
          >
            <span class="loading-cursor">█</span>
            <span class="loading-text">ANALYZING...</span>
          </div>
        </div>
      </NScrollbar>

      <div class="terminal-input-zone">
        <ChatInput :ref="chatInputRef" :loading="loading" :current-session="currentSession" @send="onSendMessage" />
      </div>
    </FuiCard>
  </div>
</template>

<script setup>
import { computed, toRefs } from 'vue'
import { NAlert, NScrollbar } from 'naive-ui'
import FuiCard from '../components/FuiCard.vue'
import ChatMessage from '../components/ChatMessage.vue'
import ChatInput from '../components/ChatInput.vue'
import { AlertTriangleIcon as AlertIcon } from 'vue-tabler-icons'

const props = defineProps({
  currentSession: { type: String, default: '' },
  messages: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  onSendMessage: { type: Function, required: true },
  onRegenerate: { type: Function, required: true },
  onEditMessage: { type: Function, required: true },
  messagesContainerRef: { type: Object, default: null },
  chatInputRef: { type: Object, default: null },
})

const {
  currentSession,
  messages,
  loading,
  error,
  onSendMessage,
  onRegenerate,
  onEditMessage,
  messagesContainerRef,
  chatInputRef,
} = toRefs(props)

const hasRenderablePayload = (message) => {
  if (!message || typeof message !== 'object') return false

  const text = (message.content || '').trim()
  const thinking = (message.think_process || '').trim()
  const attachment = (message.attachmentName || '').trim()

  if (text || thinking || attachment) return true
  if (message.isUser) return true
  if (message.isMultiAgent) return true

  return false
}

const displayMessages = computed(() => (messages.value || []).filter((message) => hasRenderablePayload(message)))
const isEmptyState = computed(() => displayMessages.value.length === 0)

const lastDisplayMessage = computed(() => {
  if (displayMessages.value.length === 0) return null
  return displayMessages.value[displayMessages.value.length - 1]
})
</script>

<style scoped>
.terminal-shell {
  flex: 1;
  min-height: 0;
  height: 100%; 
  display: flex;
  flex-direction: column;
}

.terminal-card {
  flex: 1;
  min-height: 240px;
  display: flex;
  flex-direction: column;
}

.terminal-card :deep(.fui-card-body) {
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0.45rem 0.6rem 0.6rem;
}

.terminal-header-left,
.terminal-header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.terminal-header-left {
  min-width: 0;
}

.terminal-title {
  font-family: var(--font-display);
  font-size: 0.76rem;
  color: var(--neon-cyan);
  letter-spacing: 0.09em;
  text-shadow: var(--neon-cyan-glow);
}

.terminal-header-right {
  margin-left: auto;
  gap: 0.75rem;
  font-family: var(--font-mono);
}

.terminal-meta {
  font-size: 0.85rem; 
  font-weight: 600;  
  color: #a1c8db;   
  letter-spacing: 0.05em; 
  text-transform: uppercase;
  white-space: nowrap;
}

.status-dot-inline {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--neon-green);
  box-shadow: var(--neon-green-glow);
}

.btn-icon {
  width: 14px;
  height: 14px;
  display: block;
  flex-shrink: 0;
  color: currentColor;
}

.terminal-alert {
  margin-bottom: 0.58rem;
}

.terminal-alert :deep(.n-alert-body__content) {
  font-family: var(--font-mono);
  font-size: 0.66rem;
}

.messages-viewport {
  flex: 1;
  min-height: 0;
}

.messages-viewport :deep(.n-scrollbar-container) {
  padding: 0.35rem 0.2rem 0.35rem 0;
}

.messages-viewport-inner {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding: 1.5rem 2rem 1rem 1rem;
}

.terminal-empty {
  min-height: 450px;
  display: grid;
  place-items: center;
  text-align: center;
  border: 1px dashed rgba(0, 229, 255, 0.22);
  background: radial-gradient(circle at center, rgba(0, 229, 255, 0.04), transparent 65%);
}

.terminal-empty-art {
  opacity: 0.82;
}

.terminal-empty-text {
  margin-top: -0.4rem;
  font-family: var(--font-mono);
  color: #b2d9ec;
}

.prompt-prefix {
  color: var(--neon-green);
}

.terminal-empty-hint {
  margin-top: 0.2rem;
  font-size: 0.62rem;
  font-family: var(--font-mono);
  letter-spacing: 0.1em;
  color: #6f95a9;
}

.terminal-loading {
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--neon-cyan);
  font-family: var(--font-mono);
  font-size: 0.66rem;
  padding: 0 0.4rem;
}

.loading-cursor {
  animation: blink 0.95s step-start infinite;
}

.loading-text {
  letter-spacing: 0.11em;
}

@keyframes blink {
  50% {
    opacity: 0.2;
  }
}

.terminal-input-zone {
  flex-shrink: 0;
  margin-top: 0.5rem;
  border-top: 1px solid rgba(0, 229, 255, 0.16);
  padding-top: 0.56rem;
}
</style>

