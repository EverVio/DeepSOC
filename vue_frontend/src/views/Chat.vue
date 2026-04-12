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
          <span class="terminal-meta terminal-meta--session" :title="currentSession">{{ currentSession }}</span>
          <span class="terminal-meta terminal-meta--tagline">SOC 智能研判 · 日志与多模型协同</span>
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

      <NScrollbar ref="messagesViewportRef" class="messages-viewport">
        <div class="messages-viewport-inner">
          <NAlert v-if="entryHint" class="terminal-entry-hint" type="info" :show-icon="true">
            {{ entryHint }}
          </NAlert>
          <div v-if="isEmptyState" class="terminal-empty">
            <div class="terminal-empty-inner">
              <img class="terminal-empty-logo" :src="deepsocEmptyLogo" alt="DeepSOC" />
              <div class="terminal-empty-brand">
                <p class="terminal-empty-brand__line">DEEPSOC</p>
                <p class="terminal-empty-brand__line">智能安全运营中心系统</p>
              </div>
              <p class="terminal-empty-hint">有什么我能帮您的吗？</p>
            </div>
          </div>

          <ChatMessage v-for="(msg, index) in displayMessages" :key="msg.id" :is-user="msg.isUser"
            :content="msg.content" :attachment-name="msg.attachmentName" :think-process="msg.think_process"
            :duration="msg.duration" :timestamp="msg.timestamp" :message-id="msg.id" :is-multi-agent="msg.isMultiAgent"
            :agent-data="msg.agentData"
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

      <div class="terminal-input-zone">
        <ChatInput :ref="chatInputRef" :loading="loading" :streaming="streaming" :current-session="currentSession"
          @send="onSendMessage" @stop="onStopGenerating" />
      </div>
    </FuiCard>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, toRefs, watch } from 'vue'
import { NAlert, NButton, NCard, NScrollbar } from 'naive-ui'
import FuiCard from '../components/FuiCard.vue'
import ChatMessage from '../components/ChatMessage.vue'
import ChatInput from '../components/ChatInput.vue'
import { AlertTriangleIcon as AlertIcon, XIcon } from 'vue-tabler-icons'
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

/** 本地绑定 NScrollbar，避免「props 传入的 ref + 子组件 :ref」解包不一致导致父级 ref 永远为 null */
const messagesViewportRef = ref(null)

watch(
  messagesViewportRef,
  (inst) => {
    const parentRef = props.messagesContainerRef
    if (parentRef && typeof parentRef === 'object' && 'value' in parentRef) {
      parentRef.value = inst
    }
  },
  { immediate: true, flush: 'post' },
)

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
  const ad = last.agentData
  const ragLen = ad?.rag?.content?.length ?? 0
  const webLen = ad?.web?.content?.length ?? 0
  const ragSt = ad?.rag?.status ?? ''
  const webSt = ad?.web?.status ?? ''
  return [
    m.length,
    last.id,
    String(last.content || '').length,
    String(last.think_process || '').length,
    ragLen,
    webLen,
    ragSt,
    webSt,
    last.duration ?? '',
  ].join('|')
})

/** 距底部小于此值视为「在跟随区」，内容增长时自动滚到底；滚轮/拖拽离开此区域后不再强跟 */
const NEAR_BOTTOM_PX = 120
const isNearBottom = ref(true)
let messagesScrollCleanup = null

const resolveMessagesScrollbar = () => {
  const inst = messagesViewportRef.value
  if (!inst) return null
  return inst
}

const getScrollEl = () => {
  const sb = resolveMessagesScrollbar()
  if (!sb) return null
  const inner = sb.scrollbarInstRef?.value
  if (inner?.containerRef) {
    const c = inner.containerRef
    return c.value ?? c
  }
  const root = sb.$el
  if (root?.querySelector) {
    return root.querySelector('.n-scrollbar-container')
  }
  return null
}

const updateNearBottom = () => {
  const el = getScrollEl()
  if (!el) return
  const dist = el.scrollHeight - el.scrollTop - el.clientHeight
  isNearBottom.value = dist <= NEAR_BOTTOM_PX
}

const scrollToBottom = (force = false) => {
  if (!force && !isNearBottom.value) return
  const sb = resolveMessagesScrollbar()
  if (!sb) return
  if (typeof sb.scrollTo === 'function') {
    sb.scrollTo({
      position: 'bottom',
      behavior: force ? 'auto' : 'smooth',
    })
  } else {
    const el = getScrollEl()
    if (el) el.scrollTop = el.scrollHeight
  }
  requestAnimationFrame(() => updateNearBottom())
}

const bindMessagesScroll = () => {
  messagesScrollCleanup?.()
  messagesScrollCleanup = null
  const el = getScrollEl()
  if (!el) return
  const onScroll = () => updateNearBottom()
  /** 滚轮/触控板等产生的滚动同样会触发 scroll；此处显式监听 wheel 以便与「程序滚动」区分时仍更新跟随状态 */
  const onWheel = () => {
    requestAnimationFrame(() => updateNearBottom())
  }
  el.addEventListener('scroll', onScroll, { passive: true })
  el.addEventListener('wheel', onWheel, { passive: true })
  messagesScrollCleanup = () => {
    el.removeEventListener('scroll', onScroll)
    el.removeEventListener('wheel', onWheel)
  }
}

watch(
  messagesViewportRef,
  () => {
    nextTick(() => {
      bindMessagesScroll()
      updateNearBottom()
    })
  },
  { flush: 'post' },
)

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

/** 开始生成：用户刚发完，强制跟到底一次（避免此时 isNearBottom 未更新导致不滚） */
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
    bindMessagesScroll()
    updateNearBottom()
    scrollToBottom(true)
  })
})

onUnmounted(() => {
  messagesScrollCleanup?.()
  messagesScrollCleanup = null
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
  font-size: 0.78rem;
}

.terminal-meta--tagline {
  text-transform: none;
  font-size: 0.68rem;
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
  background: linear-gradient(180deg, rgba(8, 18, 34, 0.98), rgba(4, 10, 22, 0.95));
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
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--neon-cyan);
  text-transform: uppercase;
}

.analysis-jump-card__summary-label,
.analysis-jump-card__prompt-label,
.analysis-jump-card__followups-label,
.analysis-history-strip__label {
  font-family: var(--font-ui);
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  color: #6f95a9;
  text-transform: uppercase;
}

.analysis-jump-card__summary-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}

.analysis-jump-card__summary-item {
  border: 1px solid rgba(0, 229, 255, 0.14);
  background: rgba(0, 229, 255, 0.04);
  padding: 0.42rem 0.52rem;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 0.85rem;
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
  font-size: 0.66rem;
  line-height: 1.55;
  word-break: break-word;
  text-align: left;
}

.analysis-jump-card__prompt {
  margin-top: 0.65rem;
  padding: 0.65rem 0.72rem;
  border: 1px solid rgba(0, 229, 255, 0.16);
  background: rgba(2, 8, 22, 0.62);
}

.analysis-jump-card__prompt-text {
  margin-top: 0.34rem;
  color: #d8f5ff;
  font-family: var(--font-ui);
  font-size: 0.67rem;
  line-height: 1.65;
  white-space: pre-wrap;
}

.analysis-jump-card__followups {
  margin-top: 0.65rem;
}

.analysis-jump-card__followups-list,
.analysis-history-strip__items {
  display: flex;
  flex-wrap: wrap;
  gap: 0.42rem;
}

.analysis-jump-card__followup-item,
.analysis-history-strip__item {
  border: 1px solid rgba(0, 229, 255, 0.16);
  background: rgba(0, 229, 255, 0.05);
  color: #b9dced;
  font-family: var(--font-ui);
  font-size: 0.62rem;
  letter-spacing: 0.05em;
}

.analysis-jump-card__followup-item {
  padding: 0.2rem 0.42rem;
}

.analysis-jump-card__actions {
  margin-top: 0.78rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
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
  min-height: min(450px, 52vh);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  border: 1px dashed rgba(0, 229, 255, 0.22);
  background: radial-gradient(circle at center, rgba(0, 229, 255, 0.04), transparent 65%);
  box-sizing: border-box;
  padding: 0.75rem 1rem clamp(1.5rem, 5vh, 3rem);
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
  width: clamp(420px, 52vw, 560px);
  max-width: 560px;
  height: auto;
  object-fit: contain;
  display: block;
  flex-shrink: 0;
  filter: none;
}

.terminal-empty-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.45rem;
  margin-top: 1.35rem;
  margin-bottom: 0.25rem;
}

/** 与 .terminal-empty-hint 同字号、同色；额外霓虹发光 */
.terminal-empty-brand__line {
  margin: 0;
  font-size: 2rem;
  font-family: var(--font-ui);
  font-weight: 1000;
  letter-spacing: 0.04em;
  color: var(--neon-cyan);
  text-shadow: var(--neon-cyan-glow);
  line-height: 1.2;
}

.terminal-empty-text {
  margin-top: 0.2rem;
  font-family: var(--font-ui);
  font-size: 0.95rem;
  font-weight: 600;
  color: #d9effa;
}

.prompt-prefix {
  color: var(--neon-green);
}

.terminal-empty-hint {
  margin-top: 1.05rem;
  font-size: 1.1rem;
  font-family: var(--font-ui);
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #5c8a9a;
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
  padding-top: 0.56rem;
}

.terminal-entry-hint {
  font-family: var(--font-ui);
  font-size: 0.66rem;
  letter-spacing: 0.08em;
}
</style>
