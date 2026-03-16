<template>
  <div ref="mountRef" class="topology-scene"></div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
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

const clearNetworkGroup = () => {
  if (!networkGroup) return
  while (networkGroup.children.length) {
    const child = networkGroup.children.pop()
    if (child.geometry) child.geometry.dispose()
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach((mat) => mat.dispose())
      else child.material.dispose()
    }
  }
  linkVectors = []
  activeLinkIndex = 0
  particleT = 0
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

    const geometry = new THREE.BufferGeometry().setFromPoints([from, to])
    const color = severityColor[link.severity] || 0x00e5ff
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 })

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

  camera.aspect = width / Math.max(height, 1)
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

const animate = () => {
  frameId = requestAnimationFrame(animate)

  if (networkGroup) {
    networkGroup.rotation.y += 0.004
    networkGroup.rotation.x = Math.sin(Date.now() * 0.0005) * 0.08
  }

  if (pulseNode && linkVectors.length > 0) {
    const activeLink = linkVectors[activeLinkIndex % linkVectors.length]
    pulseNode.material.color.setHex(activeLink.color)

    particleT += 0.03
    if (particleT >= 1) {
      particleT = 0
      activeLinkIndex += 1
    }

    pulseNode.position.lerpVectors(activeLink.from, activeLink.to, particleT)
    const pulse = 0.6 + Math.sin(Date.now() * 0.025) * 0.18
    pulseNode.scale.setScalar(pulse)
  }

  if (renderer && scene && camera) renderer.render(scene, camera)
}

onMounted(() => {
  if (!mountRef.value) return

  scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0x050814, 55, 135)

  camera = new THREE.PerspectiveCamera(52, 1, 0.1, 300)
  camera.position.set(0, 8, 58)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
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

  networkGroup = new THREE.Group()
  scene.add(networkGroup)

  buildNetwork()
  resizeRenderer()

  resizeObserver = new ResizeObserver(() => {
    resizeRenderer()
  })
  resizeObserver.observe(mountRef.value)
  
  animate()
})

watch(
  () => props.topology,
  () => {
    buildNetwork()
  }
)

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }

  if (frameId) cancelAnimationFrame(frameId)
  clearNetworkGroup()

  if (renderer) {
    renderer.dispose()
    if (renderer.domElement && renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement)
    }
  }

  scene = null
  camera = null
  renderer = null
  networkGroup = null
  pulseNode = null
})
</script>

<style scoped>
.topology-scene {
  width: 100%;
  height: 100%;
  min-height: 230px;
  background: radial-gradient(circle at 50% 45%, rgba(0, 229, 255, 0.05), transparent 68%);
}
</style>
