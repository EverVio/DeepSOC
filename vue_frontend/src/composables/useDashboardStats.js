import { onBeforeUnmount, onMounted, ref } from 'vue'

const DEFAULT_STATS = {
  summary: {},
  source_counts: [],
  category_counts: [],
  threat_distribution: [],
  timeline: [],
  topology: { nodes: [], links: [] },
}

export function useDashboardStats(apiClient, pollInterval = 25000) {
  const dashboardStats = ref({ ...DEFAULT_STATS })
  const statsLoading = ref(false)
  let timerId = null
  let inFlight = false

  const stopPolling = () => {
    if (timerId) {
      clearInterval(timerId)
      timerId = null
    }
  }

  const loadDashboardStats = async () => {
    if (inFlight) return

    inFlight = true
    statsLoading.value = true
    try {
      const response = await apiClient.getDashboardStats()
      dashboardStats.value = response?.data || dashboardStats.value
    } catch {
      // 忽略瞬时网络抖动，保留上一帧数据
    } finally {
      inFlight = false
      statsLoading.value = false
    }
  }

  const startPolling = () => {
    stopPolling()
    loadDashboardStats()
    timerId = setInterval(loadDashboardStats, pollInterval)
  }

  onMounted(() => {
    startPolling()
  })

  onBeforeUnmount(() => {
    stopPolling()
  })

  return {
    dashboardStats,
    statsLoading,
    loadDashboardStats,
    startPolling,
    stopPolling,
  }
}
