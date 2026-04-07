<template>
  <div class="dashboard-page settings-dashboard">
    <n-grid :x-gap="14" :y-gap="14" cols="1 s:1 m:2 l:3" responsive="screen" class="settings-grid">
      
      <n-gi :span="2">
        <FuiCard :title="aiEngineTitle" class="settings-panel" :glow="true">
          <div class="summary-strip">
            <span>STATUS <strong class="ticker-value highlight-green">ONLINE</strong></span>
            <span>PROVIDER <strong class="ticker-value">{{ llmProvider.toUpperCase() }}</strong></span>
            <span>MODE <strong class="ticker-value">SECURE</strong></span>
          </div>

          <NForm label-placement="top" :show-feedback="false" class="panel-form">
            <div class="form-grid-2">
              <NFormItem label="MODEL PROVIDER">
                <NSelect :value="llmProvider" :options="providerOptions" @update:value="updateProvider" />
              </NFormItem>

              <NFormItem label="MODEL NAME">
                <NSelect :value="llmModel" :options="modelOptions" @update:value="updateModel" />
              </NFormItem>
            </div>

            <NFormItem label="PROVIDER API KEY">
              <div class="input-with-ping">
                <NInput
                  type="password"
                  show-password-on="mousedown"
                  :value="providerApiKey"
                  :placeholder="providerApiKeyPlaceholder"
                  :disabled="llmProvider === 'ollama'"
                  @update:value="updateProviderApiKey"
                />
                <button 
                  class="ping-btn" 
                  :class="{ 
                    'pinging': isPingingProvider, 
                    'success': providerPingStatus.endsWith('ms'),
                    'error': providerPingStatus === 'AUTH_ERR' || providerPingStatus === 'TIMEOUT'
                  }"
                  :disabled="llmProvider === 'ollama'"
                  @click="handlePing('provider')"
                >
                  <ActivityIcon class="btn-icon" v-if="!isPingingProvider" />
                  <span class="ping-text">{{ providerPingStatus }}</span>
                </button>
              </div>
              <div class="terminal-hint">
                <span v-if="llmProvider === 'ollama'">> [LOCAL] Ollama 引擎已选择，无需外部鉴权。</span>
                <span v-else>> [SECURE] 核心密钥已加密存储于本地沙盒环境。</span>
              </div>
            </NFormItem>
          </NForm>
        </FuiCard>
      </n-gi>

      <n-gi :span="1">
        <FuiCard :title="pluginsTitle" class="settings-panel">
          <div class="summary-strip">
            <span>MODULE <strong class="ticker-value">WEB_SEARCH</strong></span>
            <span>HEALTH <strong class="ticker-value highlight-green">100%</strong></span>
          </div>

          <NForm label-placement="top" :show-feedback="false" class="panel-form">
            <NFormItem label="WEB SEARCH API KEY">
              <div class="input-with-ping">
                <NInput
                  type="password"
                  show-password-on="mousedown"
                  :value="webSearchApiKey"
                  :placeholder="webSearchApiKeyPlaceholder"
                  @update:value="updateWebSearchApiKey"
                />
                <button 
                  class="ping-btn" 
                  :class="{ 
                    'pinging': isPingingSearch, 
                    'success': searchPingStatus.endsWith('ms'),
                    'error': searchPingStatus === 'AUTH_ERR' || searchPingStatus === 'TIMEOUT'
                  }"
                  @click="handlePing('search')"
                >
                  <ActivityIcon class="btn-icon" v-if="!isPingingSearch" />
                  <span class="ping-text">{{ searchPingStatus }}</span>
                </button>
              </div>
              <div class="terminal-hint">> [SECURE] 搜索引擎授权凭证已隔离。</div>
            </NFormItem>
          </NForm>
        </FuiCard>
      </n-gi>

      <n-gi :span="2">
        <FuiCard :title="dataTitle" class="settings-panel">
          <div class="summary-strip">
            <span>CACHED SESSIONS <strong class="ticker-value highlight-cyan">{{ sessionOptions.length }}</strong></span>
            <span>EXPORT FORMAT <strong class="ticker-value">HTML</strong></span>
          </div>

          <NForm label-placement="top" :show-feedback="false" class="panel-form">
            <NFormItem label="TARGET SESSION DUMP">
              <div class="export-row">
                <NSelect v-model:value="selectedSessionForExport" :options="sessionOptions" placeholder="选择要导出的会话节点" class="export-select" />
                <button 
                  class="sci-fi-btn" 
                  :class="{ 'is-loading': isExporting }" 
                  :disabled="isExporting"
                  @click="handleExportSelectedSession"
                >
                  <DownloadIcon class="btn-icon" />
                  <span>{{ isExporting ? 'DUMPING...' : 'EXECUTE DUMP' }}</span>
                </button>
              </div>
              <div class="terminal-hint">> [INFO] 导出操作将把所选节点的历史流量落盘为本地静态 HTML。</div>
            </NFormItem>
          </NForm>
        </FuiCard>
      </n-gi>

      <n-gi :span="1">
        <FuiCard :title="securityTitle" class="settings-panel" variant="danger">
          <div class="summary-strip">
            <span>AUTH <strong class="ticker-value highlight-red">ACTIVE</strong></span>
            <span>CLEARANCE <strong class="ticker-value">LEVEL_3</strong></span>
          </div>

          <div class="security-panel-content">
            <div class="warning-box">
              <AlertTriangleIcon class="warning-icon" />
              <p>TERMINATING THE CURRENT SESSION WILL FLUSH ALL VOLATILE CREDENTIALS.</p>
            </div>
            
            <button class="sci-fi-btn danger full-width" @click="handleLogoutFromModal">
              <LogoutIcon class="btn-icon" />
              <span>TERMINATE SESSION</span>
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

// --- 打字机乱码动效 ---
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

// --- 基础设置逻辑接入 ---
const router = useRouter()
const chatStore = useChatStore()
const { sessions, currentSession } = storeToRefs(chatStore)

const {
  isExporting,
  selectedSessionForExport,
  llmProvider,
  llmModel,
  providerApiKey,
  webSearchApiKey,
  availableProviders,
  availableModels,
  providerApiKeyPlaceholder,
  webSearchApiKeyPlaceholder,
  updateProvider,
  updateModel,
  updateProviderApiKey,
  updateWebSearchApiKey,
  handleExportSelectedSession,
  handleLogoutFromModal,
} = useChatSettings({
  router,
  apiClient: api,
  currentSession,
  sessions,
})

const sessionOptions = computed(() => (sessions.value || []).map((item) => ({ label: item, value: item })))
const providerOptions = computed(() => (availableProviders || []).map((item) => ({ label: item.label, value: item.value })))
const modelOptions = computed(() => (availableModels.value || []).map((item) => ({ label: item, value: item })))

// --- 真实的 Ping 连通性测试逻辑 (确保这里只声明一次) ---
const isPingingProvider = ref(false)
const providerPingStatus = ref('PING')

const isPingingSearch = ref(false)
const searchPingStatus = ref('PING')

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
        api_key: providerApiKey.value
      })
      providerPingStatus.value = `${res.data.latency_ms}ms`
    } catch (error) {
      // 提取后端的真实错误描述
      const backendErrorMsg = error.response?.data?.error || '网络不可达或超时'
      
      if (error.response && error.response.status === 400) {
        providerPingStatus.value = 'AUTH_ERR'
        message.error(`[ Ping 失败 ] ${backendErrorMsg}`, { duration: 5000 })
      } else {
        providerPingStatus.value = 'TIMEOUT'
        message.error(`[ Ping 超时 ] ${backendErrorMsg}`, { duration: 5000 })
      }
    } finally {
      isPingingProvider.value = false
      setTimeout(() => { providerPingStatus.value = 'PING' }, 5000)
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
        api_key: webSearchApiKey.value
      })
      searchPingStatus.value = `${res.data.latency_ms}ms`
    } catch (error) {
      const backendErrorMsg = error.response?.data?.error || '网络不可达或超时'
      
      if (error.response && error.response.status === 400) {
        searchPingStatus.value = 'AUTH_ERR'
        message.error(`[ Ping 失败 ] ${backendErrorMsg}`, { duration: 5000 })
      } else {
        searchPingStatus.value = 'TIMEOUT'
        message.error(`[ Ping 超时 ] ${backendErrorMsg}`, { duration: 5000 })
      }
    } finally {
      isPingingSearch.value = false
      setTimeout(() => { searchPingStatus.value = 'PING' }, 5000)
    }
  }
}
</script>

<style scoped>
/* === 继承大屏 Dashboard 的全屏自适应底层布局逻辑 === */
.dashboard-page {
  min-height: 0;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0.9rem;
  padding-right: 0.2rem;
  display: flex;
  flex-direction: column;
}

.settings-grid {
  flex: 1;
  min-height: 0;
  height: 100%;
  align-content: stretch;
}

/* 在大屏幕(PC端)下，强制网格划分为上下两行，完美铺满 */
@media (min-width: 1024px) {
  .settings-grid {
    grid-template-rows: minmax(0, 1.1fr) minmax(0, 0.9fr) !important;
  }
}

.settings-grid :deep(.n-gi) {
  min-height: 0;
  display: flex;
  height: 100%;
}

/* 统一面板卡片高度策略：完全填满父容器 */
.settings-panel {
  flex: 1;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.settings-panel :deep(.fui-card-body) {
  display: flex;
  flex-direction: column;
  padding: 0.8rem 1.2rem 1.2rem;
  flex: 1;
  min-height: 0;
}

/* === 数据条 (复用大屏样式) === */
.summary-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 1.2rem;
}

.summary-strip span {
  border: 1px solid rgba(0, 229, 255, 0.22);
  background: rgba(0, 229, 255, 0.08);
  color: #97d7ec;
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.08em;
  padding: 0.15rem 0.4rem;
  display: flex;
  align-items: center;
}

.ticker-value {
  margin-left: 0.3rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.highlight-green { color: #43F3A2; text-shadow: 0 0 6px rgba(67, 243, 162, 0.4); }
.highlight-cyan { color: #00E5FF; text-shadow: 0 0 6px rgba(0, 229, 255, 0.4); }
.highlight-red { color: #FF4975; text-shadow: 0 0 6px rgba(255, 73, 117, 0.4); }

/* === 表单布局 === */
.panel-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  flex: 1;
}

.form-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

.export-row {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.export-select {
  flex: 1;
}

/* === Ping 按钮与输入框组合 === */
.input-with-ping {
  display: flex;
  gap: 0.5rem;
  align-items: stretch;
}

.ping-btn {
  width: 80px;
  flex-shrink: 0;
  background: rgba(0, 229, 255, 0.08);
  border: 1px solid rgba(0, 229, 255, 0.3);
  color: #00E5FF;
  font-family: var(--font-mono);
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ping-btn:hover:not(:disabled) {
  background: rgba(0, 229, 255, 0.15);
  border-color: #00E5FF;
  box-shadow: 0 0 10px rgba(0, 229, 255, 0.2);
}

.ping-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ping-btn.pinging {
  border-color: #FFB34F;
  color: #FFB34F;
  animation: pulse-border 0.8s infinite alternate;
}

.ping-btn.success {
  background: rgba(67, 243, 162, 0.1);
  border-color: #43F3A2;
  color: #43F3A2;
}

.ping-btn.error {
  background: rgba(255, 73, 117, 0.1);
  border-color: #FF4975;
  color: #FF4975;
}

/* === 终端风格提示语 === */
.terminal-hint {
  margin-top: 0.4rem;
  font-size: 0.65rem;
  color: #4a7587;
  font-family: var(--font-mono);
  letter-spacing: 0.06em;
}

/* === 安全面板内容 === */
.security-panel-content {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  flex: 1;
}

.warning-box {
  border: 1px solid rgba(255, 73, 117, 0.3);
  background: rgba(255, 73, 117, 0.05);
  padding: 0.8rem;
  display: flex;
  gap: 0.8rem;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.warning-icon {
  color: #FF4975;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.warning-box p {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.65rem;
  line-height: 1.4;
  color: #e2889e;
  letter-spacing: 0.05em;
}

/* === 覆盖 Naive UI Label 样式 === */
.panel-form :deep(.n-form-item-label) {
  padding-bottom: 0.4rem;
}
.panel-form :deep(.n-form-item-label__text) {
  font-family: var(--font-ui, sans-serif);
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: #89a8ba;
}

/* === 控件玻璃态覆写 === */
.panel-form :deep(.n-base-selection),
.panel-form :deep(.n-input) {
  background: rgba(3, 10, 24, 0.6) !important;
  border: 1px solid rgba(0, 229, 255, 0.2) !important;
  box-shadow: inset 0 0 8px rgba(0, 229, 255, 0.05);
  border-radius: 0;
}

.panel-form :deep(.n-base-selection:hover),
.panel-form :deep(.n-input:hover) {
  border-color: rgba(0, 229, 255, 0.5) !important;
}

.panel-form :deep(.n-base-selection--active),
.panel-form :deep(.n-input--focus) {
  border-color: #00E5FF !important;
  box-shadow: 0 0 10px rgba(0, 229, 255, 0.15) !important;
}

.panel-form :deep(.n-input__input-el),
.panel-form :deep(.n-base-selection-input__content) {
  color: #ccf4ff;
  font-family: var(--font-mono);
  font-size: 0.75rem;
}

/* === 科幻动作按钮 === */
.sci-fi-btn {
  height: 36px;
  padding: 0 1.2rem;
  border: 1px dashed rgba(0, 229, 255, 0.4);
  background: rgba(0, 229, 255, 0.05);
  color: #8fd0e8;
  font-family: var(--font-ui, sans-serif);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  cursor: pointer;
  transition: all 0.25s ease;
  flex-shrink: 0;
}

.sci-fi-btn.full-width {
  width: 100%;
}

.sci-fi-btn:hover:not(:disabled) {
  border-color: rgba(0, 229, 255, 0.9);
  color: #17fefd;
  box-shadow: 0 0 15px rgba(0, 229, 255, 0.2);
}

.sci-fi-btn.is-loading {
  opacity: 0.6;
  cursor: not-allowed;
}

.sci-fi-btn.danger {
  border-color: rgba(255, 73, 117, 0.4);
  background: rgba(255, 73, 117, 0.05);
  color: #ff85a1;
}

.sci-fi-btn.danger:hover {
  border-color: rgba(255, 73, 117, 0.8);
  color: #FF4975;
  box-shadow: 0 0 15px rgba(255, 73, 117, 0.2);
}

.btn-icon {
  width: 16px;
  height: 16px;
  stroke-width: 2px;
}

/* === 滚动条定制 === */
.dashboard-page::-webkit-scrollbar {
  width: 6px;
}
.dashboard-page::-webkit-scrollbar-track {
  background: rgba(0, 229, 255, 0.05);
}
.dashboard-page::-webkit-scrollbar-thumb {
  background: rgba(0, 229, 255, 0.2);
  border-radius: 3px;
}
.dashboard-page::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 229, 255, 0.4);
}

@keyframes pulse-border {
  from { border-color: rgba(255, 179, 79, 0.4); box-shadow: none; }
  to { border-color: #FFB34F; box-shadow: 0 0 10px rgba(255, 179, 79, 0.3); }
}

@media (max-width: 1024px) {
  .export-row {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>