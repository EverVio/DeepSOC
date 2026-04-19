/**
 * 模块职责：维护应用级 UI 状态与全局开关。
 * 业务模块：全局状态模块
 * 主要数据流：组件交互 -> Store 状态 -> 全局 UI
 */

import { defineStore } from 'pinia'

const readSensitiveValue = (key) => {
  const storedValue = localStorage.getItem(key)
  if (storedValue !== null) return storedValue

  const legacyValue = sessionStorage.getItem(key)
  if (legacyValue === null) return ''

  localStorage.setItem(key, legacyValue)
  sessionStorage.removeItem(key)
  return legacyValue
}

const DEFAULT_PROVIDER = localStorage.getItem('llmProvider') || 'siliconflow'
const DEFAULT_MODEL = localStorage.getItem('llmModel') || 'DeepSeek-V3.2'
const DEFAULT_EMBEDDING_MODE = localStorage.getItem('embeddingMode') || 'local'
const DEFAULT_EMBEDDING_MODEL = localStorage.getItem('embeddingModel') || 'qwen3-embedding:4b'
const DEFAULT_PROVIDER_API_KEY = readSensitiveValue('providerApiKey')
const DEFAULT_WEB_SEARCH_API_KEY = readSensitiveValue('webSearchApiKey')

export const useAppStore = defineStore('app', {
  state: () => ({
    loading: false,
    error: null,
    runtimeNotice: '',
    useDbSearch: true,
    useWebSearch: false,
    isEditing: false,
    editingMessageId: null,
    llmProvider: DEFAULT_PROVIDER,
    llmModel: DEFAULT_MODEL,
    embeddingMode: DEFAULT_EMBEDDING_MODE,
    embeddingModel: DEFAULT_EMBEDDING_MODEL,
    providerApiKey: DEFAULT_PROVIDER_API_KEY,
    webSearchApiKey: DEFAULT_WEB_SEARCH_API_KEY,
    runtimeProviderApiKeys: {},
    runtimeWebSearchApiKey: '',
    runtimeConfigLoaded: false,
  }),

  actions: {
    setLoading(state) {
      this.loading = state
    },

    setError(message) {
      this.error = message
      if (!message) return

      const currentMessage = message
      setTimeout(() => {
        if (this.error === currentMessage) {
          this.error = null
        }
      }, 3000)
    },

    setRuntimeNotice(message) {
      this.runtimeNotice = message || ''
      if (!this.runtimeNotice) return

      const currentMessage = this.runtimeNotice
      setTimeout(() => {
        if (this.runtimeNotice === currentMessage) {
          this.runtimeNotice = ''
        }
      }, 4500)
    },

    clearRuntimeNotice() {
      this.runtimeNotice = ''
    },

    setUseDbSearch(value) {
      this.useDbSearch = value
    },

    setUseWebSearch(value) {
      this.useWebSearch = value
    },

    setEditing(messageId) {
      this.isEditing = true
      this.editingMessageId = messageId
    },

    clearEditing() {
      this.isEditing = false
      this.editingMessageId = null
    },

    setLlmProvider(provider) {
      this.llmProvider = provider
      localStorage.setItem('llmProvider', provider)
      this.applyRuntimeSensitiveDefaults()
    },

    setLlmModel(model) {
      this.llmModel = model
      localStorage.setItem('llmModel', model)
    },

    setEmbeddingMode(mode) {
      this.embeddingMode = mode
      localStorage.setItem('embeddingMode', mode)
    },

    setEmbeddingModel(model) {
      this.embeddingModel = model
      localStorage.setItem('embeddingModel', model)
    },

    setProviderApiKey(apiKey) {
      this.providerApiKey = apiKey || ''
      localStorage.setItem('providerApiKey', this.providerApiKey)
      sessionStorage.removeItem('providerApiKey')
    },

    clearProviderApiKey() {
      this.providerApiKey = ''
      localStorage.removeItem('providerApiKey')
      sessionStorage.removeItem('providerApiKey')
    },

    setWebSearchApiKey(apiKey) {
      this.webSearchApiKey = apiKey || ''
      localStorage.setItem('webSearchApiKey', this.webSearchApiKey)
      sessionStorage.removeItem('webSearchApiKey')
    },

    clearWebSearchApiKey() {
      this.webSearchApiKey = ''
      localStorage.removeItem('webSearchApiKey')
      sessionStorage.removeItem('webSearchApiKey')
    },

    applyRuntimeSensitiveDefaults() {
      const providerDefaultKey = this.runtimeProviderApiKeys?.[this.llmProvider] || ''
      if (!this.providerApiKey && providerDefaultKey) {
        this.setProviderApiKey(providerDefaultKey)
      }

      if (!this.webSearchApiKey && this.runtimeWebSearchApiKey) {
        this.setWebSearchApiKey(this.runtimeWebSearchApiKey)
      }
    },

    hydrateRuntimeConfig(runtimeConfig) {
      const providerApiKeys = runtimeConfig?.provider_api_keys || {}
      this.runtimeProviderApiKeys = providerApiKeys
      this.runtimeWebSearchApiKey = runtimeConfig?.web_search_api_key || ''
      this.applyRuntimeSensitiveDefaults()
      this.runtimeConfigLoaded = true
    },

    async syncRuntimeConfig(apiClient) {
      if (this.runtimeConfigLoaded) return
      const response = await apiClient.getRuntimeConfig()
      this.hydrateRuntimeConfig(response?.data)
    },

    clearSensitiveKeys() {
      this.clearProviderApiKey()
      this.clearWebSearchApiKey()
      this.clearRuntimeNotice()
      this.runtimeProviderApiKeys = {}
      this.runtimeWebSearchApiKey = ''
      this.runtimeConfigLoaded = false
    },
  },
})
