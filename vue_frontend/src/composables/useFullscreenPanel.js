/**
 * 模块职责：管理面板全屏态与降级弹窗状态。
 * 业务模块：交互状态模块
 * 主要数据流：全屏操作事件 -> 面板状态 -> UI 展示
 */

import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

export function useFullscreenPanel(panelRefMap) {
  const nativePanelKey = ref('')
  const fallbackPanelKey = ref('')

  const entries = computed(() => Object.entries(panelRefMap || {}))

  const resolvePanelFromElement = (activeElement) => {
    if (!activeElement) return ''

    for (const [panelKey, panelRef] of entries.value) {
      const panelElement = panelRef?.value
      if (!panelElement) continue
      if (panelElement === activeElement || panelElement.contains(activeElement)) {
        return panelKey
      }
    }

    return ''
  }

  const syncNativeFullscreenState = () => {
    if (typeof document === 'undefined') return
    nativePanelKey.value = resolvePanelFromElement(document.fullscreenElement)
  }

  const closeFallbackPanel = () => {
    fallbackPanelKey.value = ''
  }

  const closePanel = () => {
    closeFallbackPanel()

    if (typeof document === 'undefined') return
    if (!document.fullscreenElement || typeof document.exitFullscreen !== 'function') return

    document.exitFullscreen()
  }

  const requestNativeFullscreen = (panelKey, panelElement) => {
    const openFallback = () => {
      fallbackPanelKey.value = panelKey
      nativePanelKey.value = ''
    }

    if (typeof document === 'undefined') {
      openFallback()
      return
    }

    const canUseFullscreenApi =
      !!document.fullscreenEnabled && typeof panelElement?.requestFullscreen === 'function'

    if (!canUseFullscreenApi) {
      openFallback()
      return
    }

    const beginRequest = () => {
      const result = panelElement.requestFullscreen()
      if (result && typeof result.then === 'function') {
        result
          .then(() => {
            nativePanelKey.value = panelKey
            fallbackPanelKey.value = ''
          })
          .catch(() => {
            openFallback()
          })
      } else {
        nativePanelKey.value = panelKey
        fallbackPanelKey.value = ''
      }
    }

    if (document.fullscreenElement && document.fullscreenElement !== panelElement && typeof document.exitFullscreen === 'function') {
      const exitResult = document.exitFullscreen()
      if (exitResult && typeof exitResult.then === 'function') {
        exitResult
          .then(() => {
            beginRequest()
          })
          .catch(() => {
            openFallback()
          })
        return
      }
    }

    beginRequest()
  }

  const togglePanel = (panelKey) => {
    const panelRef = panelRefMap?.[panelKey]
    const panelElement = panelRef?.value
    if (!panelElement) return

    if (fallbackPanelKey.value === panelKey) {
      closeFallbackPanel()
      return
    }

    if (nativePanelKey.value === panelKey) {
      closePanel()
      return
    }

    requestNativeFullscreen(panelKey, panelElement)
  }

  const isPanelActive = (panelKey) => nativePanelKey.value === panelKey || fallbackPanelKey.value === panelKey

  onMounted(() => {
    if (typeof document === 'undefined') return
    document.addEventListener('fullscreenchange', syncNativeFullscreenState)
  })

  onBeforeUnmount(() => {
    if (typeof document === 'undefined') return
    document.removeEventListener('fullscreenchange', syncNativeFullscreenState)
  })

  return {
    nativePanelKey,
    fallbackPanelKey,
    togglePanel,
    closePanel,
    closeFallbackPanel,
    isPanelActive,
  }
}
