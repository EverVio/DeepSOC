<template>
  <div class="terminal-shell">
    <FuiCard class="terminal-card">
      <template #header>
        <div class="terminal-header-left">
          <span class="status-dot-inline" />
          <span class="terminal-title">分析终端</span>
        </div>
        <div class="terminal-header-right">
          <span class="terminal-meta terminal-meta--session" :title="currentSession">{{ currentSession }}</span>
          <span class="terminal-meta terminal-meta--tagline">SOC 智能研判 · 日志与多智能体协同</span>
        </div>
      </template>

      <NAlert v-if="error" class="terminal-alert" type="error" :show-icon="true">
        <template #icon>
          <AlertIcon class="btn-icon" />
        </template>
        {{ error }}
      </NAlert>

      <NCard v-if="analysisJumpEntry" class="analysis-jump-card" :bordered="false" embedded>
        <template #header>
          <div class="analysis-jump-card__header">
            <span class="analysis-jump-card__title">{{ '分析模板' }}</span>
          </div>
        </template>

        <template #header-extra>
          <NButton class="analysis-jump-card__close-btn" quaternary circle aria-label="关闭分析入口框"
            @click="onDismissAnalysisJump?.()">
            <XIcon class="analysis-jump-card__close-icon" />
          </NButton>
        </template>

        <div class="analysis-jump-card__summary-list">
          <div v-for="item in analysisJumpEntry.summaryCards" :key="`${item.label}-${item.value}`"
            class="analysis-jump-card__summary-item"
            :class="{ 'analysis-jump-card__summary-item--wide': item.label === '看板摘要' }">
            <span class="analysis-jump-card__summary-label">{{ item.label }}</span>
            <span class="analysis-jump-card__summary-value">{{ item.value }}</span>
          </div>
        </div>

        <div class="analysis-jump-card__prompt">
          <div class="analysis-jump-card__prompt-label">拟定问题</div>
          <div class="analysis-jump-card__prompt-text">{{ analysisJumpEntry.prompt }}</div>
        </div>

        <div v-if="analysisJumpEntry.followUps?.length" class="analysis-jump-card__followups">
          <div class="analysis-jump-card__followups-label">建议追问</div>
          <div class="analysis-jump-card__followups-list">
            <span v-for="item in analysisJumpEntry.followUps" :key="item" class="analysis-jump-card__followup-item">{{
              item
            }}</span>
          </div>
        </div>

        <div class="analysis-jump-card__actions">
          <NButton class="analysis-jump-card__button" tertiary @click="onApplyAnalysisJump?.(analysisJumpEntry)">
            填入输入框编辑
          </NButton>
          <NButton class="analysis-jump-card__button" secondary @click="onSendAnalysisJump?.(analysisJumpEntry)">
            直接发送
          </NButton>
          <NButton class="analysis-jump-card__button" quaternary @click="onDismissAnalysisJump?.()">关闭提示</NButton>
        </div>
      </NCard>

      <div v-if="analysisHistoryVisible && analysisJumpHistory?.length" class="analysis-history-strip">
        <div class="analysis-history-strip__header">
          <div class="analysis-history-strip__label">最近分析入口</div>
          <NButton class="analysis-history-strip__close-btn" quaternary circle aria-label="关闭最近分析入口"
            @click="onDismissAnalysisJumpHistory?.()">
            <XIcon class="analysis-history-strip__close-icon" />
          </NButton>
        </div>
        <div class="analysis-history-strip__items">
          <button v-for="item in analysisJumpHistory" :key="item.id" type="button" class="analysis-history-strip__item"
            @click="onReuseAnalysisJump?.(item)">
            <span class="analysis-history-strip__source">{{ item.sourceLabel }}</span>
            <span class="analysis-history-strip__focus">{{ item.focusLabel }}</span>
          </button>
        </div>
      </div>

      <div class="messages-container">
        <NScrollbar :ref="setMessagesViewportRef" class="messages-viewport" :on-scroll="handleScroll">
          <div class="messages-viewport-inner">
            <NAlert v-if="entryHint" class="terminal-entry-hint" type="info" :show-icon="true">
              {{ entryHint }}
            </NAlert>
            <div v-if="isEmptyState" class="terminal-empty">
              <div class="terminal-empty-inner">
                <img class="terminal-empty-logo animate-item delay-1" :src="deepsocEmptyLogo" alt="DeepSOC" />
                <div class="terminal-empty-brand animate-item delay-2">
                  <p class="terminal-empty-brand__line">智能安全运营系统</p>
                </div>
                <p class="terminal-empty-hint animate-item delay-3">有什么我能帮您的吗？</p>
              </div>
            </div>

            <ChatMessage v-for="(msg, index) in displayMessages" :key="msg.id" :is-user="msg.isUser"
              :content="msg.content" :attachment-name="msg.attachmentName" :think-process="msg.think_process"
              :duration="msg.duration" :timestamp="msg.timestamp" :message-id="msg.id" :is-multi-agent="msg.isMultiAgent"
              :agent-data="msg.agentData" :busy="Boolean(loading || streaming)"
              :allow-regenerate="!msg.isUser && index === displayMessages.length - 1 && !loading"
              :can-edit="Boolean(msg.isUser && msg.id === lastEditableUserMessageId)" @regenerate="onRegenerate"
              @edit="onEditMessage" />

            <div
              v-if="loading && lastDisplayMessage && !lastDisplayMessage.isUser && !lastDisplayMessage.content && !lastDisplayMessage.think_process"
              class="terminal-loading">
              <span class="loading-cursor">█</span>
              <span class="loading-text">ANALYZING...</span>
            </div>
          </div>
        </NScrollbar>

        <Transition name="fade-up">
          <button
            v-if="!isNearBottom"
            class="scroll-to-bottom-btn"
            @click="forceScrollToBottom"
            title="回到底部"
          >
            <ArrowDownIcon class="scroll-to-bottom-btn__icon" />
          </button>
        </Transition>
      </div>

      <div class="terminal-input-zone">
        <ChatInput :ref="chatInputRef" :loading="loading" :streaming="streaming" :current-session="currentSession"
          @send="onSendMessage" @stop="onStopGenerating" />
      </div>
    </FuiCard>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, toRefs, watch } from 'vue'
import { NAlert, NButton, NCard, NScrollbar } from 'naive-ui'
import FuiCard from '../components/FuiCard.vue'
import ChatMessage from '../components/ChatMessage.vue'
import ChatInput from '../components/ChatInput.vue'
import { AlertTriangleIcon as AlertIcon, XIcon, ArrowDownIcon } from 'vue-tabler-icons'
import deepsocEmptyLogo from '../assets/logo/logo.png'

const props = defineProps({
  currentSession: { type: String, default: '' },
  messages: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  streaming: { type: Boolean, default: false },
  error: { type: String, default: '' },
  entryHint: { type: String, default: '' },
  analysisJumpEntry: { type: Object, default: null },
  analysisJumpHistory: { type: Array, default: () => [] },
  analysisHistoryVisible: { type: Boolean, default: false },
  onSendMessage: { type: Function, required: true },
  onRegenerate: { type: Function, required: true },
  onEditMessage: { type: Function, required: true },
  onApplyAnalysisJump: { type: Function, default: null },
  onSendAnalysisJump: { type: Function, default: null },
  onDismissAnalysisJump: { type: Function, default: null },
  onDismissAnalysisJumpHistory: { type: Function, default: null },
  onReuseAnalysisJump: { type: Function, default: null },
  onStopGenerating: { type: Function, required: true },
  messagesContainerRef: { type: Object, default: null },
  chatInputRef: { type: Object, default: null },
})

const {
  currentSession,
  messages,
  loading,
  streaming,
  error,
  onSendMessage,
  entryHint,
  analysisJumpEntry,
  analysisJumpHistory,
  analysisHistoryVisible,
  onRegenerate,
  onEditMessage,
  onApplyAnalysisJump,
  onSendAnalysisJump,
  onDismissAnalysisJump,
  onDismissAnalysisJumpHistory,
  onReuseAnalysisJump,
  onStopGenerating,
  chatInputRef,
} = toRefs(props)

/** 本地绑定 NScrollbar，并同步给父级引用，供会话加载时复用 */
const messagesViewportRef = ref(null)

const setMessagesViewportRef = (inst) => {
  messagesViewportRef.value = inst

  const parentRef = props.messagesContainerRef
  if (parentRef && typeof parentRef === 'object' && 'value' in parentRef) {
    parentRef.value = inst
  }
}

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
const isEmptyState = computed(() => displayMessages.value.length === 0 && !analysisJumpEntry.value)
const lastDisplayMessage = computed(() => {
  if (displayMessages.value.length === 0) return null
  return displayMessages.value[displayMessages.value.length - 1]
})

const lastEditableUserMessageId = computed(() => {
  const raw = messages.value || []
  for (let i = raw.length - 1; i >= 0; i -= 1) {
    const m = raw[i]
    if (m.isUser && String(m.content || '').trim()) return m.id
  }
  return null
})

/** 流式输出时避免对 messages 做 deep watch，仅跟踪会影响布局的标量 */
const messagesScrollFingerprint = computed(() => {
  const m = messages.value || []
  if (!m.length) return '0'
  
  const last = m[m.length - 1]
  const agentDataFingerprint = last.agentData ? JSON.stringify(last.agentData) : ''
  
  return [
    m.length,
    last.id,
    String(last.content || '').length,
    String(last.think_process || '').length,
    agentDataFingerprint,
    last.duration ?? '',
  ].join('|')
})

/** 距底部小于此值视为「在跟随区」，内容增长时自动滚到底；滚轮/拖拽离开此区域后不再强跟 */
const NEAR_BOTTOM_PX = 60
const isNearBottom = ref(true)

const handleScroll = (e) => {
  const el = e?.target
  if (!el) return
  const dist = Math.ceil(el.scrollHeight - el.scrollTop) - el.clientHeight
  isNearBottom.value = dist <= NEAR_BOTTOM_PX
}

const scrollToBottom = (force = false) => {
  if (!force && !isNearBottom.value) return
  const sb = messagesViewportRef.value
  if (!sb) return
  if (typeof sb.scrollTo === 'function') {
    sb.scrollTo({
      position: 'bottom',
      behavior: 'auto',
    })
  }
}

const forceScrollToBottom = () => {
  isNearBottom.value = true
  scrollToBottom(true)
}

watch(messagesScrollFingerprint, () => {
  nextTick(() => scrollToBottom(false))
})

/**
 * 从末尾向前找「最近一条用户消息」的指纹。不能再用「最后一条是用户」判断：
 * handleNormalSend 在同一 tick 内先加用户消息再加空的助手消息，最后一条永远是 assistant，
 * 旧逻辑会得到 fp === ''，永远不会滚底。
 */
const lastUserMessageFingerprint = computed(() => {
  const m = messages.value || []
  for (let i = m.length - 1; i >= 0; i -= 1) {
    if (m[i].isUser) {
      return `${m[i].id}|${String(m[i].content ?? '').length}|${m[i].attachmentName || ''}`
    }
  }
  return ''
})

watch(lastUserMessageFingerprint, async (fp, prevFp) => {
  if (!fp || fp === prevFp) return
  isNearBottom.value = true
  await nextTick()
  await nextTick()
  scrollToBottom(true)
  requestAnimationFrame(() => {
    scrollToBottom(true)
    requestAnimationFrame(() => scrollToBottom(true))
  })
})

watch(currentSession, () => {
  isNearBottom.value = true
  nextTick(() => scrollToBottom(true))
})

watch(loading, (isLoading, wasLoading) => {
  if (isLoading && !wasLoading) {
    isNearBottom.value = true
    nextTick(() => scrollToBottom(true))
  }
  if (wasLoading && !isLoading) {
    nextTick(() => scrollToBottom(false))
  }
})

onMounted(() => {
  nextTick(() => {
    scrollToBottom(true)
  })
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
  font-size: 1.1rem;
  color: var(--neon-cyan);
  letter-spacing: 0.09em;
  text-shadow: var(--neon-cyan-glow);
}

.terminal-header-right {
  margin-left: auto;
  gap: 0.75rem;
  font-family: var(--font-ui);
}

.terminal-meta {
  font-size: 0.85rem;
  font-weight: 600;
  color: #a1c8db;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  white-space: nowrap;
}

.terminal-meta--session {
  max-width: min(42vw, 280px);
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: none;
  font-size: 0.85rem;
  padding-top: 1.6px;
}

.terminal-meta--tagline {
  text-transform: none;
  font-size: 0.85rem;
  padding-top: 3px;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: #7a9fb4;
  white-space: normal;
  text-align: right;
  line-height: 1.35;
  max-width: min(48vw, 320px);
}

@media (max-width: 768px) {
  .terminal-header-right {
    flex-direction: column;
    align-items: flex-end;
    gap: 0.25rem;
  }

  .terminal-meta--tagline {
    display: none;
  }

  .terminal-meta--session {
    max-width: min(55vw, 200px);
  }
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

.analysis-jump-card {
  margin-bottom: 0.68rem;
  border: 1px solid rgba(0, 229, 255, 0.22);
  background: linear-gradient(180deg, rgba(8, 18, 34, 0.9), rgba(4, 10, 22, 0.8));
}

.analysis-jump-card__header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.analysis-jump-card__close-btn {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  color: var(--neon-cyan);
}

.analysis-jump-card__close-icon {
  width: 14px;
  height: 14px;
}

.analysis-jump-card__title {
  font-family: var(--font-ui);
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--neon-cyan);
  text-transform: uppercase;
}

.analysis-jump-card__summary-label,
.analysis-jump-card__prompt-label,
.analysis-jump-card__followups-label,
.analysis-history-strip__label {
  margin-bottom: 0.8rem;
  font-family: var(--font-ui);
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  color: #6f95a9;
  text-transform: uppercase;
}

.analysis-jump-card__summary-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
}

.analysis-jump-card__summary-item {
  border: 1px solid rgba(0, 229, 255, 0.14);
  background: rgba(0, 229, 255, 0.04);
  padding: 0.42rem 0.52rem;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 1rem;
  min-width: 0;
}

.analysis-jump-card__summary-item--wide {
  grid-column: 1 / -1;
}

.analysis-jump-card__summary-label {
  flex-shrink: 0;
  white-space: nowrap;
}

.analysis-jump-card__summary-value {
  color: #d9f6ff;
  font-family: var(--font-ui);
  font-size: 0.9rem;
  line-height: 1.55;
  word-break: break-word;
  text-align: left;
}

.analysis-jump-card__prompt {
  margin-top: 1rem;
  padding: 0.85rem 1rem;
  border: 1px solid rgba(0, 229, 255, 0.16);
  background: rgba(2, 8, 22, 0.62);
}

.analysis-jump-card__prompt-text {
  margin-top: 0.5rem;
  color: #d8f5ff;
  font-family: var(--font-ui);
  font-size: 0.95rem;
  line-height: 1.65;
  white-space: pre-wrap;
}

.analysis-jump-card__followups {
  margin-top: 1rem;
}

.analysis-jump-card__followups-list,
.analysis-history-strip__items {
  display: flex;
  flex-wrap: wrap;
  gap: 3rem;
}

.analysis-jump-card__followup-item,
.analysis-history-strip__item {
  border: 1px solid rgba(0, 229, 255, 0.16);
  background: rgba(0, 229, 255, 0.05);
  color: #b9dced;
  font-family: var(--font-ui);
  font-size: 0.85rem;
  letter-spacing: 0.05em;
}

.analysis-jump-card__followup-item {
  padding: 0.3rem 0.5rem;
}

.analysis-jump-card__actions {
  margin-top: 2rem;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.analysis-jump-card__button {
  min-width: 0;
}

.analysis-history-strip {
  margin-bottom: 0.72rem;
  padding: 0.45rem 0.6rem 0.55rem;
  border: 1px solid rgba(0, 229, 255, 0.14);
  background: rgba(4, 12, 28, 0.72);
}

.analysis-history-strip__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.analysis-history-strip__close-btn {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  color: var(--neon-cyan);
}

.analysis-history-strip__close-icon {
  width: 13px;
  height: 13px;
}

.analysis-history-strip__items {
  margin-top: 0.45rem;
}

.analysis-history-strip__item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.44rem;
  cursor: pointer;
}

.analysis-history-strip__source {
  color: var(--neon-cyan);
}

.analysis-history-strip__focus {
  color: #d8f5ff;
}

.terminal-alert :deep(.n-alert-body__content) {
  font-family: var(--font-ui);
  font-size: 0.66rem;
}

.messages-container {
  flex: 1;
  min-height: 0;
  position: relative;
  display: flex;
  flex-direction: column;
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
  min-height: min(600px,62vh);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  border: 1px solid rgba(0, 229, 255, 0.06);
  background: linear-gradient(180deg, rgba(8, 18, 34, 0.4), rgba(4, 10, 22, 0.6)),
              radial-gradient(circle at center, rgba(0, 229, 255, 0.05), transparent 70%);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.02);
  box-sizing: border-box;
  padding: 0.75rem 1rem clamp(1.5rem, 5vh, 3rem);
  width: 100%;
  margin: 0 auto;
}

.terminal-empty-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: min(92vw, 26rem);
  transform: translateY(clamp(-0.5rem, -1.75vh, 0rem));
}

.terminal-empty-logo {
  width: clamp(280px, 45vw, 420px);
  max-width: 420px;
  height: auto;
  object-fit: contain;
  display: block;
  flex-shrink: 0;
  filter: drop-shadow(0 0 15px rgba(0, 229, 255, 0.12));
}

.terminal-empty-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.45rem;
  margin-top: 1.8rem;
  margin-bottom: 0.5rem;
}

.terminal-empty-brand__line {
  margin: 0;
  font-size: 2.2rem;
  font-family: var(--font-ui);
  font-weight: 500;
  letter-spacing: 0.15em;
  background: linear-gradient(135deg, #FFFFFF 0%, #C0D6F0 35%, #9ABDF8 70%, #00E5FF 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  color: #00E5FF; /* Fallback */
  line-height: 1.2;
  white-space: nowrap;
}

.terminal-empty-hint {
  margin-top: 0.8rem;
  font-size: 1.2rem;
  font-family: var(--font-ui);
  font-weight: 300;
  letter-spacing: 0.08em;
  color: #8babc1;
  opacity: 0.85;
}

/* 引入错落浮现进场动效 */
.animate-item {
  opacity: 0;
  animation: float-up-fade 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.delay-1 { animation-delay: 0.1s; }
.delay-2 { animation-delay: 0.25s; }
.delay-3 { animation-delay: 0.4s; }

@keyframes float-up-fade {
  0% { opacity: 0; transform: translateY(15px) scale(0.98); filter: blur(4px); }
  100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
}

.terminal-loading {
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--neon-cyan);
  font-family: var(--font-ui);
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
  padding: 0.56rem 0.45rem 0;
}

.terminal-entry-hint {
  font-family: var(--font-ui);
  font-size: 0.66rem;
  letter-spacing: 0.08em;
}

/* 彻底清除切角和背景干扰的悬浮按钮 */
.scroll-to-bottom-btn {
  position: absolute;
  bottom: 2.5rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  
  background: rgba(2, 8, 22, 0.4) !important; 
  background-image: none !important;
  clip-path: none !important; 
  
  border: 1.5px solid rgba(0, 229, 255, 0.4) !important;
  border-radius: 50% !important;
  
  color: var(--neon-cyan);
  cursor: pointer;
  backdrop-filter: blur(4px);
  z-index: 100;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  outline: none;
}

.scroll-to-bottom-btn:hover {
  /* 确保悬停时也不会触发切角背景 */
  background: rgba(0, 229, 255, 0.15) !important;
  background-image: none !important;
  border-color: var(--neon-cyan) !important;
  color: #fff;
  box-shadow: 0 0 15px rgba(0, 229, 255, 0.3);
  transform: translate(-50%, -4px);
}

.scroll-to-bottom-btn:active {
  transform: translate(-50%, 0px) scale(0.9);
}

.scroll-to-bottom-btn__icon {
  width: 24px;
  height: 24px;
  animation: hint-down 2s infinite ease-in-out;
}

@keyframes hint-down {
  0%, 100% { transform: translateY(-2px); }
  50% { transform: translateY(2px); }
}

/* 过渡动画 */
.fade-up-enter-active,
.fade-up-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-up-enter-from,
.fade-up-leave-to {
  opacity: 0;
  transform: translate(-50%, 15px);
}
</style>