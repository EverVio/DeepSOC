<template>
  <div class="dashboard-page settings-dashboard scanline-bg">
    <n-grid :x-gap="16" :y-gap="16" cols="1 s:1 m:2 l:3" responsive="screen" class="settings-grid">
      
      <n-gi :span="2" class="merged-engine-column">
        <FuiCard :title="aiEngineTitle" class="settings-panel solid-tech-panel settings-panel--merged-container">
          <div class="panel-decorative-corner"></div>

          <div class="merged-engine-body">
            <section class="merged-engine-section merged-engine-section--core">
              <div class="summary-strip summary-strip--quad">
                <span class="status-badge"><span class="dot blink-green"></span> ONLINE</span>
                <span class="data-tag">PROVIDER <strong class="ticker-value">{{ llmProvider.toUpperCase() }}</strong></span>
                <span class="data-tag">EMBED <strong class="ticker-value">{{ embeddingMode.toUpperCase() }}</strong></span>
                <span class="data-tag">MODE <strong class="ticker-value highlight-cyan">SECURE</strong></span>
              </div>

              <NForm label-placement="top" :show-feedback="false" class="panel-form">
                <div class="form-grid-2">
                  <NFormItem label="MODEL PROVIDER // 模型供应商">
                    <NSelect class="config-control config-control--select" :value="llmProvider" :options="providerOptions" @update:value="updateProvider" />
                  </NFormItem>

                  <NFormItem label="MODEL NAME // 核心模型">
                    <NSelect class="config-control config-control--select" :value="llmModel" :options="modelOptions" @update:value="updateModel" />
                  </NFormItem>

                  <NFormItem label="EMBEDDING MODE // 向量化方式">
                    <NSelect class="config-control config-control--select" :value="embeddingMode" :options="embeddingModeOptions" @update:value="updateEmbeddingMode" />
                  </NFormItem>

                  <NFormItem label="EMBEDDING MODEL // 向量模型">
                    <NSelect class="config-control config-control--select" :value="embeddingModel" :options="embeddingModelOptions" @update:value="updateEmbeddingModel" />
                  </NFormItem>
                </div>

                <NFormItem label="PROVIDER API KEY // 鉴权密钥">
                  <div class="input-with-ping provider-key-row">
                    <NInput
                      class="config-control config-control--input"
                      type="password"
                      show-password-on="mousedown"
                      :value="providerApiKey"
                      :placeholder="providerApiKeyPlaceholder"
                      :disabled="llmProvider === 'ollama'"
                      @update:value="updateProviderApiKey"
                    />
                    <button 
                      type="button"
                      class="tech-action-btn" 
                      :class="{ 'pinging': isPingingProvider, 'success': providerPingStatus.endsWith('ms') }"
                      :disabled="llmProvider === 'ollama'"
                      @click="handlePing('provider')"
                    >
                      <ActivityIcon class="btn-icon" v-if="!isPingingProvider" />
                      <span class="ping-text">{{ providerPingStatus }}</span>
                    </button>
                  </div>
                  <div class="terminal-hint">
                  </div>
                </NFormItem>
              </NForm>
            </section>

            <section class="merged-engine-section merged-engine-section--plugins">
              <div class="merged-section-heading">
                <span class="merged-section-heading__title">{{ pluginsTitle }}</span>
                <span class="merged-section-heading__meta">MODULE <strong>WEB_SEARCH</strong></span>
              </div>

              <div class="summary-strip summary-strip--compact">
                <span class="data-tag">HEALTH <strong class="ticker-value highlight-green">100%</strong></span>
              </div>

              <NForm label-placement="top" :show-feedback="false" class="panel-form panel-form--compact">
                <NFormItem label="WEB SEARCH API KEY // 检索引擎密钥">
                  <div class="input-with-ping search-key-row">
                    <NInput
                      class="config-control config-control--input"
                      type="password"
                      show-password-on="mousedown"
                      :value="webSearchApiKey"
                      :placeholder="webSearchApiKeyPlaceholder"
                      @update:value="updateWebSearchApiKey"
                    />
                    <button 
                      type="button"
                      class="tech-action-btn" 
                      :class="{ 'pinging': isPingingSearch, 'success': searchPingStatus.endsWith('ms') }"
                      :disabled="isPingingSearch"
                      @click="handlePing('search')"
                    >
                      <ActivityIcon class="btn-icon" v-if="!isPingingSearch" />
                      <span class="ping-text">{{ searchPingStatus }}</span>
                    </button>
                  </div>
                </NFormItem>
              </NForm>
            </section>
          </div>
        </FuiCard>
      </n-gi>

      <n-gi :span="1">
        <FuiCard :title="dataTitle" class="settings-panel solid-tech-panel settings-panel--data-interface">
          <div class="panel-decorative-corner"></div>
          <div class="summary-strip">
            <span class="data-tag">CACHED <strong class="ticker-value highlight-cyan">{{ sessionOptions.length }}</strong> SESSIONS</span>
            <span class="data-tag">EXPORT_FORMAT <strong class="ticker-value">HTML</strong></span>
          </div>

          <NForm label-placement="top" :show-feedback="false" class="panel-form">
            <NFormItem label="TARGET SESSION DUMP // 数据流转储">
              <div class="export-row">
                <NSelect v-model:value="selectedSessionForExport" :options="sessionOptions" placeholder="选择转储目标" class="export-select config-control config-control--select" />
                <button 
                  type="button"
                  class="tech-execute-btn" 
                  :class="{ 'is-loading': isExporting }" 
                  :disabled="isExporting"
                  @click="handleExportSelectedSession"
                >
                  <DownloadIcon class="btn-icon" />
                  <span>{{ isExporting ? 'DUMPING_DATA...' : 'EXECUTE_DUMP' }}</span>
                </button>
              </div>
            </NFormItem>
          </NForm>
        </FuiCard>
      </n-gi>

      <n-gi :span="1">
        <FuiCard :title="securityTitle" class="settings-panel solid-tech-panel settings-panel--security">
          <div class="panel-decorative-corner"></div>
          <div class="summary-strip">
            <span class="status-badge danger"><span class="dot blink-red"></span> ACTIVE</span>
            <span class="data-tag danger">CLEARANCE <strong class="ticker-value">LEVEL_3</strong></span>
          </div>

          <div class="security-panel-content">
            <div class="warning-box solid-warning">
              <AlertTriangleIcon class="warning-icon" />
              <div class="warning-text">
                <p class="warning-title">CRITICAL ACTION</p>
                <p>TERMINATING SESSION FLUSHES ALL VOLATILE CREDENTIALS.</p>
              </div>
            </div>
            
            <button type="button" class="tech-kill-btn full-width" @click="handleLogout">
              <LogoutIcon class="btn-icon" />
              <span>TERMINATE_SESSION</span>
            </button>
          </div>
        </FuiCard>
      </n-gi>

    </n-grid>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { NGrid, NGi, NForm, NFormItem, NInput, NSelect, createDiscreteApi } from 'naive-ui'
import { DownloadIcon, LogoutIcon, ActivityIcon, AlertTriangleIcon } from 'vue-tabler-icons'
import api from '../api'

import FuiCard from '../components/FuiCard.vue'
import { useTextScramble } from '../composables/useTextScramble'
import { useChatSettings } from '../composables/useChatSettings'
import { useChatStore } from '../stores/chatStore'

const { message } = createDiscreteApi(['message'])

const aiEngineTitle = ref('CORE AI ENGINE')
const pluginsTitle = ref('EXTERNAL PLUGINS')
const dataTitle = ref('DATA INTERFACE')
const securityTitle = ref('SYSTEM SECURITY')

const scramblers = [
  useTextScramble((v) => aiEngineTitle.value = v),
  useTextScramble((v) => pluginsTitle.value = v),
  useTextScramble((v) => dataTitle.value = v),
  useTextScramble((v) => securityTitle.value = v),
]

onMounted(() => {
  scramblers[0].start('CORE AI ENGINE', 300)
  setTimeout(() => scramblers[1].start('EXTERNAL PLUGINS', 300), 50)
  setTimeout(() => scramblers[2].start('DATA INTERFACE', 300), 100)
  setTimeout(() => scramblers[3].start('SYSTEM SECURITY', 300), 150)
})

onBeforeUnmount(() => {
  scramblers.forEach(s => s.stop())
})

const router = useRouter()
const chatStore = useChatStore()
const { sessions, currentSession } = storeToRefs(chatStore)

const {
  isExporting,
  selectedSessionForExport,
  llmProvider,
  llmModel,
  embeddingMode,
  embeddingModel,
  providerApiKey,
  webSearchApiKey,
  availableProviders,
  availableModels,
  availableEmbeddingModes,
  availableEmbeddingModels,
  providerApiKeyPlaceholder,
  webSearchApiKeyPlaceholder,
  updateProvider,
  updateModel,
  updateEmbeddingMode,
  updateEmbeddingModel,
  updateProviderApiKey,
  updateWebSearchApiKey,
  handleExportSelectedSession,
  handleLogout,
} = useChatSettings({
  router,
  apiClient: api,
  currentSession,
  sessions,
})

const sessionOptions = computed(() => (sessions.value || []).map((item) => ({ label: item, value: item })))
const providerOptions = computed(() => (availableProviders || []).map((item) => ({ label: item.label, value: item.value })))
const modelOptions = computed(() => (availableModels.value || []).map((item) => ({ label: item, value: item })))
const embeddingModeOptions = computed(() => (availableEmbeddingModes || []).map((item) => ({ label: item.label, value: item.value })))
const embeddingModelOptions = computed(() => (availableEmbeddingModels.value || []).map((item) => ({ label: item, value: item })))

const isPingingProvider = ref(false)
const providerPingStatus = ref('PING')

const isPingingSearch = ref(false)
const searchPingStatus = ref('PING')

// 设计思路：保持主逻辑线性执行，无异常捕获。直接通过 await 阻断或向下流转数据状态。
const handlePing = async (type) => {
  if (type === 'provider') {
    if (llmProvider.value !== 'ollama' && !providerApiKey.value) {
      message.warning('请先输入 Provider API Key', { duration: 3000 })
      return
    }
    
    isPingingProvider.value = true
    providerPingStatus.value = 'WAIT...'
    try {
      const res = await api.testConnection({
        type: 'provider',
        provider: llmProvider.value,
        api_key: providerApiKey.value,
      })

      providerPingStatus.value = `${res.data.latency_ms}ms`
      setTimeout(() => { providerPingStatus.value = 'PING' }, 5000)
    } catch (error) {
      const errorMessage = error?.response?.data?.error || error?.message || 'Provider Ping 失败'
      message.error(errorMessage, { duration: 3000 })
      providerPingStatus.value = 'PING'
    } finally {
      isPingingProvider.value = false
    }

  } else if (type === 'search') {
    if (!webSearchApiKey.value) {
      message.warning('请先输入 Web Search API Key', { duration: 3000 })
      return
    }
    
    isPingingSearch.value = true
    searchPingStatus.value = 'WAIT...'
    try {
      const res = await api.testConnection({
        type: 'search',
        api_key: webSearchApiKey.value,
      })

      searchPingStatus.value = `${res.data.latency_ms}ms`
      setTimeout(() => { searchPingStatus.value = 'PING' }, 5000)
    } catch (error) {
      const errorMessage = error?.response?.data?.error || error?.message || 'Web Search Ping 失败'
      message.error(errorMessage, { duration: 3000 })
    } finally {
      isPingingSearch.value = false
    }
  }
}
</script>

<style scoped>
/* 核心设计理念：抛弃模糊玻璃态，采用深色实体纯色、锐利几何边角、工业级赛博朋克 UI */
.settings-dashboard {
  --settings-bg: #02060d;
  --settings-panel-bg: #050a11;
  --settings-panel-border: #102a3a;
  --settings-cyan: var(--neon-cyan);
  --settings-danger: #ff4975;
}

.dashboard-page {
  min-height: 0;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding: clamp(0.9rem, 1.2vw, 1.25rem);
  display: flex;
  flex-direction: column;
  background-color: var(--settings-bg);
}

/* 背景 CRT 扫描线 */
.scanline-bg {
  position: relative;
}
.scanline-bg::after {
  content: " ";
  display: block;
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
  z-index: 2;
  background-size: 100% 2px, 3px 100%;
  pointer-events: none;
}

.settings-grid {
  flex: 1;
  min-height: 0;
  height: 100%;
  position: relative;
  z-index: 10;
  align-content: start;
}

@media (min-width: 1024px) {
  .settings-grid {
    grid-template-rows: minmax(260px, 1fr) minmax(240px, 1fr) !important;
  }
}

.settings-grid :deep(.n-gi) {
  min-height: 0;
  display: flex;
  height: 100%;
}

/* 实体机甲面板基调 */
.settings-panel {
  flex: 1;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  background: var(--settings-panel-bg) !important;
  border: 2px solid var(--settings-panel-border);
  box-shadow: inset 0 0 28px rgba(0, 229, 255, 0.04), 0 8px 30px rgba(0, 0, 0, 0.28);
}

.settings-panel::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: radial-gradient(var(--settings-cyan) 0.5px, transparent 0.5px);
  background-size: 14px 14px;
  opacity: 0.045;
  pointer-events: none;
}

.settings-panel::after {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 76px;
  background: linear-gradient(180deg, rgba(0, 229, 255, 0.08), rgba(0, 229, 255, 0));
  pointer-events: none;
}

/* 面板装饰切割角 */
.panel-decorative-corner {
  position: absolute;
  top: -1px;
  right: -1px;
  width: 20px;
  height: 20px;
  background: var(--settings-cyan);
  clip-path: polygon(100% 0, 0 0, 100% 100%);
  z-index: 2;
}

.panel-decorative-corner.danger {
  background: var(--settings-danger);
}

.settings-panel :deep(.fui-card-body) {
  display: flex;
  flex-direction: column;
  padding: 1.8rem 2.6rem 1.6rem;
  flex: 1;
  min-height: 0;
}

/* 实心高亮面板分类 */
.solid-tech-panel {
  border-top: 2px solid var(--settings-cyan);
}

.solid-danger-panel {
  border-top: 2px solid var(--settings-danger);
  background: #0a0406 !important;
}

/* 数据标签/状态栏重构为军事化实体块 */
.summary-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 3rem;
  margin-bottom: 1.15rem;
}

.summary-strip--triple {
  display: flex;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  flex-wrap: nowrap;
}

.summary-strip--triple > * {
  min-width: 180px;
  justify-content: center;
  text-align: center;
  white-space: nowrap;
}

.summary-strip--quad {
  display: flex;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  flex-wrap: nowrap;
}

.summary-strip--quad > * {
  min-width: 140px;
  justify-content: center;
  text-align: center;
  white-space: nowrap;
}

.merged-engine-column {
  grid-row: span 2;
}

.settings-panel--merged-container {
  min-height: 0;
}

.settings-panel--merged-container :deep(.fui-card-body) {
  padding-top: 1.1rem;
  padding-bottom: 1.05rem;
}

.merged-engine-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 1.1rem;
}

.merged-engine-section {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.merged-engine-section--core {
  flex: 0 0 auto;
}

.merged-engine-section--plugins {
  flex: 0 0 auto;
  margin-top: 0.85rem;
  padding-top: 3rem;
  border-top: 1px solid rgba(0, 229, 255, 0.18);
}

.merged-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.35rem;
  font-family: var(--font-mono);
  letter-spacing: 0.045em;
}

.merged-section-heading__title {
  color: #8fdff0;
  font-size: 0.82rem;
  text-transform: uppercase;
}

.merged-section-heading__meta {
  color: #4a7587;
  font-size: 0.72rem;
  text-transform: uppercase;
}

.summary-strip--compact {
  margin-bottom: 0.5rem;
}

.panel-form--compact {
  gap: 0.6rem;
}

.merged-engine-section--core .panel-form,
.merged-engine-section--plugins .panel-form {
  flex: 0 0 auto;
}

.merged-engine-section--core .summary-strip {
  margin-bottom: 0.7rem;
}

.merged-engine-section--core .panel-form {
  gap: 1.2rem;
}

.data-tag, .status-badge {
  background: #0a1320;
  border: 2px solid #1a3344;
  color: #6a95a8;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  line-height: 1;
  letter-spacing: 0.045em;
  padding: 0.6rem 0.8rem;
  display: inline-flex;
  align-items: center;
  text-transform: uppercase;
}

.data-tag.danger {
  background: #1a080c;
  border-color: #3f121d;
  color: #a86a77;
}

.status-badge {
  color: #fff;
  font-weight: bold;
}

.status-badge.danger {
  color: #ff4975;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 6px;
}
.blink-green { background-color: #00ff66; animation: blink 1.5s infinite; box-shadow: 0 0 8px #00ff66; }
.blink-red { background-color: #ff0055; animation: blink 1s infinite; box-shadow: 0 0 8px #ff0055; }

.ticker-value {
  margin: 0 0.4rem;
  color: #fff;
  letter-spacing: 0.03em;
}
.highlight-green { color: #00ff66; }
.highlight-cyan { color: #00e5ff; }

/* 表单布局 */
.panel-form {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  flex: 1;
}

.settings-panel--plugins .panel-form {
  gap: 0.65rem;
}

.settings-panel--plugins .summary-strip {
  margin-bottom: 5rem;
}

.settings-panel--data-interface .summary-strip,
.settings-panel--security .summary-strip {
  margin-bottom: 3rem;
}

.settings-panel--data-interface .data-tag,
.settings-panel--data-interface .status-badge,
.settings-panel--security .data-tag,
.settings-panel--security .status-badge {
  padding-top: 0.8rem;
  padding-bottom: 0.8rem;
}

.settings-panel--plugins :deep(.n-form-item) {
  padding-top: 0.25rem;
  padding-bottom: 0.25rem;
}

.form-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
}

.export-row {
  display: flex;
  gap: 2rem;
  align-items: center;
}
.export-select { flex: 2; min-width: 120px;}
.input-with-ping {
  display: flex;
  gap: 2rem;
  align-items: stretch;
  width: 100%;
}

.provider-key-row {
  max-width: 60%;
}

.provider-key-row :deep(.n-input),
.provider-key-row :deep(.n-base-selection),
.search-key-row :deep(.n-input),
.search-key-row :deep(.n-base-selection) {
  flex: 1 1 auto;
  min-width: 0;
}

.provider-key-row :deep(.n-input),
.provider-key-row :deep(.n-base-selection) {
  background: #080f18 !important;
  border: 2px solid #1c3645 !important;
  border-radius: 0 !important;
  transition: all 0s;
}

.search-key-row :deep(.n-input),
.search-key-row :deep(.n-base-selection) {
  background: #07131c !important;
  border: 2px solid #173649 !important;
  border-radius: 0 !important;
  transition: all 0s;
}

.panel-form :deep(.n-form-item-label__text) {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  letter-spacing: 0.045em;
  color: #4a7587;
}

.panel-form :deep(.n-form-item) {
  margin-bottom: 0;
  padding-top: 0.8rem;   /* 增加顶部留白 */
  padding-bottom: 0.8rem; /* 增加底部留白 */
}

.provider-key-row :deep(.n-input .n-input-wrapper),
.provider-key-row :deep(.n-base-selection .n-base-selection-label),
.search-key-row :deep(.n-input .n-input-wrapper),
.search-key-row :deep(.n-base-selection .n-base-selection-label) {
  min-height: 38px;
}

.provider-key-row :deep(.n-input:hover),
.provider-key-row :deep(.n-base-selection:hover),
.provider-key-row :deep(.n-base-selection--active),
.provider-key-row :deep(.n-input--focus) {
  background: #0b1522 !important;
  border-color: #00e5ff !important;
}

.config-control {
  background: transparent !important;
  border: none !important;
  border-bottom: 2px solid #1c3645 !important;
  border-radius: 2px !important;
  box-shadow: none !important;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.config-control--input {
  background: #080f18 !important;
}

.search-key-row .config-control,
.settings-panel--plugins .config-control,
.export-select.config-control {
  background: #07131c !important;
}

.config-control:hover {
  border-bottom-color: #00e5ff !important;
  background: #0b1522 !important;
}

.config-control:focus-within,
.config-control--input.n-input--focus,
.config-control--select.n-base-selection--focus,
.config-control--select.n-base-selection--active {
  border-bottom-color: #00e5ff !important;
  background: #0b1522 !important;
}

.config-control--select :deep(.n-base-selection__border),
.config-control--select :deep(.n-input__border),
.config-control--select :deep(.n-input-wrapper),
.config-control--input :deep(.n-input__border),
.config-control--input :deep(.n-input-wrapper) {
  border: none !important;
  box-shadow: none !important;
}

.config-control--select :deep(.n-base-selection__state-border),
.config-control--select :deep(.n-input__state-border),
.config-control--input :deep(.n-input__state-border) {
  border: none !important;
}

.config-control--select :deep(.n-base-selection-label),
.config-control--input :deep(.n-input-wrapper) {
  min-height: 38px;
  background: transparent !important;
}
/* 赛博朋克按钮体系（完全摒弃 rgba 圆角） */
.tech-action-btn, .tech-execute-btn, .tech-kill-btn {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  display: inline-flex;
  border: 2px solid transparent;
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
}
.tech-action-btn:hover:not(:disabled) {
  background: #00e5ff;
  color: #000;
}
.tech-action-btn.pinging {
  background: #ff9900;
  color: #000;
  border-color: #ff9900;
}
.tech-action-btn.success {
  background: #00ff66;
  color: #000;
  border-color: #00ff66;
}

/* 执行转储：大尺寸机械感 */
.tech-execute-btn {
  height: 40px;
  padding: 0 1.25rem;
  background: #00e5ff;
  color: #000;
  border-color: #00e5ff;
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
}
.tech-execute-btn:hover:not(:disabled) {
  background: #fff;
  box-shadow: 0 0 10px #00e5ff;
}

/* 危险终端终止按钮 */
.tech-kill-btn {
  height: 44px;
  background: #ff0055;
  color: #fff;
  border-color: #ff0055;
  clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);
  letter-spacing: 0.08em;
}
.tech-kill-btn:hover {
  background: #ff4488;
  box-shadow: 0 0 15px rgba(255, 0, 85, 0.5);
}
.tech-kill-btn.full-width { width: 100%; }

.btn-icon { width: 18px; height: 18px; }

/* 纯色告警块 */
.warning-box.solid-warning {
  background: #1c0a10;
  border-left: 6px solid #ff0055;
  border-top: 2px solid #3d1521;
  border-right: 2px solid #3d1521;
  border-bottom: 2px solid #3d1521;
  padding: 1rem;
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: 3rem;
}
.warning-icon { color: #ff0055; width: 28px; height: 28px; }
.warning-title { color: #ff0055; font-weight: bold; margin-bottom: 0.2rem !important; }
.warning-text p { margin: 0; color: #a86a77; font-family: var(--font-mono); font-size: 0.7rem; }

.security-panel-content {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
}

/* 终端风格辅助文本 */
.terminal-hint {
  margin-top: 0.5rem;
  font-size: 0.63rem;
  letter-spacing: 0.03em;
  line-height: 1.35;
  color: #3b6273;
  font-family: var(--font-mono);
}

.ping-text {
  display: inline-block;
  min-width: 40px;
  text-align: center;
}

@media (max-width: 1200px) {
  .settings-panel :deep(.fui-card-body) {
    padding: 1rem;
  }

  .form-grid-2 {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .dashboard-page {
    padding: 0.75rem;
  }

  .summary-strip {
    margin-bottom: 0.9rem;
  }

  .input-with-ping,
  .export-row {
    flex-direction: column;
    align-items: stretch;
  }

  .tech-action-btn,
  .tech-execute-btn {
    width: 100%;
    min-width: 0;
  }

  .terminal-hint {
    margin-top: 0.45rem;
  }
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* 滚动条深色工业化 */
.dashboard-page::-webkit-scrollbar { width: 4px; }
.dashboard-page::-webkit-scrollbar-track { background: #000; }
.dashboard-page::-webkit-scrollbar-thumb { background: #1a3a4f; }
.dashboard-page::-webkit-scrollbar-thumb:hover { background: #00e5ff; }
</style>