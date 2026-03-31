/**
 * 模块职责：管理图表全屏态的分析入口提示状态。
 * 业务模块：图表交互引导模块
 * 主要数据流：全屏状态变化 -> 引导提示显示/消隐 -> 视图渲染
 */

import { onBeforeUnmount, reactive } from 'vue'

const STORAGE_KEY = 'deepSoc.chartDrillGuidanceSeen.v1'
const BANNER_HIDE_MS = 2400
const INTRO_HIDE_MS = 3600

const loadSeenState = () => {
    if (typeof window === 'undefined') {
        return {}
    }

    try {
        return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') || {}
    } catch {
        return {}
    }
}

const persistSeenState = (state) => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function useChartDrillGuidance() {
    const seenState = reactive(loadSeenState())
    const bannerVisible = reactive({})
    const introVisible = reactive({})
    const hideTimers = new Map()
    const introTimers = new Map()

    const clearTimer = (timerMap, key) => {
        const timer = timerMap.get(key)
        if (timer) {
            clearTimeout(timer)
            timerMap.delete(key)
        }
    }

    const clearGuidance = (panelKey) => {
        if (!panelKey) return

        bannerVisible[panelKey] = false
        introVisible[panelKey] = false
        clearTimer(hideTimers, panelKey)
        clearTimer(introTimers, panelKey)
    }

    const showGuidance = (panelKey) => {
        if (!panelKey) return

        clearGuidance(panelKey)
        bannerVisible[panelKey] = true
        hideTimers.set(
            panelKey,
            setTimeout(() => {
                bannerVisible[panelKey] = false
                clearTimer(hideTimers, panelKey)
            }, BANNER_HIDE_MS),
        )

        if (!seenState[panelKey]) {
            seenState[panelKey] = true
            persistSeenState(seenState)
            introVisible[panelKey] = true
            introTimers.set(
                panelKey,
                setTimeout(() => {
                    introVisible[panelKey] = false
                    clearTimer(introTimers, panelKey)
                }, INTRO_HIDE_MS),
            )
        }
    }

    const dismissIntro = (panelKey) => {
        if (!panelKey) return
        introVisible[panelKey] = false
        clearTimer(introTimers, panelKey)
    }

    const isBannerVisible = (panelKey) => Boolean(bannerVisible[panelKey])
    const isIntroVisible = (panelKey) => Boolean(introVisible[panelKey])

    onBeforeUnmount(() => {
        hideTimers.forEach((timer) => clearTimeout(timer))
        introTimers.forEach((timer) => clearTimeout(timer))
        hideTimers.clear()
        introTimers.clear()
    })

    return {
        showGuidance,
        clearGuidance,
        dismissIntro,
        isBannerVisible,
        isIntroVisible,
    }
}
