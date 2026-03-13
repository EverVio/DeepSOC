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

  const loadDashboardStats = async () => {
    statsLoading.value = true
    try {
      const response = await apiClient.getDashboardStats()
      dashboardStats.value = response?.data || dashboardStats.value
    } catch {
      // 忽略瞬时网络抖动，保留上一帧数据
    } finally {
      statsLoading.value = false
    }
  }

  onMounted(() => {
    loadDashboardStats()
    timerId = setInterval(loadDashboardStats, pollInterval)
  })

  onBeforeUnmount(() => {
    if (timerId) {
      clearInterval(timerId)
      timerId = null
    }
  })

  return {
    dashboardStats,
    statsLoading,
    loadDashboardStats,
  }
}
