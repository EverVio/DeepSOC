import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    apiKey: localStorage.getItem('apiKey') || null,
  }),

  getters: {
    isAuthenticated: (state) => !!state.apiKey,
  },

  actions: {
    setApiKey(apiKey) {
      this.apiKey = apiKey
      localStorage.setItem('apiKey', apiKey)
    },

    clearApiKey() {
      this.apiKey = null
      localStorage.removeItem('apiKey')
    },

    logout() {
      this.clearApiKey()
    },
  },
})
