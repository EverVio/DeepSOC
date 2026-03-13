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
