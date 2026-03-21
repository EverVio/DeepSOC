<!--
  组件职责：渲染攻击拓扑 3D 场景并响应拓扑数据变化。
  业务模块：可视化拓扑模块
  主要数据流：topology 数据 -> Three.js 场景更新 -> WebGL 画面
-->

<template>
  <div ref="mountRef" class="topology-scene"></div>
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

const severityColor = {
  high: 0xff0055,
  medium: 0xff6a00,
  low: 0x00e5ff,
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

  while (networkGroup.children.length) {
    const child = networkGroup.children[networkGroup.children.length - 1]
    networkGroup.remove(child)

    if (child.geometry) child.geometry.dispose()
    disposeMaterial(child.material)
  }

  pulseNode = null
  linkVectors = []
  activeLinkIndex = 0
  particleT = 0
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

  const nodes = props.topology?.nodes || []
  const links = props.topology?.links || []

  const usableNodes = nodes.length
    ? nodes
    : [
        { id: 'core', name: 'DeepSOC Core', type: 'core', x: 0, y: 0, z: 0 },
        { id: 'n1', name: 'Nginx', type: 'source', x: -18, y: 4, z: 12 },
        { id: 'n2', name: 'Kafka', type: 'source', x: 22, y: -5, z: 8 },
        { id: 'n3', name: 'Windows', type: 'source', x: 8, y: 7, z: -20 },
      ]

  const nodeMap = new Map()
  usableNodes.forEach((node, idx) => {
    nodeMap.set(node.id, ensureVector(node, idx, usableNodes.length))
  })

  usableNodes.forEach((node, idx) => {
    const pos = ensureVector(node, idx, usableNodes.length)
    const type = node.type || 'source'

    let color = 0x00e5ff
    let radius = 0.42

    if (type === 'core') {
      color = 0x00ff9d
      radius = 0.85
    } else if (type === 'category') {
      color = 0x7b2cbf
      radius = 0.55
    }

    const geometry = new THREE.SphereGeometry(radius, 18, 18)
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.copy(pos)
    networkGroup.add(mesh)

    const glowGeometry = new THREE.SphereGeometry(radius * 1.75, 12, 12)
    const glowMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial)
    glowMesh.position.copy(pos)
    networkGroup.add(glowMesh)
  })

  const usableLinks = links.length
    ? links
    : [
        { source: 'core', target: 'n1', severity: 'medium', weight: 12 },
        { source: 'core', target: 'n2', severity: 'high', weight: 16 },
        { source: 'core', target: 'n3', severity: 'low', weight: 10 },
      ]

  usableLinks.forEach((link) => {
    const from = nodeMap.get(link.source)
    const to = nodeMap.get(link.target)
    if (!from || !to) return

    const points = [from, to]
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const color = severityColor[link.severity] || 0x00e5ff
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.6,
    })

    const line = new THREE.Line(geometry, material)
    networkGroup.add(line)

    linkVectors.push({ from: from.clone(), to: to.clone(), color })
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

const animate = () => {
  frameId = requestAnimationFrame(animate)

  if (networkGroup) {
    networkGroup.rotation.y += 0.0028
    networkGroup.rotation.x = Math.sin(Date.now() * 0.00026) * 0.08
  }

  if (pulseNode && linkVectors.length > 0) {
    const activeLink = linkVectors[activeLinkIndex % linkVectors.length]
    pulseNode.material.color.setHex(activeLink.color)

    particleT += 0.014
    if (particleT >= 1) {
      particleT = 0
      activeLinkIndex += 1
    }

    pulseNode.position.lerpVectors(activeLink.from, activeLink.to, particleT)
    const pulse = 0.6 + Math.sin(Date.now() * 0.012) * 0.18
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

.topology-scene :deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
  position: absolute;
  top: 0;
  left: 0;
}

</style>
