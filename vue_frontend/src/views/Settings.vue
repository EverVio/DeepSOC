<!--
  组件职责：系统设置页面，管理参数配置与保存行为。
  业务模块：系统配置模块
  主要数据流：设置表单数据 -> 保存动作 -> 配置状态反馈
-->

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
          <div v-else class="modal-tip">模型 API Key 仅保存在浏览器本地并随请求发送到后端。</div>
        </NFormItem>

        <NFormItem label="WEB SEARCH API KEY">
          <NInput
            type="password"
            show-password-on="mousedown"
            :value="webSearchApiKey"
            :placeholder="webSearchApiKeyPlaceholder"
            @update:value="updateWebSearchApiKey"
          />
          <div class="modal-tip">联网搜索 API Key 仅保存在浏览器本地并随请求发送到后端。</div>
        </NFormItem>

        <div class="modal-actions">
          <NButton type="primary" ghost :loading="isExporting" @click="handleExportSelectedSession">
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
  width: min(960px, 94%);
  height: min(660px, 100%);
  margin-top: 1rem;
  margin-bottom: 2rem;
  background: transparent !important;
  border: none !important;
  position: relative;
  z-index: 1;
}

.settings-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(6, 14, 30, 0.98), rgba(11, 26, 52, 0.98));
  border: 1px solid rgba(137, 168, 186, 0.3);
  box-shadow:
    inset 0 0 20px rgba(0, 0, 0, 0.5),
    0 8px 32px rgba(0, 0, 0, 0.6);
  clip-path: polygon(
    16px 0%, 100% 0%, 100% calc(100% - 16px),
    calc(100% - 16px) 100%, 0% 100%, 0% 16px
  );
  z-index: -1;
}

.settings-card::after{
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0; 
  border: 2px solid rgba(23, 254, 253, 0.45);
  clip-path: polygon(
    16px 0%, 100% 0%, 100% calc(100% - 16px),
    calc(100% - 16px) 100%, 0% 100%, 0% 16px
  );
  box-shadow:
    0 0 20px rgba(23, 254, 253, 0.9),
    0 0 60px rgba(23, 254, 253, 0.25);
  background: transparent;
}

.settings-form :deep(.n-form-item-label) {
  padding-bottom: 0.5rem; 
}

.settings-card :deep(.n-card-header)::after {
  content: '';
  position: absolute;
  top: 0.8rem; /* 放在标题上方 */
  left: 3rem;
  width: 160px; /* 发光条长度 */
  height: 2px;
  background: #17fefd; /* 核心发光色 */
  box-shadow: 0 0 12px #17fefd, 0 0 4px #17fefd;
}

.settings-card :deep(.n-card-header__main) {
  color: #17fefd !important; /* 标题文字也使用蓝绿色 */
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-size: 1.6rem !important; /* 维持上次建议的大小 */
}

.settings-card :deep(.n-card__content) {
  padding: 2rem 4rem !important; /* 拉开左右间距，形成包裹感 */
}

.settings-card :deep(.n-card__action) {
  padding: 1rem 4rem 1.5rem 4rem !important;
  background: rgba(0, 0, 0, 0.2); /* 按钮区域背景稍深 */
  border-top: 1px solid rgba(137, 168, 186, 0.15);
  clip-path: polygon(
    0% 0%, 100% 0%, 100% 100%,
    0% 100% /* 这里不需要切，使用 pseudo ::before 上的切角 */
  );
}

/* 5. 在卡片整体下方增加一个和切角一致的发光底座阴影 */
.settings-card-outer-glow {
  position: absolute;
  bottom: -20px;
  left: 5%;
  width: 90%;
  height: 20px;
  background: transparent;
  box-shadow: 0 10px 30px -5px rgba(23, 254, 253, 0.4);
  filter: blur(10px);
  pointer-events: none;
  z-index: 0;
}

.settings-card :deep(.n-card-header) {
  font-size: 1.5rem;
  padding-top: 2rem;
  padding-left: 3rem;
  border-bottom: 1px solid rgba(137, 168, 186, 0.2);
  position: relative;
}


.settings-form {
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
  padding-top: 1.5rem;
}

.settings-form :deep(.n-form-item-label__text) {
  font-family: var(--font-mono);
  font-size: 0.8rem;
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
  margin-left: 1rem;
  font-size: 0.8rem;
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
  gap: 2rem;
  padding-top: 0.5rem;
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
