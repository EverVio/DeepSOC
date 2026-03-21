/**
 * 模块职责：维护应用级 UI 状态与全局开关。
 * 业务模块：全局状态模块
 * 主要数据流：组件交互 -> Store 状态 -> 全局 UI
 */

import { defineStore } from 'pinia'

const DEFAULT_PROVIDER = localStorage.getItem('llmProvider') || 'ollama'
const DEFAULT_MODEL = localStorage.getItem('llmModel') || 'DeepSeek-R1:7b'
const DEFAULT_PROVIDER_API_KEY = localStorage.getItem('providerApiKey') || ''
const DEFAULT_WEB_SEARCH_API_KEY = localStorage.getItem('webSearchApiKey') || ''

export const useAppStore = defineStore('app', {
  state: () => ({
    loading: false,
    error: null,
    useDbSearch: true,
    useWebSearch: false,
    isEditing: false,
    editingMessageId: null,
    isSidebarOpen: true,
    llmProvider: DEFAULT_PROVIDER,
    llmModel: DEFAULT_MODEL,
    providerApiKey: DEFAULT_PROVIDER_API_KEY,
    webSearchApiKey: DEFAULT_WEB_SEARCH_API_KEY,
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

    setSidebarOpen(value) {
      this.isSidebarOpen = value
    },

    toggleSidebar() {
      this.isSidebarOpen = !this.isSidebarOpen
    },

    setLlmProvider(provider) {
      this.llmProvider = provider
      localStorage.setItem('llmProvider', provider)
    },

    setLlmModel(model) {
      this.llmModel = model
      localStorage.setItem('llmModel', model)
    },

    setProviderApiKey(apiKey) {
      this.providerApiKey = apiKey || ''
      localStorage.setItem('providerApiKey', this.providerApiKey)
    },

    clearProviderApiKey() {
      this.providerApiKey = ''
      localStorage.removeItem('providerApiKey')
    },

    setWebSearchApiKey(apiKey) {
      this.webSearchApiKey = apiKey || ''
      localStorage.setItem('webSearchApiKey', this.webSearchApiKey)
    },

    clearWebSearchApiKey() {
      this.webSearchApiKey = ''
      localStorage.removeItem('webSearchApiKey')
    },
  },
})
