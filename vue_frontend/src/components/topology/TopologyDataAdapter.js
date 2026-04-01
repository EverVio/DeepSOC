// ─────────────────────────────────────────────
// TopologyDataAdapter.js
// 职责：拓扑原始数据 → 渲染模型数据转换
// 改进：
//  1. risk_level → 视觉权重（颜色、辉光强度、脉冲速度）
//  2. node value → 球体半径缩放（体积编码）
//  3. 多层平面 Y 轴布局（db_type 上层 / tag 中层 / core 中心）
//  4. Bezier 曲线参数预计算（controlOffset）
// ─────────────────────────────────────────────

const MAX_RENDER_NODES = 400
const MAX_RENDER_LINKS = 900
const TOP_TAG_LABEL_COUNT = 14

const toCssHex = (hexColor) => `#${Math.round(hexColor).toString(16).padStart(6, '0')}`

const createNodeStyle = (color, radius, glowOpacity, labelScale, labelColor, label, focusDistance) => ({
    color,
    cssColor: toCssHex(color),
    radius,
    glowOpacity,
    labelScale,
    labelColor,
    label,
    focusDistance,
})

const createLinkStyle = (color, baseOpacity, label) => ({
    color,
    cssColor: toCssHex(color),
    baseOpacity,
    label,
})

// ── 节点类型基础样式 ──────────────────────────────
export const NODE_TYPE_STYLE = {
    core: createNodeStyle(0x00ff9d, 1.2, 0.22, 1.08, '#ccffe9', 'CORE', 34),
    db_type: createNodeStyle(0x00b8ff, 0.75, 0.18, 0.95, '#d7f2ff', 'DB TYPE', 26),
    tag: createNodeStyle(0xff8a2a, 0.52, 0.12, 0.82, '#ffe5cc', 'TAG', 20),
}

// ── 风险等级样式覆盖层（仅影响辉光色 & 脉冲速度倍率）──
// risk_level 字段：critical / high / medium / low / info
export const RISK_LEVEL_STYLE = {
    critical: { glowColor: 0xff1a3a, glowScale: 2.4, pulseMultiplier: 2.2, borderColor: '#ff1a3a' },
    high: { glowColor: 0xff4400, glowScale: 1.9, pulseMultiplier: 1.7, borderColor: '#ff4400' },
    medium: { glowColor: 0xffaa00, glowScale: 1.4, pulseMultiplier: 1.2, borderColor: '#ffaa00' },
    low: { glowColor: null, glowScale: 1.0, pulseMultiplier: 1.0, borderColor: null },
    info: { glowColor: null, glowScale: 0.8, pulseMultiplier: 0.8, borderColor: null },
}

// ── 连线严重程度样式 ──────────────────────────────
export const LINK_SEVERITY_STYLE = {
    high: createLinkStyle(0xff0055, 0.92, 'HIGH'),
    medium: createLinkStyle(0xff6a00, 0.72, 'MEDIUM'),
    low: createLinkStyle(0x00e5ff, 0.55, 'LOW'),
}

// ── 图例定义 ──────────────────────────────────────
export const NODE_LEGEND_ITEMS = [
    { key: 'core', label: 'CORE', note: 'Always labeled', color: NODE_TYPE_STYLE.core.cssColor },
    { key: 'db_type', label: 'DB TYPE', note: 'Always labeled', color: NODE_TYPE_STYLE.db_type.cssColor },
    { key: 'tag', label: 'TAG', note: 'Top-value labels', color: NODE_TYPE_STYLE.tag.cssColor },
]

export const LINK_LEGEND_ITEMS = [
    { key: 'high', label: LINK_SEVERITY_STYLE.high.label, color: LINK_SEVERITY_STYLE.high.cssColor, opacity: LINK_SEVERITY_STYLE.high.baseOpacity },
    { key: 'medium', label: LINK_SEVERITY_STYLE.medium.label, color: LINK_SEVERITY_STYLE.medium.cssColor, opacity: LINK_SEVERITY_STYLE.medium.baseOpacity },
    { key: 'low', label: LINK_SEVERITY_STYLE.low.label, color: LINK_SEVERITY_STYLE.low.cssColor, opacity: LINK_SEVERITY_STYLE.low.baseOpacity },
]

// ── Fallback 演示数据 ─────────────────────────────
export const createFallbackRawTopology = () => ({
    nodes: [
        { id: 'core', name: 'DeepSOC Core', type: 'core', value: 1, risk_level: 'low' },
        { id: 'db_type:ioc', name: 'IOC', type: 'db_type', value: 42, risk_level: 'high' },
        { id: 'db_type:cve', name: 'CVE', type: 'db_type', value: 36, risk_level: 'critical' },
        { id: 'tag:scanner', name: 'scanner', type: 'tag', value: 16, risk_level: 'medium' },
        { id: 'tag:rce', name: 'rce', type: 'tag', value: 11, risk_level: 'high' },
        { id: 'tag:botnet', name: 'botnet', type: 'tag', value: 9, risk_level: 'medium' },
    ],
    links: [
        { source: 'core', target: 'db_type:ioc', severity: 'medium', weight: 42 },
        { source: 'core', target: 'db_type:cve', severity: 'high', weight: 36 },
        { source: 'db_type:ioc', target: 'tag:scanner', severity: 'medium', weight: 16 },
        { source: 'db_type:cve', target: 'tag:rce', severity: 'high', weight: 11 },
        { source: 'db_type:ioc', target: 'tag:botnet', severity: 'low', weight: 9 },
    ],
})

// ── 工具函数 ──────────────────────────────────────
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export const toFiniteNumber = (value, fallback = 0) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
}

export const normalizeNodeType = (rawType) => {
    const value = String(rawType || '').trim().toLowerCase()
    if (value === 'core' || value === 'db_type' || value === 'tag') return value
    if (value === 'category') return 'db_type'
    if (value === 'source') return 'tag'
    return 'tag'
}

export const normalizeSeverity = (rawSeverity) => {
    const value = String(rawSeverity || '').trim().toLowerCase()
    return LINK_SEVERITY_STYLE[value] ? value : 'low'
}

/** 标准化 risk_level 字段 */
export const normalizeRiskLevel = (rawRisk) => {
    const value = String(rawRisk || '').trim().toLowerCase()
    return RISK_LEVEL_STYLE[value] ? value : 'low'
}

export const getNodeStyle = (rawType) => NODE_TYPE_STYLE[normalizeNodeType(rawType)] || NODE_TYPE_STYLE.tag
export const getLinkStyle = (rawSeverity) => LINK_SEVERITY_STYLE[normalizeSeverity(rawSeverity)] || LINK_SEVERITY_STYLE.low
export const getRiskStyle = (rawRisk) => RISK_LEVEL_STYLE[normalizeRiskLevel(rawRisk)] || RISK_LEVEL_STYLE.low
export const getLinkWeight = (link) => Math.max(1, toFiniteNumber(link?.weight, 1))

/**
 * 根据节点 value 和 maxValue 计算球体半径缩放倍率（视觉权重编码）
 * core 节点固定 1.0，db_type 和 tag 节点按 value 在 [0.6, 1.8] 范围线性映射
 */
export const calcRadiusScale = (node, maxValue) => {
    if (node.type === 'core') return 1.0
    if (!maxValue || maxValue <= 0) return 1.0
    const ratio = clamp(toFiniteNumber(node.value, 0) / maxValue, 0, 1)
    return 0.6 + ratio * 1.2
}

/**
 * 多层平面 Y 轴布局：
 *   core    → Y = 0
 *   db_type → Y ∈ [8, 12]  （上层）
 *   tag     → Y ∈ [-8, -3] （下层）
 * X / Z 按环形分散排列
 */
export const calcLayerPosition = (node, index, sameTypeList) => {
    const total = Math.max(sameTypeList.length, 1)
    const rankIdx = sameTypeList.indexOf(node.id)
    const angle = (rankIdx / total) * Math.PI * 2

    if (node.type === 'core') {
        return { x: 0, y: 0, z: 0 }
    }

    if (node.type === 'db_type') {
        const radius = 16 + total * 1.4
        return {
            x: Math.cos(angle) * radius,
            y: 10 + (rankIdx % 2) * 3,
            z: Math.sin(angle) * radius,
        }
    }

    // tag
    const radius = 26 + total * 0.8
    return {
        x: Math.cos(angle) * radius,
        y: -6 - (rankIdx % 3) * 2,
        z: Math.sin(angle) * radius,
    }
}

const normalizeWeight = (weight, minWeight, maxWeight) => {
    if (maxWeight <= minWeight) return 1
    return clamp((weight - minWeight) / (maxWeight - minWeight), 0, 1)
}

const scoreNode = (node, degreeMap) => {
    const typeBonus = node.type === 'core' ? 2_000_000 : node.type === 'db_type' ? 800_000 : 0
    const valueScore = node.value * 15
    const degreeScore = (degreeMap.get(node.id) || 0) * 110
    return typeBonus + valueScore + degreeScore
}

const selectLabelNodeIds = (nodes, degreeMap) => {
    const rankedTags = (nodes || [])
        .filter((node) => node.type === 'tag')
        .sort((a, b) => {
            const scoreA = a.value * 2 + (degreeMap.get(a.id) || 0) * 12
            const scoreB = b.value * 2 + (degreeMap.get(b.id) || 0) * 12
            return scoreB - scoreA
        })

    return new Set(rankedTags.slice(0, TOP_TAG_LABEL_COUNT).map((node) => node.id))
}

const createStats = ({ sourceNodeCount, sourceLinkCount, nodes, links, weights }) => {
    const minWeight = weights.length ? Math.min(...weights) : 0
    const maxWeight = weights.length ? Math.max(...weights) : 0

    return {
        minWeight: Math.round(minWeight * 10) / 10,
        maxWeight: Math.round(maxWeight * 10) / 10,
        totalNodes: sourceNodeCount,
        renderedNodes: nodes.length,
        totalLinks: sourceLinkCount,
        renderedLinks: links.length,
    }
}

const prioritizeTopology = (rawNodes, rawLinks) => {
    const normalizedNodes = []
    const nodeMap = new Map()

    for (const sourceNode of rawNodes || []) {
        const nodeId = sourceNode?.id == null ? '' : String(sourceNode.id)
        if (!nodeId || nodeMap.has(nodeId)) continue

        const normalizedNode = {
            ...sourceNode,
            id: nodeId,
            type: normalizeNodeType(sourceNode.type),
            risk_level: normalizeRiskLevel(sourceNode.risk_level),
            value: Math.max(0, toFiniteNumber(sourceNode.value, 0)),
        }

        normalizedNodes.push(normalizedNode)
        nodeMap.set(nodeId, normalizedNode)
    }

    const normalizedLinks = []
    const degreeMap = new Map()

    for (const sourceLink of rawLinks || []) {
        const sourceId = sourceLink?.source == null ? '' : String(sourceLink.source)
        const targetId = sourceLink?.target == null ? '' : String(sourceLink.target)
        if (!sourceId || !targetId) continue
        if (!nodeMap.has(sourceId) || !nodeMap.has(targetId)) continue

        const normalizedLink = {
            ...sourceLink,
            source: sourceId,
            target: targetId,
            weight: getLinkWeight(sourceLink),
            severity: normalizeSeverity(sourceLink?.severity),
        }

        normalizedLinks.push(normalizedLink)
        degreeMap.set(sourceId, (degreeMap.get(sourceId) || 0) + 1)
        degreeMap.set(targetId, (degreeMap.get(targetId) || 0) + 1)
    }

    if (normalizedNodes.length <= MAX_RENDER_NODES && normalizedLinks.length <= MAX_RENDER_LINKS) {
        return { nodes: normalizedNodes, links: normalizedLinks, degreeMap }
    }

    const selectedNodes = new Map()
    normalizedNodes
        .filter((node) => node.type === 'core')
        .forEach((node) => selectedNodes.set(node.id, node))

    const rankedLinks = [...normalizedLinks].sort((a, b) => b.weight - a.weight)
    for (const link of rankedLinks) {
        if (selectedNodes.size >= MAX_RENDER_NODES) break
        if (selectedNodes.has(link.source) && !selectedNodes.has(link.target)) {
            selectedNodes.set(link.target, nodeMap.get(link.target))
        } else if (selectedNodes.has(link.target) && !selectedNodes.has(link.source)) {
            selectedNodes.set(link.source, nodeMap.get(link.source))
        }
    }

    const rankedNodes = [...normalizedNodes].sort((a, b) => scoreNode(b, degreeMap) - scoreNode(a, degreeMap))
    for (const node of rankedNodes) {
        if (selectedNodes.size >= MAX_RENDER_NODES) break
        if (!selectedNodes.has(node.id)) {
            selectedNodes.set(node.id, node)
        }
    }

    const selectedNodeIds = new Set(selectedNodes.keys())
    const reducedLinks = rankedLinks
        .filter((link) => selectedNodeIds.has(link.source) && selectedNodeIds.has(link.target))
        .slice(0, MAX_RENDER_LINKS)

    const reducedDegreeMap = new Map()
    for (const node of selectedNodes.values()) {
        reducedDegreeMap.set(node.id, 0)
    }
    for (const link of reducedLinks) {
        reducedDegreeMap.set(link.source, (reducedDegreeMap.get(link.source) || 0) + 1)
        reducedDegreeMap.set(link.target, (reducedDegreeMap.get(link.target) || 0) + 1)
    }

    return {
        nodes: [...selectedNodes.values()],
        links: reducedLinks,
        degreeMap: reducedDegreeMap,
    }
}

export const buildTopologyModel = (topology = {}, options = {}) => {
    const fallbackTopology = createFallbackRawTopology()
    const sourceTopology = {
        nodes: Array.isArray(topology?.nodes) && topology.nodes.length ? topology.nodes : fallbackTopology.nodes,
        links: Array.isArray(topology?.links) && topology.links.length ? topology.links : fallbackTopology.links,
    }

    const normalized = prioritizeTopology(sourceTopology.nodes, sourceTopology.links)
    const labelNodeIds = selectLabelNodeIds(normalized.nodes, normalized.degreeMap)

    // ── 按类型分组，用于多层布局 ──
    const typeGroups = { core: [], db_type: [], tag: [] }
    for (const node of normalized.nodes) {
        typeGroups[node.type]?.push(node.id)
    }

    // ── 计算最大 value 用于半径缩放 ──
    const maxValue = normalized.nodes.reduce((m, n) => Math.max(m, n.value || 0), 0)

    const nodesWithDegree = normalized.nodes.map((node) => {
        const degree = normalized.degreeMap.get(node.id) || 0
        const riskStyle = getRiskStyle(node.risk_level)
        const radiusScale = calcRadiusScale(node, maxValue)

        // 如果节点没有显式坐标，则使用多层布局计算坐标
        const hasCoords = Number.isFinite(node.x) && Number.isFinite(node.y) && Number.isFinite(node.z)
        const layerPos = hasCoords ? { x: node.x, y: node.y, z: node.z } : calcLayerPosition(node, 0, typeGroups[node.type] || [])

        return {
            ...node,
            ...layerPos,
            degree,
            riskStyle,
            radiusScale,
        }
    })

    const weights = normalized.links.map((link) => getLinkWeight(link))
    const stats = createStats({
        sourceNodeCount: sourceTopology.nodes.length,
        sourceLinkCount: sourceTopology.links.length,
        nodes: nodesWithDegree,
        links: normalized.links,
        weights,
    })

    return {
        nodes: nodesWithDegree,
        links: normalized.links,
        degreeMap: normalized.degreeMap,
        labelNodeIds,
        stats,
        maxValue,
        options: {
            maxRenderNodes: options.maxRenderNodes || MAX_RENDER_NODES,
            maxRenderLinks: options.maxRenderLinks || MAX_RENDER_LINKS,
            topTagLabelCount: options.topTagLabelCount || TOP_TAG_LABEL_COUNT,
        },
    }
}

export const findNodeByKeyword = (nodes, keyword) => {
    const query = String(keyword || '').trim().toLowerCase()
    if (!query) return null

    const normalizedNodes = Array.isArray(nodes) ? nodes : []
    const exactId = normalizedNodes.find((node) => String(node?.id || '').toLowerCase() === query)
    if (exactId) return exactId

    const exactName = normalizedNodes.find((node) => String(node?.name || '').toLowerCase() === query)
    if (exactName) return exactName

    return (
        normalizedNodes.find((node) => {
            const id = String(node?.id || '').toLowerCase()
            const name = String(node?.name || '').toLowerCase()
            const type = String(node?.type || '').toLowerCase()
            return id.includes(query) || name.includes(query) || type.includes(query)
        }) || null
    )
}

export const getTopologySummaryText = (model) => {
    const stats = model?.stats || {}
    return `Nodes ${stats.renderedNodes || 0}/${stats.totalNodes || 0} · Links ${stats.renderedLinks || 0}/${stats.totalLinks || 0}`
}
