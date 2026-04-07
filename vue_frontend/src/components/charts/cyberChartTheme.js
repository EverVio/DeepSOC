/**
 * 模块职责：提供图表赛博主题配置的复用工具。
 * 业务模块：图表视觉主题模块
 */

const resolveByScreen = (value, fullscreen) => {
    if (Array.isArray(value)) {
        const [forFullscreen, forNormal] = value
        return fullscreen ? forFullscreen : forNormal
    }
    return value
}

export const createCyberTooltip = ({ size = 'md', ...overrides } = {}) => ({
    borderWidth: 0,
    backgroundColor: 'transparent',
    className: `cyber-tooltip cyber-tooltip-${size}`,
    enterable: true,
    transitionDuration: 0.2,
    extraCssText: 'padding:0;box-shadow:none;background:transparent;',
    // 核心修改：将 DOM 挂载到 body，突破所有外层 overflow: hidden 和 z-index 限制
    appendToBody: true,
    ...overrides,
})

export const createNoDataGraphic = (text, fullscreen) => ({
    type: 'text',
    left: 'center',
    top: 'middle',
    style: {
        text,
        fill: '#6f95a9',
        font: fullscreen ? '11px Roboto Mono' : '12px Roboto Mono',
    },
})

export const createHudCornerGraphics = ({
    fullscreen = false,
    left = [14, 10],
    top = [10, 8],
    right = [18, 12],
    bottom = [14, 10],
    lineLength = 30,
    lineHeight = 14,
    colorLeft = 'rgba(0,229,255,0.4)',
    colorRight = 'rgba(0,229,255,0.35)',
    z = 10,
} = {}) => {
    const topLeft = {
        type: 'group',
        left: resolveByScreen(left, fullscreen),
        top: resolveByScreen(top, fullscreen),
        z,
        silent: true,
        children: [
            {
                type: 'line',
                shape: { x1: 0, y1: lineHeight, x2: lineLength, y2: lineHeight },
                style: { stroke: colorLeft, lineWidth: 1 },
            },
            {
                type: 'line',
                shape: { x1: 0, y1: 0, x2: 0, y2: lineHeight },
                style: { stroke: colorLeft, lineWidth: 1 },
            },
        ],
    }

    const bottomRight = {
        type: 'group',
        right: resolveByScreen(right, fullscreen),
        bottom: resolveByScreen(bottom, fullscreen),
        z,
        silent: true,
        children: [
            {
                type: 'line',
                shape: { x1: 0, y1: 0, x2: lineLength, y2: 0 },
                style: { stroke: colorRight, lineWidth: 1 },
            },
            {
                type: 'line',
                shape: { x1: lineLength, y1: 0, x2: lineLength, y2: lineHeight },
                style: { stroke: colorRight, lineWidth: 1 },
            },
        ],
    }

    return [topLeft, bottomRight]
}