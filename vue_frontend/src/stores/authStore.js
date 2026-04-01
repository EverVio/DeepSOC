/**
 * 模块职责：维护用户认证状态与登录信息。
 * 业务模块：认证状态模块
 * 主要数据流：登录流程 -> 凭据状态 -> 权限视图
 */

import { defineStore } from 'pinia'

const TOKEN_KEY = 'apiKey'

const getStoredApiKey = () => {
  const storedToken = localStorage.getItem(TOKEN_KEY)
  if (storedToken) return storedToken

  const legacyToken = sessionStorage.getItem(TOKEN_KEY)
  if (!legacyToken) return null

  localStorage.setItem(TOKEN_KEY, legacyToken)
  sessionStorage.removeItem(TOKEN_KEY)
  return legacyToken
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    apiKey: getStoredApiKey(),
  }),

  getters: {
    isAuthenticated: (state) => !!state.apiKey,
  },

  actions: {
    syncFromStorage() {
      this.apiKey = getStoredApiKey()
    },

    setApiKey(apiKey) {
      this.apiKey = apiKey
      localStorage.setItem(TOKEN_KEY, apiKey)
      sessionStorage.removeItem(TOKEN_KEY)
    },

    clearApiKey() {
      this.apiKey = null
      localStorage.removeItem(TOKEN_KEY)
      sessionStorage.removeItem(TOKEN_KEY)
    },

    logout() {
      this.clearApiKey()
    },
  },
})
