/**
 * 模块职责：统一管理 ECharts 实例生命周期与重绘策略。
 * 业务模块：图表基础能力模块
 * 主要数据流：数据变化/尺寸变化 -> option 更新 -> 图表渲染
 */

import * as echarts from 'echarts'
import { onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'

export function useEcharts(
    buildOption,
    watchSource,
    { deep = true, throttleMs = 80, debounceMs = 160, viewportThreshold = 0.05, onClick = null } = {},
) {
    const chartRef = ref(null)
    let chart = null
    let resizeObserver = null
    let intersectionObserver = null
    let resizeThrottleTimer = null
    let resizeDebounceTimer = null
    let fullscreenSyncTimer = null
    let fullscreenSyncAttempts = 0
    let lastResizeTime = 0
    let isInViewport = false

    const getChartSize = () => {
        const element = chartRef.value
        if (!element) return { width: 0, height: 0 }

        const { width, height } = element.getBoundingClientRect()
        return {
            width: Math.round(width || 0),
            height: Math.round(height || 0),
        }
    }

    const hasUsableSize = () => {
        const { width, height } = getChartSize()
        return width > 0 && height > 0
    }

    const clearFullscreenSyncTimer = () => {
        if (fullscreenSyncTimer) {
            clearTimeout(fullscreenSyncTimer)
            fullscreenSyncTimer = null
        }

        fullscreenSyncAttempts = 0
    }

    const clearResizeTimers = () => {
        clearFullscreenSyncTimer()

        if (resizeThrottleTimer) {
            clearTimeout(resizeThrottleTimer)
            resizeThrottleTimer = null
        }

        if (resizeDebounceTimer) {
            clearTimeout(resizeDebounceTimer)
            resizeDebounceTimer = null
        }
    }

    const scheduleFullscreenSync = () => {
        if (fullscreenSyncTimer) {
            clearTimeout(fullscreenSyncTimer)
        }

        fullscreenSyncTimer = setTimeout(() => {
            fullscreenSyncTimer = null

            if (!chart) return

            if (!hasUsableSize()) {
                fullscreenSyncAttempts += 1
                if (fullscreenSyncAttempts < 20) {
                    scheduleFullscreenSync()
                }
                return
            }

            fullscreenSyncAttempts = 0
            chart.resize()
            chart.setOption(buildOption(), { notMerge: true, lazyUpdate: true, silent: true })
            chart.resize()
        }, 48)
    }

    const setOptionSafe = (
        option,
        { notMerge = true, lazyUpdate = true, silent = true, requireViewport = false } = {},
    ) => {
        if (!chart) return false
        if (requireViewport && !isInViewport) return false
        if (!hasUsableSize()) return false

        chart.setOption(option, { notMerge, lazyUpdate, silent })
        return true
    }

    const renderChart = (force = false) => {
        if (!chart) return

        if (!force && !isInViewport) {
            return
        }

        if (!hasUsableSize()) {
            scheduleFullscreenSync()
            return
        }

        setOptionSafe(buildOption(), { notMerge: true, lazyUpdate: true, silent: true })
    }

    const setPartialOption = (partialOption) => {
        if (!partialOption) return false
        return setOptionSafe(partialOption, {
            notMerge: false,
            lazyUpdate: true,
            silent: true,
            requireViewport: true,
        })
    }

    const resizeChart = () => {
        if (!chart || !isInViewport || !hasUsableSize()) return
        chart.resize()
    }

    const scheduleResize = () => {
        if (!isInViewport) return

        const now = Date.now()
        const elapsed = now - lastResizeTime

        if (elapsed >= throttleMs) {
            lastResizeTime = now
            resizeChart()
        } else if (!resizeThrottleTimer) {
            resizeThrottleTimer = setTimeout(() => {
                resizeThrottleTimer = null
                lastResizeTime = Date.now()
                resizeChart()
            }, throttleMs - elapsed)
        }

        if (resizeDebounceTimer) {
            clearTimeout(resizeDebounceTimer)
        }

        resizeDebounceTimer = setTimeout(() => {
            resizeDebounceTimer = null
            lastResizeTime = Date.now()
            resizeChart()
        }, debounceMs)
    }

    const setupIntersectionObserver = () => {
        if (!chartRef.value) return

        if (typeof IntersectionObserver === 'undefined') {
            isInViewport = true
            renderChart(true)
            scheduleResize()
            return
        }

        intersectionObserver = new IntersectionObserver(
            (entries) => {
                const entry = entries[0]
                if (!entry) return

                isInViewport = entry.isIntersecting
                if (isInViewport) {
                    renderChart(true)
                    scheduleResize()
                }
            },
            {
                threshold: viewportThreshold,
            },
        )

        intersectionObserver.observe(chartRef.value)
    }

    const initChart = () => {
        if (!chartRef.value || chart) return

        chart = echarts.init(chartRef.value)

        if (onClick) {
            chart.on('click', onClick)
        }

        setupIntersectionObserver()

        resizeObserver = new ResizeObserver(() => {
            scheduleResize()
        })
        resizeObserver.observe(chartRef.value)

        renderChart(true)
        scheduleResize()
    }

    const destroyChart = () => {
        if (intersectionObserver) {
            intersectionObserver.disconnect()
            intersectionObserver = null
        }

        if (resizeObserver) {
            resizeObserver.disconnect()
            resizeObserver = null
        }

        clearResizeTimers()

        if (chart) {
            chart.dispose()
            chart = null
        }

        isInViewport = false
    }

    onMounted(() => {
        initChart()

        if (typeof document !== 'undefined') {
            document.addEventListener('fullscreenchange', scheduleFullscreenSync)
        }
    })

    onActivated(() => {
        initChart()
    })

    onDeactivated(() => {
        destroyChart()
    })

    if (watchSource) {
        watch(watchSource, () => renderChart(), { deep })
    }

    onBeforeUnmount(() => {
        if (typeof document !== 'undefined') {
            document.removeEventListener('fullscreenchange', scheduleFullscreenSync)
        }

        destroyChart()
    })

    return {
        chartRef,
        renderChart,
        resizeChart,
        setPartialOption,
    }
}
