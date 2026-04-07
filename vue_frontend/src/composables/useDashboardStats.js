/**
 * 模块职责：拉取并维护仪表盘统计数据状态。
 * 业务模块：看板数据模块
 * 主要数据流：组件触发 -> 统计请求 -> dashboardStats
 */

import { onMounted, onUnmounted, ref, shallowRef } from 'vue'

const DEFAULT_STATS = {
  summary: {},
  source_counts: [],
  category_counts: [],
  category_quality: [],
  threat_distribution: [],
  timeline: [],
  timeline_slices: [],
  radar_tactics: {
    indicators: [],
    total_values: [],
    verified_values: [],
    items: [],
  },
  topology: { nodes: [], links: [] },
}

export function useDashboardStats(apiClient, pollIntervalMs = 60000) {
  // 使用 shallowRef 避免深层代理开销
  const dashboardStats = shallowRef({ ...DEFAULT_STATS })
  const statsLoading = ref(false)
  let inFlight = false
  let pollTimer = null

  const loadDashboardStats = async (isBackground = false) => {
    if (inFlight) return

    inFlight = true
    if (!isBackground) {
      statsLoading.value = true
    }

    try {
      const response = await apiClient.getDashboardStats()
      dashboardStats.value = response?.data || { ...DEFAULT_STATS }
    } catch (e) {
      console.warn('Failed to load dashboard stats:', e)
    } finally {
      inFlight = false
      if (!isBackground) {
        statsLoading.value = false
      }
    }
  }

  const startPolling = () => {
    if (pollIntervalMs <= 0) return
    stopPolling()
    pollTimer = setInterval(() => {
      loadDashboardStats(true)
    }, pollIntervalMs)
  }

  const stopPolling = () => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  onMounted(() => {
    loadDashboardStats()
    startPolling()
  })

  onUnmounted(() => {
    stopPolling()
  })

  return {
    dashboardStats,
    statsLoading,
    loadDashboardStats,
  }
}
