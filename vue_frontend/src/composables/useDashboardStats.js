/**
 * 模块职责：拉取并维护仪表盘统计数据状态。
 * 业务模块：看板数据模块
 * 主要数据流：组件触发 -> 统计请求 -> dashboardStats
 */

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

    await apiClient.getDashboardStats()
      .then((response) => {
        dashboardStats.value = response?.data || { ...DEFAULT_STATS }
      })
      .finally(() => {
        inFlight = false
        statsLoading.value = false
      })
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
