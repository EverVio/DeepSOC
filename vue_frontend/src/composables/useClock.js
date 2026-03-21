/**
 * 模块职责：提供时钟状态与定时刷新能力。
 * 业务模块：时间工具模块
 * 主要数据流：定时器 -> 当前时间状态 -> 头部/页面显示
 */

import { onBeforeUnmount, onMounted, ref } from 'vue'

export function useClock() {
  const currentTime = ref('')
  let timerId = null

  const updateClock = () => {
    const now = new Date()
    currentTime.value = now.toLocaleTimeString('zh-CN', { hour12: false })
  }

  onMounted(() => {
    updateClock()
    timerId = setInterval(updateClock, 1000)
  })

  onBeforeUnmount(() => {
    if (timerId) {
      clearInterval(timerId)
      timerId = null
    }
  })

  return {
    currentTime,
    updateClock,
  }
}
