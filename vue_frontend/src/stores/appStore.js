import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', {
  state: () => ({
    loading: false,
    error: null,
    useDbSearch: true,
    useWebSearch: false,
    isEditing: false,
    editingMessageId: null,
    glossary: {},
    isSidebarOpen: true,
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

    setGlossary(entries) {
      this.glossary = entries || {}
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
  },
})
