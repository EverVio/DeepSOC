import { defineStore } from 'pinia'

const DEFAULT_SESSION = '默认对话'

export const useChatStore = defineStore('chat', {
  state: () => ({
    currentSession: localStorage.getItem('currentSession') || DEFAULT_SESSION,
    sessions: JSON.parse(localStorage.getItem('sessions') || '["默认对话"]'),
    messages: {},
  }),

  actions: {
    persistSessions() {
      localStorage.setItem('sessions', JSON.stringify(this.sessions))
    },

    persistCurrentSession() {
      localStorage.setItem('currentSession', this.currentSession)
    },

    addSession(sessionId) {
      if (!this.sessions.includes(sessionId)) {
        this.sessions.push(sessionId)
        this.persistSessions()
      }
      this.setCurrentSession(sessionId)
    },

    setCurrentSession(sessionId) {
      this.currentSession = sessionId
      this.persistCurrentSession()
    },

    removeSession(sessionId) {
      this.sessions = this.sessions.filter((id) => id !== sessionId)
      this.persistSessions()

      if (sessionId === this.currentSession) {
        const nextSession = this.sessions.length > 0 ? this.sessions[0] : DEFAULT_SESSION
        if (this.sessions.length === 0) {
          this.sessions = [DEFAULT_SESSION]
          this.persistSessions()
        }
        this.setCurrentSession(nextSession)
      }
    },

    addMessage(sessionId, isUser, payload) {
      if (!this.messages[sessionId]) {
        this.messages[sessionId] = []
      }

      const newMessage = {
        id: Date.now() + Math.random(),
        isUser,
        content: '',
        think_process: '',
        duration: null,
        ...payload,
        timestamp: new Date(),
      }

      this.messages[sessionId].push(newMessage)
      return newMessage.id
    },

    updateLastMessage(sessionId, payload) {
      if (!this.messages[sessionId] || this.messages[sessionId].length === 0) return

      const lastIndex = this.messages[sessionId].length - 1
      const lastMessage = this.messages[sessionId][lastIndex]

      if (lastMessage.isUser) return

      if (payload.content_chunk) {
        lastMessage.content += payload.content_chunk
      }

      if (payload.think_chunk) {
        if (lastMessage.think_process === null || lastMessage.think_process === undefined) {
          lastMessage.think_process = ''
        }
        lastMessage.think_process += payload.think_chunk
      }

      if (payload.duration) {
        lastMessage.duration = payload.duration
      }
    },

    updateMessageAtIndex(sessionId, messageIndex, payload) {
      if (!this.messages[sessionId] || !this.messages[sessionId][messageIndex]) return

      const message = this.messages[sessionId][messageIndex]

      if (payload.content_chunk) {
        if (!message.content) {
          message.content = ''
        }
        message.content += payload.content_chunk
      }

      if (payload.think_chunk) {
        if (message.think_process === null || message.think_process === undefined) {
          message.think_process = ''
        }
        message.think_process += payload.think_chunk
      }

      if (payload.duration) {
        message.duration = payload.duration
      }
    },

    removeLastMessage(sessionId) {
      if (!this.messages[sessionId] || this.messages[sessionId].length === 0) return

      const lastMessage = this.messages[sessionId][this.messages[sessionId].length - 1]
      if (!lastMessage.isUser) {
        this.messages[sessionId].pop()
      }
    },

    loadHistory(sessionId, historyText) {
      this.messages[sessionId] = []
      if (!historyText) return

      const lines = historyText.split('\n')
      let currentMessage = null

      lines.forEach((line) => {
        if (line.startsWith('用户：')) {
          if (currentMessage) {
            this.addMessage(sessionId, currentMessage.isUser, {
              content: currentMessage.content,
              think_process: null,
              duration: null,
            })
          }

          currentMessage = {
            isUser: true,
            content: line.replace('用户：', '').trim(),
          }
          return
        }

        if (line.startsWith('回复：')) {
          if (currentMessage) {
            this.addMessage(sessionId, currentMessage.isUser, {
              content: currentMessage.content,
              think_process: null,
              duration: null,
            })
          }

          currentMessage = {
            isUser: false,
            content: line.replace('回复：', '').trim(),
          }
        }
      })

      if (currentMessage) {
        this.addMessage(sessionId, currentMessage.isUser, {
          content: currentMessage.content,
          think_process: null,
          duration: null,
        })
      }
    },

    clearSessionMessages(sessionId) {
      this.messages[sessionId] = []
    },
  },
})
