/**
 * 模块职责：维护用户认证状态与登录信息。
 * 业务模块：认证状态模块
 * 主要数据流：登录流程 -> 凭据状态 -> 权限视图
 */

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
