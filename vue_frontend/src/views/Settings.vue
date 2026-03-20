<template>
  <div class="settings-page">
    <NCard title="SYSTEM CONFIG" class="settings-card" :bordered="false" embedded>
      <NForm label-placement="top" :show-feedback="false" class="settings-form">
        <NFormItem label="EXPORT SESSION">
          <NSelect v-model:value="selectedSessionForExport" :options="sessionOptions" placeholder="选择会话" />
        </NFormItem>

        <NFormItem label="MODEL PROVIDER">
          <NSelect :value="llmProvider" :options="providerOptions" @update:value="updateProvider" />
        </NFormItem>

        <NFormItem label="MODEL NAME">
          <NSelect :value="llmModel" :options="modelOptions" @update:value="updateModel" />
        </NFormItem>

        <NFormItem label="PROVIDER API KEY">
          <NInput
            type="password"
            show-password-on="mousedown"
            :value="providerApiKey"
            :placeholder="providerApiKeyPlaceholder"
            :disabled="llmProvider === 'ollama'"
            @update:value="updateProviderApiKey"
          />
          <div v-if="llmProvider === 'ollama'" class="modal-tip">本地 Ollama 不需要 API Key。</div>
          <div v-else class="modal-tip">API Key 仅保存在当前浏览器本地并随请求发送到后端。</div>
        </NFormItem>

        <NFormItem label="WEB SEARCH API KEY">
          <NInput
            type="password"
            show-password-on="mousedown"
            :value="webSearchApiKey"
            :placeholder="webSearchApiKeyPlaceholder"
            @update:value="updateWebSearchApiKey"
          />
          <div class="modal-tip">联网搜索 API Key 仅保存在当前浏览器本地并随请求发送到后端。</div>
        </NFormItem>

        <div class="modal-actions">
          <NButton type="primary" :loading="isExporting" @click="handleExportSelectedSession">
            <template #icon>
              <DownloadIcon class="btn-icon" />
            </template>
            {{ isExporting ? 'EXPORTING...' : 'EXPORT HTML' }}
          </NButton>

          <NButton type="error" ghost @click="handleLogoutFromModal">
            <template #icon>
              <LogoutIcon class="btn-icon" />
            </template>
            LOGOUT
          </NButton>
        </div>
      </NForm>
    </NCard>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { NButton, NCard, NForm, NFormItem, NInput, NSelect } from 'naive-ui'
import { DownloadIcon, LogoutIcon } from 'vue-tabler-icons'
import api from '../api'
import { useChatSettings } from '../composables/useChatSettings'
import { useChatStore } from '../stores/chatStore'

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
</script>

<style scoped>
.settings-page {
  height: 100%;
  overflow: auto;
  display: grid;
  place-items: start center;
  padding: 0.8rem 0;
}

.settings-card {
  width: min(760px, 100%);
}

.settings-card :deep(.n-card-header) {
  border-bottom: 1px solid rgba(0, 229, 255, 0.18);
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
}

.settings-form :deep(.n-form-item-label__text) {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.11em;
  color: #89a8ba;
}

.settings-form :deep(.n-base-selection),
.settings-form :deep(.n-input-wrapper) {
  background: rgba(3, 10, 24, 0.8);
  border: 1px solid rgba(0, 229, 255, 0.25);
}

.modal-tip {
  margin-top: 0.35rem;
  font-size: 0.58rem;
  color: #7ca4b8;
  font-family: var(--font-mono);
  letter-spacing: 0.04em;
}

.btn-icon {
  width: 14px;
  height: 14px;
  display: block;
  flex-shrink: 0;
  color: currentColor;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.62rem;
  padding-top: 0.2rem;
}

@media (max-width: 1024px) {
  .settings-page {
    padding: 0.3rem 0;
  }

  .modal-actions {
    flex-direction: column;
  }

  .modal-actions :deep(button) {
    width: 100%;
  }
}
</style>
