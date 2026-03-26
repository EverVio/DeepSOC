<!--
  组件职责：渲染攻击拓扑 3D 场景并响应拓扑数据变化。
  业务模块：可视化拓扑模块
  主要数据流：topology 数据 -> Three.js 场景更新 -> WebGL 画面
-->

<template>
  <div ref="mountRef" class="topology-scene">
    <div v-show="tooltip.show" class="topology-tooltip" :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }">
      <div class="tooltip-title">{{ tooltip.title }}</div>
      <div v-if="tooltip.type" class="tooltip-type">Type: {{ tooltip.type }}</div>
      <div v-if="tooltip.valueText" class="tooltip-metric">Value: {{ tooltip.valueText }}</div>
      <div v-if="tooltip.degreeText" class="tooltip-metric">Degree: {{ tooltip.degreeText }}</div>
    </div>

    <div class="topology-legend">
      <div class="legend-block">
        <div class="legend-title">NODE TYPES</div>
        <div v-for="item in nodeLegendItems" :key="item.key" class="legend-item">
          <span class="legend-dot" :style="{ backgroundColor: item.color, boxShadow: `0 0 9px ${item.color}` }"></span>
          <span class="legend-label">{{ item.label }}</span>
          <span class="legend-note">{{ item.note }}</span>
        </div>
      </div>

      <div class="legend-block">
        <div class="legend-title">LINK SEVERITY</div>
        <div v-for="item in linkLegendItems" :key="item.key" class="legend-item legend-item--line">
          <span class="legend-line" :style="{ backgroundColor: item.color, opacity: item.opacity }"></span>
          <span class="legend-label">{{ item.label }}</span>
        </div>
        <div class="legend-range">Weight {{ legendStats.minWeight }} - {{ legendStats.maxWeight }}</div>
        <div class="legend-note legend-note--meta">
          Nodes {{ legendStats.renderedNodes }}/{{ legendStats.totalNodes }}
          <span class="legend-divider">|</span>
          Links {{ legendStats.renderedLinks }}/{{ legendStats.totalLinks }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { markRaw, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'

const props = defineProps({
  topology: {
    type: Object,
    default: () => ({ nodes: [], links: [] }),
  },
})

const mountRef = ref(null)

let scene = null
let camera = null
let renderer = null
let networkGroup = null
let frameId = null
let pulseNode = null
let activeLinkIndex = 0
let linkVectors = []
let particleT = 0
let resizeObserver = null
let resizeThrottleTimer = null
let resizeDebounceTimer = null
let lastResizeTime = 0

const RESIZE_THROTTLE_MS = 90
const RESIZE_DEBOUNCE_MS = 180

const tooltip = ref({ show: false, x: 0, y: 0, title: '', type: '', valueText: '', degreeText: '' })
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
const interactiveMeshes = []
let hoveredMesh = null

const MAX_RENDER_NODES = 400
const MAX_RENDER_LINKS = 900
const TOP_TAG_LABEL_COUNT = 14

const NODE_TYPE_STYLE = {
  core: {
    color: 0x00ff9d,
    radius: 0.9,
    glowOpacity: 0.2,
    labelScale: 1.04,
    labelColor: '#ccffe9',
    label: 'CORE',
  },
  db_type: {
    color: 0x00b8ff,
    radius: 0.66,
    glowOpacity: 0.16,
    labelScale: 0.92,
    labelColor: '#d7f2ff',
    label: 'DB TYPE',
  },
  tag: {
    color: 0xff8a2a,
    radius: 0.44,
    glowOpacity: 0.1,
    labelScale: 0.8,
    labelColor: '#ffe5cc',
    label: 'TAG',
  },
}

const LINK_SEVERITY_STYLE = {
  high: { color: 0xff0055, label: 'HIGH', baseOpacity: 0.92 },
  medium: { color: 0xff6a00, label: 'MEDIUM', baseOpacity: 0.72 },
  low: { color: 0x00e5ff, label: 'LOW', baseOpacity: 0.55 },
}

const toCssHex = (hexColor) => `#${Math.round(hexColor).toString(16).padStart(6, '0')}`

const nodeLegendItems = [
  { key: 'core', label: 'CORE', note: 'Always labeled', color: toCssHex(NODE_TYPE_STYLE.core.color) },
  { key: 'db_type', label: 'DB TYPE', note: 'Always labeled', color: toCssHex(NODE_TYPE_STYLE.db_type.color) },
  { key: 'tag', label: 'TAG', note: 'Top-value labels', color: toCssHex(NODE_TYPE_STYLE.tag.color) },
]

const linkLegendItems = [
  {
    key: 'high',
    label: LINK_SEVERITY_STYLE.high.label,
    color: toCssHex(LINK_SEVERITY_STYLE.high.color),
    opacity: LINK_SEVERITY_STYLE.high.baseOpacity,
  },
  {
    key: 'medium',
    label: LINK_SEVERITY_STYLE.medium.label,
    color: toCssHex(LINK_SEVERITY_STYLE.medium.color),
    opacity: LINK_SEVERITY_STYLE.medium.baseOpacity,
  },
  {
    key: 'low',
    label: LINK_SEVERITY_STYLE.low.label,
    color: toCssHex(LINK_SEVERITY_STYLE.low.color),
    opacity: LINK_SEVERITY_STYLE.low.baseOpacity,
  },
]

const legendStats = ref({
  minWeight: 0,
  maxWeight: 0,
  totalNodes: 0,
  renderedNodes: 0,
  totalLinks: 0,
  renderedLinks: 0,
})

const toFiniteNumber = (value, fallback = 0) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

const normalizeNodeType = (rawType) => {
  const value = String(rawType || '').trim().toLowerCase()
  if (value === 'core' || value === 'db_type' || value === 'tag') return value
  if (value === 'category') return 'db_type'
  if (value === 'source') return 'tag'
  return 'tag'
}

const normalizeSeverity = (rawSeverity) => {
  const value = String(rawSeverity || '').trim().toLowerCase()
  return LINK_SEVERITY_STYLE[value] ? value : 'low'
}

const getLinkWeight = (link) => Math.max(1, toFiniteNumber(link?.weight, 1))

const normalizeWeight = (weight, minWeight, maxWeight) => {
  if (maxWeight <= minWeight) return 1
  return (weight - minWeight) / (maxWeight - minWeight)
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const createLabelSprite = (labelText, colorHex, scale = 1) => {
  const text = String(labelText || '').trim().slice(0, 28)
  if (!text) return null

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) return null

  const fontSize = 28
  context.font = `700 ${fontSize}px "Roboto Mono", monospace`
  const metrics = context.measureText(text)
  const paddingX = 22
  const paddingY = 13
  const textWidth = Math.ceil(metrics.width)
  const width = Math.max(120, textWidth + paddingX * 2)
  const height = fontSize + paddingY * 2

  canvas.width = width
  canvas.height = height

  context.font = `700 ${fontSize}px "Roboto Mono", monospace`
  context.textBaseline = 'middle'
  context.clearRect(0, 0, width, height)
  context.fillStyle = 'rgba(5, 8, 20, 0.72)'
  context.fillRect(0, 0, width, height)
  context.strokeStyle = 'rgba(0, 229, 255, 0.3)'
  context.lineWidth = 2
  context.strokeRect(1, 1, width - 2, height - 2)
  context.fillStyle = colorHex
  context.fillText(text, paddingX, height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
  })

  const sprite = new THREE.Sprite(material)
  const heightScale = 1.5 * scale
  const widthScale = (canvas.width / canvas.height) * heightScale
  sprite.scale.set(widthScale, heightScale, 1)
  sprite.renderOrder = 3

  return sprite
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

  const scoreNode = (node) => {
    const typeBonus = node.type === 'core' ? 2_000_000 : node.type === 'db_type' ? 800_000 : 0
    const valueScore = node.value * 15
    const degreeScore = (degreeMap.get(node.id) || 0) * 110
    return typeBonus + valueScore + degreeScore
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

  const rankedNodes = [...normalizedNodes].sort((a, b) => scoreNode(b) - scoreNode(a))
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

const selectTagLabelIds = (nodes, degreeMap) => {
  const rankedTags = (nodes || [])
    .filter((node) => node.type === 'tag')
    .sort((a, b) => {
      const scoreA = a.value * 2 + (degreeMap.get(a.id) || 0) * 12
      const scoreB = b.value * 2 + (degreeMap.get(b.id) || 0) * 12
      return scoreB - scoreA
    })

  return new Set(rankedTags.slice(0, TOP_TAG_LABEL_COUNT).map((node) => node.id))
}

const shouldRenderLabel = (node, tagLabelIds) => {
  if (node.type === 'core' || node.type === 'db_type') return true
  return tagLabelIds.has(node.id)
}

const ensureVector = (node, idx, total) => {
  const fallbackRadius = 24
  const angle = (idx / Math.max(total, 1)) * Math.PI * 2
  return new THREE.Vector3(
    Number.isFinite(node?.x) ? node.x : Math.cos(angle) * fallbackRadius,
    Number.isFinite(node?.y) ? node.y : ((idx % 4) - 1.5) * 3,
    Number.isFinite(node?.z) ? node.z : Math.sin(angle) * fallbackRadius
  )
}

const disposeMaterial = (material) => {
  if (!material) return

  const disposeSingleMaterial = (mat) => {
    if (!mat) return
    for (const key of ['map', 'alphaMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap']) {
      if (mat[key] && typeof mat[key].dispose === 'function') {
        mat[key].dispose()
      }
    }
    if (typeof mat.dispose === 'function') {
      mat.dispose()
    }
  }

  if (Array.isArray(material)) {
    material.forEach((item) => disposeSingleMaterial(item))
    return
  }

  disposeSingleMaterial(material)
}

const clearNetworkGroup = () => {
  if (!networkGroup) return

  if (hoveredMesh) {
    hoveredMesh.scale.set(1, 1, 1)
    hoveredMesh = null
  }

  while (networkGroup.children.length) {
    const child = networkGroup.children[networkGroup.children.length - 1]
    networkGroup.remove(child)

    if (child.geometry) child.geometry.dispose()
    disposeMaterial(child.material)
  }

  pulseNode = null
  linkVectors = []
  interactiveMeshes.length = 0
  activeLinkIndex = 0
  particleT = 0
  tooltip.value.show = false
  tooltip.value.valueText = ''
  tooltip.value.degreeText = ''
}

const disposeSceneResources = () => {
  if (!scene) return

  scene.traverse((object) => {
    if (object.geometry) {
      object.geometry.dispose()
    }
    disposeMaterial(object.material)
  })

  while (scene.children.length) {
    scene.remove(scene.children[0])
  }
}

const buildNetwork = () => {
  if (!networkGroup) return

  clearNetworkGroup()

  const nodes = Array.isArray(props.topology?.nodes) ? props.topology.nodes : []
  const links = Array.isArray(props.topology?.links) ? props.topology.links : []

  const sourceNodes = nodes.length
    ? nodes
    : [
        { id: 'core', name: 'DeepSOC Core', type: 'core', x: 0, y: 0, z: 0, value: 1 },
        { id: 'db_type:ioc', name: 'IOC', type: 'db_type', x: -20, y: 4, z: 14, value: 42 },
        { id: 'db_type:cve', name: 'CVE', type: 'db_type', x: 22, y: -4, z: 10, value: 36 },
        { id: 'tag:scanner', name: 'scanner', type: 'tag', x: -28, y: 2, z: 18, value: 16 },
        { id: 'tag:rce', name: 'rce', type: 'tag', x: 30, y: -1, z: 6, value: 11 },
        { id: 'tag:botnet', name: 'botnet', type: 'tag', x: 17, y: 7, z: -22, value: 9 },
      ]

  const sourceLinks = links.length
    ? links
    : [
        { source: 'core', target: 'db_type:ioc', severity: 'medium', weight: 42 },
        { source: 'core', target: 'db_type:cve', severity: 'high', weight: 36 },
        { source: 'db_type:ioc', target: 'tag:scanner', severity: 'medium', weight: 16 },
        { source: 'db_type:cve', target: 'tag:rce', severity: 'high', weight: 11 },
        { source: 'db_type:ioc', target: 'tag:botnet', severity: 'low', weight: 9 },
      ]

  const { nodes: usableNodes, links: usableLinks, degreeMap } = prioritizeTopology(sourceNodes, sourceLinks)
  const tagLabelIds = selectTagLabelIds(usableNodes, degreeMap)

  const weights = usableLinks.map((link) => link.weight)
  const minWeight = weights.length ? Math.min(...weights) : 0
  const maxWeight = weights.length ? Math.max(...weights) : 0
  legendStats.value = {
    minWeight: Math.round(minWeight * 10) / 10,
    maxWeight: Math.round(maxWeight * 10) / 10,
    totalNodes: sourceNodes.length,
    renderedNodes: usableNodes.length,
    totalLinks: sourceLinks.length,
    renderedLinks: usableLinks.length,
  }

  const nodeMap = new Map()
  usableNodes.forEach((node, idx) => {
    nodeMap.set(node.id, ensureVector(node, idx, usableNodes.length))
  })

  usableNodes.forEach((node, idx) => {
    const pos = ensureVector(node, idx, usableNodes.length)
    const type = normalizeNodeType(node.type)
    const style = NODE_TYPE_STYLE[type] || NODE_TYPE_STYLE.tag
    const degree = degreeMap.get(node.id) || 0

    const geometry = new THREE.SphereGeometry(style.radius, 18, 18)
    const material = new THREE.MeshBasicMaterial({
      color: style.color,
      transparent: true,
      opacity: 0.95,
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.copy(pos)

    mesh.userData = {
      id: node.id,
      name: node.name,
      type: (NODE_TYPE_STYLE[type] || NODE_TYPE_STYLE.tag).label,
      value: node.value,
      degree,
    }
    interactiveMeshes.push(mesh)

    networkGroup.add(mesh)

    const glowGeometry = new THREE.SphereGeometry(style.radius * 1.78, 12, 12)
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: style.color,
      transparent: true,
      opacity: style.glowOpacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial)
    glowMesh.position.copy(pos)
    networkGroup.add(glowMesh)

    if (shouldRenderLabel(node, tagLabelIds)) {
      const labelSprite = createLabelSprite(node.name || node.id, style.labelColor, style.labelScale)
      if (labelSprite) {
        labelSprite.position.copy(pos)
        labelSprite.position.y += style.radius + 0.95
        networkGroup.add(labelSprite)
      }
    }
  })

  usableLinks.forEach((link) => {
    const from = nodeMap.get(link.source)
    const to = nodeMap.get(link.target)
    if (!from || !to) return

    const severity = normalizeSeverity(link.severity)
    const severityStyle = LINK_SEVERITY_STYLE[severity]
    const weight = getLinkWeight(link)
    const normalizedWeight = normalizeWeight(weight, minWeight, maxWeight)

    const points = [from, to]
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const material = new THREE.LineBasicMaterial({
      color: severityStyle.color,
      transparent: true,
      opacity: clamp(severityStyle.baseOpacity * (0.42 + normalizedWeight * 0.72), 0.18, 0.98),
    })

    const line = new THREE.Line(geometry, material)
    networkGroup.add(line)

    const midpoint = from.clone().lerp(to, 0.5)
    const markerRadius = 0.07 + normalizedWeight * 0.2
    const markerGeometry = new THREE.SphereGeometry(markerRadius, 8, 8)
    const markerMaterial = new THREE.MeshBasicMaterial({
      color: severityStyle.color,
      transparent: true,
      opacity: 0.2 + normalizedWeight * 0.52,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const markerMesh = new THREE.Mesh(markerGeometry, markerMaterial)
    markerMesh.position.copy(midpoint)
    networkGroup.add(markerMesh)

    linkVectors.push({
      from: from.clone(),
      to: to.clone(),
      color: severityStyle.color,
      speed: 0.009 + normalizedWeight * 0.022,
      pulseScale: 0.55 + normalizedWeight * 0.52,
      normalizedWeight,
    })
  })

  if (!pulseNode) {
    const pulseGeometry = new THREE.SphereGeometry(0.28, 12, 12)
    const pulseMaterial = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 1,
    })
    pulseNode = new THREE.Mesh(pulseGeometry, pulseMaterial)
    networkGroup.add(pulseNode)
  }
}

const resizeRenderer = () => {
  if (!mountRef.value || !renderer || !camera) return

  const width = mountRef.value.clientWidth
  const height = mountRef.value.clientHeight
  if (!width || !height) return

  camera.aspect = width / Math.max(height, 1)
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

const clearResizeTimers = () => {
  if (resizeThrottleTimer) {
    clearTimeout(resizeThrottleTimer)
    resizeThrottleTimer = null
  }
  if (resizeDebounceTimer) {
    clearTimeout(resizeDebounceTimer)
    resizeDebounceTimer = null
  }
}

const scheduleResize = () => {
  const now = Date.now()
  const elapsed = now - lastResizeTime

  if (elapsed >= RESIZE_THROTTLE_MS) {
    lastResizeTime = now
    resizeRenderer()
  } else if (!resizeThrottleTimer) {
    resizeThrottleTimer = setTimeout(() => {
      resizeThrottleTimer = null
      lastResizeTime = Date.now()
      resizeRenderer()
    }, RESIZE_THROTTLE_MS - elapsed)
  }

  if (resizeDebounceTimer) {
    clearTimeout(resizeDebounceTimer)
  }
  resizeDebounceTimer = setTimeout(() => {
    resizeDebounceTimer = null
    lastResizeTime = Date.now()
    resizeRenderer()
  }, RESIZE_DEBOUNCE_MS)
}

const onPointerMove = (event) => {
  if (!mountRef.value || !camera) return

  const rect = mountRef.value.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

  // 15px offset for tooltip
  tooltip.value.x = event.clientX - rect.left + 15
  tooltip.value.y = event.clientY - rect.top + 15
}

const onPointerLeave = () => {
  mouse.x = 2
  mouse.y = 2

  if (hoveredMesh) {
    hoveredMesh.scale.set(1, 1, 1)
    hoveredMesh = null
  }

  tooltip.value.show = false
  tooltip.value.valueText = ''
  tooltip.value.degreeText = ''
}

const animate = () => {
  frameId = requestAnimationFrame(animate)

  if (networkGroup) {
    networkGroup.rotation.y += 0.0028
    // networkGroup.rotation.x = Math.sin(Date.now() * 0.00026) * 0.08
  }

  if (camera && scene && interactiveMeshes.length > 0) {
    raycaster.setFromCamera(mouse, camera)
    // Account for group rotation
    const intersects = raycaster.intersectObjects(interactiveMeshes, false)

    if (intersects.length > 0) {
      const object = intersects[0].object
      if (hoveredMesh !== object) {
        if (hoveredMesh) hoveredMesh.scale.set(1, 1, 1)
        hoveredMesh = object
        hoveredMesh.scale.set(1.4, 1.4, 1.4)
        tooltip.value.show = true
        tooltip.value.title = object.userData.name || 'Unknown'
        tooltip.value.type = object.userData.type || ''
        tooltip.value.valueText = String(object.userData.value ?? 0)
        tooltip.value.degreeText = String(object.userData.degree ?? 0)
      }
    } else {
      if (hoveredMesh) {
        hoveredMesh.scale.set(1, 1, 1)
        hoveredMesh = null
        tooltip.value.show = false
        tooltip.value.valueText = ''
        tooltip.value.degreeText = ''
      }
    }
  }

  if (pulseNode && linkVectors.length > 0) {
    const activeLink = linkVectors[activeLinkIndex % linkVectors.length]
    pulseNode.material.color.setHex(activeLink.color)

    particleT += activeLink.speed
    if (particleT >= 1) {
      particleT = 0
      activeLinkIndex += 1
    }

    pulseNode.position.lerpVectors(activeLink.from, activeLink.to, particleT)
    pulseNode.material.opacity = clamp(0.45 + activeLink.normalizedWeight * 0.5, 0.35, 1)
    const pulse = activeLink.pulseScale + Math.sin(Date.now() * 0.012) * (0.1 + activeLink.normalizedWeight * 0.15)
    pulseNode.scale.setScalar(pulse)
  }

  if (renderer && scene && camera) renderer.render(scene, camera)
}

onMounted(() => {
  if (!mountRef.value) return

  scene = markRaw(new THREE.Scene())
  scene.fog = new THREE.Fog(0x050814, 55, 135)

  camera = markRaw(new THREE.PerspectiveCamera(52, 1, 0.1, 300))
  camera.position.set(0, 8, 58)

  renderer = markRaw(new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
  }))
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  renderer.setClearColor(0x050814, 0)

  mountRef.value.appendChild(renderer.domElement)

  const ambient = new THREE.AmbientLight(0x5a88ff, 0.55)
  scene.add(ambient)

  const keyLight = new THREE.PointLight(0x00e5ff, 1.05, 190)
  keyLight.position.set(20, 18, 24)
  scene.add(keyLight)

  const sideLight = new THREE.PointLight(0x7b2cbf, 0.8, 160)
  sideLight.position.set(-24, -8, -18)
  scene.add(sideLight)

  const starGeometry = new THREE.BufferGeometry()
  const starCount = 180
  const starPositions = new Float32Array(starCount * 3)
  for (let i = 0; i < starCount; i += 1) {
    starPositions[i * 3 + 0] = (Math.random() - 0.5) * 130
    starPositions[i * 3 + 1] = (Math.random() - 0.5) * 80
    starPositions[i * 3 + 2] = (Math.random() - 0.5) * 130
  }
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))

  const starMaterial = new THREE.PointsMaterial({
    color: 0x5bcfff,
    size: 0.45,
    transparent: true,
    opacity: 0.55,
  })
  const stars = new THREE.Points(starGeometry, starMaterial)
  scene.add(stars)

  networkGroup = markRaw(new THREE.Group())
  scene.add(networkGroup)

  buildNetwork()

  resizeObserver = new ResizeObserver(() => {
    scheduleResize()
  })
  resizeObserver.observe(mountRef.value)
  scheduleResize()
  
  mountRef.value.addEventListener('pointermove', onPointerMove)
  mountRef.value.addEventListener('pointerleave', onPointerLeave)

  animate()
})

watch(
  () => props.topology,
  () => {
    buildNetwork()
  },
  { deep: false }
)

onBeforeUnmount(() => {
  if (mountRef.value) {
    mountRef.value.removeEventListener('pointermove', onPointerMove)
    mountRef.value.removeEventListener('pointerleave', onPointerLeave)
  }

  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  clearResizeTimers()

  if (frameId) {
    cancelAnimationFrame(frameId)
    frameId = null
  }

  clearNetworkGroup()
  disposeSceneResources()

  if (renderer) {
    if (renderer.renderLists && typeof renderer.renderLists.dispose === 'function') {
      renderer.renderLists.dispose()
    }
    renderer.dispose()
    if (typeof renderer.forceContextLoss === 'function') {
      renderer.forceContextLoss()
    }
    if (renderer.domElement && renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement)
    }
  }

  scene = null
  camera = null
  renderer = null
  networkGroup = null
  pulseNode = null
  linkVectors = []
})
</script>

<style scoped>
.topology-scene {
  width: 100%;
  height: 100%;
  min-height: 230px;
  background: radial-gradient(circle at 50% 45%, rgba(0, 229, 255, 0.05), transparent 68%);
  overflow: hidden; 
  position: relative;
}

.topology-tooltip {
  position: absolute;
  pointer-events: none;
  background: rgba(5, 8, 20, 0.92);
  border: 1px solid rgba(0, 229, 255, 0.35);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  padding: 8px 12px;
  border-radius: 4px;
  color: #d8f5ff;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  z-index: 10;
  transform: translate(0, 0);
  white-space: nowrap;
}

.tooltip-title {
  font-weight: 700;
  margin-bottom: 4px;
  color: #00e5ff;
}

.tooltip-type {
  color: #7ba7bc;
  font-size: 0.6rem;
  text-transform: uppercase;
}

.tooltip-metric {
  color: #9ac9db;
  font-size: 0.6rem;
  margin-top: 2px;
}

.topology-legend {
  position: absolute;
  right: 10px;
  bottom: 10px;
  z-index: 9;
  display: flex;
  gap: 8px;
  pointer-events: none;
}

.legend-block {
  min-width: 168px;
  padding: 7px 9px;
  border: 1px solid rgba(0, 229, 255, 0.28);
  border-radius: 5px;
  background: rgba(4, 9, 20, 0.75);
  backdrop-filter: blur(2px);
}

.legend-title {
  color: #b4efff;
  font-family: var(--font-mono);
  font-size: 0.54rem;
  letter-spacing: 0.1em;
  margin-bottom: 6px;
}

.legend-item {
  display: grid;
  grid-template-columns: 10px auto 1fr;
  align-items: center;
  column-gap: 6px;
  margin-bottom: 4px;
}

.legend-item--line {
  grid-template-columns: 22px auto;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.legend-line {
  width: 20px;
  height: 2px;
  border-radius: 2px;
}

.legend-label {
  color: #d4f6ff;
  font-family: var(--font-mono);
  font-size: 0.56rem;
  letter-spacing: 0.05em;
}

.legend-note {
  color: #7fa8b6;
  font-family: var(--font-mono);
  font-size: 0.5rem;
  text-align: right;
}

.legend-range {
  margin-top: 2px;
  color: #9ddbf1;
  font-family: var(--font-mono);
  font-size: 0.52rem;
  letter-spacing: 0.05em;
}

.legend-note--meta {
  margin-top: 2px;
  text-align: left;
}

.legend-divider {
  margin: 0 5px;
  color: rgba(125, 176, 197, 0.75);
}

@media (max-width: 900px) {
  .topology-legend {
    left: 10px;
    right: 10px;
    bottom: 8px;
    flex-direction: column;
  }

  .legend-block {
    min-width: 0;
  }
}

.topology-scene :deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
  position: absolute;
  top: 0;
  left: 0;
}

</style>
