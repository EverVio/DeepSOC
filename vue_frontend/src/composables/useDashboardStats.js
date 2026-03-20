import { onMounted, ref, shallowRef } from 'vue'

const DEFAULT_STATS = {
  summary: {},
  source_counts: [],
  category_counts: [],
  threat_distribution: [],
  timeline: [],
  topology: { nodes: [], links: [] },
}

export function useDashboardStats(apiClient) {
  // 使用 shallowRef 避免深层代理开销
  const dashboardStats = shallowRef({ ...DEFAULT_STATS })
  const statsLoading = ref(false)
  let inFlight = false

  const loadDashboardStats = async () => {
    if (inFlight) return

    inFlight = true
    statsLoading.value = true

    // 直接请求获取数据
    const response = await apiClient.getDashboardStats()
    dashboardStats.value = response?.data || dashboardStats.value

    inFlight = false
    statsLoading.value = false
  }

  onMounted(() => {
    // 组件挂载时仅执行一次，不再设置 setInterval 定时器
    loadDashboardStats()
  })

  return {
    dashboardStats,
    statsLoading,
    loadDashboardStats,
  }
}