<template>
  <n-layout has-sider class="chat-page-layout">
    <n-layout-sider class="chat-page-sider" :width="292" bordered>
      <div class="chat-page-sider-inner">
        <SocSidebar
          :search-query="searchQuery"
          :filtered-sessions="filteredSessions"
          :current-session="currentSession"
          @update:search-query="searchQuery = $event"
          @select-session="handleSelectSession"
          @delete-session="handleDeleteSession"
          @create-session="handleCreateSession"
          @clear-history="handleClearHistory"
        />
      </div>
    </n-layout-sider>

    <n-layout-content class="chat-page-content">
      <ChatTerminal
        :current-session="currentSession"
        :messages="messages"
        :loading="loading"
        :error="error"
        :on-send-message="handleSendMessage"
        :on-regenerate="handleRegenerate"
        :on-edit-message="handleEditMessage"
        :messages-container-ref="messagesContainerRef"
        :chat-input-ref="chatInputRef"
      />
    </n-layout-content>
  </n-layout>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { NLayout, NLayoutContent, NLayoutSider } from 'naive-ui'
import api from '../api'
import SocSidebar from '../components/layout/SocSidebar.vue'
import { useChatSession } from '../composables/useChatSession'
import ChatTerminal from './Chat.vue'

const messagesContainerRef = ref(null)
const chatInputRef = ref(null)

const {
  searchQuery,
  filteredSessions,
  currentSession,
  messages,
  loading,
  error,
  handleSelectSession,
  handleDeleteSession,
  handleCreateSession,
  handleClearHistory,
  handleSendMessage,
  handleRegenerate,
  handleEditMessage,
  initializeChatSession,
} = useChatSession({
  apiClient: api,
  messagesContainerRef,
  chatInputRef,
})

onMounted(() => {
  initializeChatSession()
})
</script>

<style scoped>
.chat-page-layout {
  width: 100%;
  height: 100%;
  min-height: 0;
  background: transparent;
}

.chat-page-sider {
  background: transparent;
  padding-right: 0.9rem;
}

.chat-page-sider-inner {
  height: 100%;
  min-height: 0;
}

.chat-page-content {
  min-height: 0;
  display: flex;
  flex-direction: column;
}

@media (max-width: 1024px) {
  .chat-page-sider {
    width: 250px !important;
    max-width: 250px;
    padding-right: 0.7rem;
  }
}

@media (max-width: 640px) {
  .chat-page-sider {
    width: 220px !important;
    max-width: 220px;
    padding-right: 0.55rem;
  }
}
</style>
