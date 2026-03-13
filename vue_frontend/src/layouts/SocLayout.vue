<template>
  <div class="soc-dashboard">
    <SocHeader
      :current-session="currentSession"
      :current-time="currentTime"
      :is-sidebar-open="isSidebarOpen"
      @toggle-sidebar="toggleSidebar"
      @open-settings="openSettingsModal"
    />

    <main class="soc-main" :class="{ 'sidebar-collapsed': !isSidebarOpen }">
      <aside class="panel-left" v-show="isSidebarOpen">
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
      </aside>

      <section class="panel-center">
        <FuiCard v-if="!isTopologyCollapsed" title="GLOBAL ATTACK TOPOLOGY" class="center-topology-card" :glow="true">
          <template #actions>
            <button class="fui-icon-btn" @click="toggleTopology" title="折叠拓扑图">
              <ChevronUpIcon class="btn-icon" />
            </button>
          </template>
          <TopologyScene :topology="dashboardStats.topology" />
        </FuiCard>

        <div v-else class="topology-collapsed-bar">
          <button class="topology-restore-btn" @click="toggleTopology">
            <ChevronDownIcon class="btn-icon" />
            SHOW GLOBAL ATTACK TOPOLOGY
          </button>
        </div>

        <Chat
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
      </section>

      <aside class="panel-right">
        <SocRightPanel :dashboard-stats="dashboardStats" :stats-loading="statsLoading" />
      </aside>
    </main>

    <div v-if="showSettingsModal" class="fui-modal-overlay" @click.self="closeSettingsModal">
      <FuiCard title="SYSTEM CONFIG" class="fui-modal-card" :clip="18">
        <template #actions>
          <button class="fui-icon-btn" @click="closeSettingsModal"><XIcon class="btn-icon" /></button>
        </template>

        <div class="modal-body">
          <div class="modal-field">
            <label class="modal-label">EXPORT SESSION</label>
            <select class="fui-select" v-model="selectedSessionForExport">
              <option v-for="s in sessions" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>

          <div class="modal-field">
            <label class="modal-label">AI MODEL</label>
            <select class="fui-select" v-model="selectedModel">
              <option v-for="m in availableModels" :key="m" :value="m">{{ m }}</option>
            </select>
          </div>

          <div class="modal-actions">
            <button class="primary" :disabled="isExporting" @click="handleExportSelectedSession">
              <DownloadIcon class="btn-icon" />
              {{ isExporting ? 'EXPORTING...' : 'EXPORT HTML' }}
            </button>
            <button class="danger" @click="handleLogoutFromModal">
              <LogoutIcon class="btn-icon" />
              LOGOUT
            </button>
          </div>
        </div>
      </FuiCard>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronDownIcon, ChevronUpIcon, DownloadIcon, LogoutIcon, XIcon } from 'vue-tabler-icons'
import api from '../api'
import FuiCard from '../components/FuiCard.vue'
import TopologyScene from '../components/TopologyScene.vue'
import SocHeader from '../components/layout/SocHeader.vue'
import SocSidebar from '../components/layout/SocSidebar.vue'
import SocRightPanel from '../components/layout/SocRightPanel.vue'
import { useClock } from '../composables/useClock'
import { useDashboardStats } from '../composables/useDashboardStats'
import { useChatSession } from '../composables/useChatSession'
import { useChatSettings } from '../composables/useChatSettings'
import { useAppStore } from '../stores/appStore'
import Chat from '../views/Chat.vue'

const router = useRouter()
const appStore = useAppStore()
const isTopologyCollapsed = ref(false)
const messagesContainerRef = ref(null)
const chatInputRef = ref(null)

const { currentTime } = useClock()
const { dashboardStats, statsLoading } = useDashboardStats(api)
const {
  searchQuery,
  sessions,
  currentSession,
  messages,
  loading,
  error,
  filteredSessions,
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

const {
  showSettingsModal,
  isExporting,
  selectedSessionForExport,
  selectedModel,
  availableModels,
  openSettingsModal,
  closeSettingsModal,
  handleExportSelectedSession,
  handleLogoutFromModal,
} = useChatSettings({
  router,
  apiClient: api,
  currentSession,
  sessions,
})

const isSidebarOpen = computed(() => appStore.isSidebarOpen)

const toggleSidebar = () => {
  appStore.toggleSidebar()
}

const toggleTopology = () => {
  isTopologyCollapsed.value = !isTopologyCollapsed.value
}

onMounted(() => {
  initializeChatSession()
})
</script>

<style scoped>
.soc-dashboard {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-rows: 52px 1fr;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.soc-main {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(240px, 280px) minmax(480px, 1fr) minmax(280px, 360px);
  gap: 0.9rem;
  padding: 0.85rem;
  overflow: hidden;
}

.soc-main.sidebar-collapsed {
  grid-template-columns: 0 minmax(480px, 1fr) minmax(280px, 360px);
}

.panel-left,
.panel-center,
.panel-right {
  min-height: 0;
}

.panel-left,
.panel-center {
  display: flex;
  flex-direction: column;
}

.panel-center {
  gap: 0.9rem;
  overflow: hidden;
}

.center-topology-card {
  flex: 0 0 40%;
  min-height: 220px;
}

.center-topology-card :deep(.fui-card-body) {
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.topology-collapsed-bar {
  flex-shrink: 0;
  padding: 0.2rem 0;
}

.topology-restore-btn {
  width: 100%;
  height: 34px;
  border: 1px dashed rgba(0, 229, 255, 0.35);
  background: rgba(0, 229, 255, 0.05);
  color: #8fd0e8;
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.topology-restore-btn:hover {
  border-color: rgba(0, 229, 255, 0.62);
  color: var(--neon-cyan);
  box-shadow: inset 0 0 10px rgba(0, 229, 255, 0.12);
}

.panel-right {
  overflow-y: auto;
  padding-right: 0.2rem;
}

.panel-right::-webkit-scrollbar {
  width: 5px;
}

.panel-right::-webkit-scrollbar-thumb {
  background: rgba(0, 229, 255, 0.24);
}

.fui-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(2, 8, 22, 0.72);
  backdrop-filter: blur(4px);
  display: grid;
  place-items: center;
  z-index: 140;
}

.fui-modal-card {
  width: min(520px, calc(100vw - 2rem));
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 0.95rem;
}

.modal-field {
  display: flex;
  flex-direction: column;
  gap: 0.36rem;
}

.modal-label {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.11em;
  color: #89a8ba;
}

.fui-select {
  height: 36px;
  border: 1px solid rgba(0, 229, 255, 0.25);
  background: rgba(3, 10, 24, 0.8);
  color: var(--text-main);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  padding: 0 0.6rem;
}

.fui-select:focus {
  outline: none;
  border-color: rgba(0, 229, 255, 0.52);
}

.fui-icon-btn {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(0, 229, 255, 0.24);
  background: rgba(0, 229, 255, 0.06);
  color: var(--neon-cyan);
  cursor: pointer;
  transition: all 0.2s ease;
}

.fui-icon-btn:hover {
  border-color: rgba(0, 229, 255, 0.52);
  box-shadow: 0 0 10px rgba(0, 229, 255, 0.18);
}

.btn-icon {
  width: 14px;
  height: 14px;
  display: block;
  flex-shrink: 0;
  color: currentColor;
}

.fui-icon-btn :deep(svg),
.fui-icon-btn :deep(svg *),
.modal-actions button :deep(svg),
.modal-actions button :deep(svg *),
.topology-restore-btn :deep(svg),
.topology-restore-btn :deep(svg *) {
  color: currentColor;
  stroke: currentColor;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.62rem;
  padding-top: 0.2rem;
}

.modal-actions button {
  min-width: 132px;
  height: 34px;
  border: 1px solid rgba(0, 229, 255, 0.32);
  background: rgba(0, 229, 255, 0.08);
  color: var(--neon-cyan);
  font-family: var(--font-mono);
  font-size: 0.64rem;
  letter-spacing: 0.1em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.34rem;
  cursor: pointer;
}

.modal-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-actions .primary:hover:not(:disabled) {
  border-color: rgba(0, 229, 255, 0.58);
  box-shadow: 0 0 12px rgba(0, 229, 255, 0.18);
}

.modal-actions .danger {
  color: #ff7ea8;
  border-color: rgba(255, 0, 85, 0.32);
  background: rgba(255, 0, 85, 0.11);
}

.modal-actions .danger:hover {
  border-color: rgba(255, 0, 85, 0.58);
  box-shadow: 0 0 12px rgba(255, 0, 85, 0.2);
}

@media (max-width: 1320px) {
  .soc-main {
    grid-template-columns: minmax(220px, 250px) minmax(420px, 1fr) minmax(240px, 320px);
  }
}

@media (max-width: 1024px) {
  .soc-dashboard {
    grid-template-rows: 48px 1fr;
  }

  .soc-main,
  .soc-main.sidebar-collapsed {
    grid-template-columns: 1fr;
    gap: 0.7rem;
    overflow-y: auto;
  }

  .panel-left,
  .panel-right,
  .panel-center {
    min-height: auto;
  }

  .center-topology-card {
    flex: 0 0 auto;
    min-height: 280px;
  }

  .panel-right {
    overflow: visible;
    padding-right: 0;
  }

  .modal-actions {
    flex-direction: column;
  }

  .modal-actions button {
    width: 100%;
  }
}

@media (max-width: 640px) {
  .soc-main {
    padding: 0.6rem;
    gap: 0.6rem;
  }

  .topology-restore-btn {
    font-size: 0.55rem;
  }
}
</style>
