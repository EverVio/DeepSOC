import * as THREE from 'three'
import {
    getLinkStyle,
    getNodeStyle,
} from './TopologyDataAdapter.js'

// ── 工具 ─────────────────────────────────────────
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const lerp = (a, b, t) => a + (b - a) * t
const easeOutCubic = (v) => 1 - Math.pow(1 - v, 3)

const getRiskPulseBias = (riskLevel) => {
    if (riskLevel === 'critical') return 1
    if (riskLevel === 'high') return 0.82
    if (riskLevel === 'medium') return 0.66
    return 0.46
}

const disposeMaterial = (material) => {
    if (!material) return
    const one = (m) => {
        if (!m) return
        for (const k of ['map', 'alphaMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap']) {
            m[k]?.dispose?.()
        }
        m.dispose?.()
    }
    Array.isArray(material) ? material.forEach(one) : one(material)
}

const ensureVector = (node, index, total) => {
    const fallbackRadius = 24
    const angle = (index / Math.max(total, 1)) * Math.PI * 2
    return new THREE.Vector3(
        Number.isFinite(node?.x) ? node.x : Math.cos(angle) * fallbackRadius,
        Number.isFinite(node?.y) ? node.y : ((index % 4) - 1.5) * 3,
        Number.isFinite(node?.z) ? node.z : Math.sin(angle) * fallbackRadius,
    )
}

// ── 贝塞尔曲线生成 ────────────────────────────────
const BEZIER_SEGMENTS = 32

const buildBezierCurve = (from, to) => {
    const dist = from.distanceTo(to)
    const lift = clamp(dist * 0.22, 2, 14)
    const ctrl = new THREE.Vector3(
        (from.x + to.x) / 2 + (Math.random() - 0.5) * dist * 0.14,
        (from.y + to.y) / 2 + lift,
        (from.z + to.z) / 2 + (Math.random() - 0.5) * dist * 0.14,
    )
    return new THREE.QuadraticBezierCurve3(from, ctrl, to)
}

// ── Canvas Sprite ─────────────────────────────────
const createCanvasTextSprite = (text, colorHex, options = {}) => {
    const value = String(text || '').trim().slice(0, 28)
    if (!value) return null
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const fontSize = options.fontSize || 28
    const padX = options.paddingX || 22
    const padY = options.paddingY || 13
    ctx.font = `700 ${fontSize}px "Roboto Mono", monospace`
    const w = Math.max(120, Math.ceil(ctx.measureText(value).width) + padX * 2)
    const h = fontSize + padY * 2
    canvas.width = w; canvas.height = h
    ctx.font = `700 ${fontSize}px "Roboto Mono", monospace`
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(5,8,20,0.72)'; ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(0,229,255,0.3)'; ctx.lineWidth = 2
    ctx.strokeRect(1, 1, w - 2, h - 2)
    ctx.fillStyle = colorHex; ctx.fillText(value, padX, h / 2)
    const tex = new THREE.CanvasTexture(canvas)
    tex.minFilter = tex.magFilter = THREE.LinearFilter
    tex.generateMipmaps = false
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.96, depthWrite: false })
    const sp = new THREE.Sprite(mat)
    const hs = (options.scale || 1) * 1.5
    sp.scale.set((w / h) * hs, hs, 1)
    sp.renderOrder = 3
    return sp
}

// ── 流动粒子配置 ──────────────────────────────────
const FLOW_PARTICLE_COUNT = 8
const FLOW_PARTICLE_RADIUS = 0.17
const LINK_PULSE_TAIL_OFFSET = 0.08
// 扫描光环配置
const SCAN_RING_MAX_RADIUS = 52
const SCAN_RING_INTERVAL = 4200  // ms 完成一圈

export class TopologyRenderer {
    constructor(options = {}) {
        this.options = {
            backgroundColor: 0x050814,
            fogNear: 62, fogFar: 148,
            pixelRatioCap: 1.5,
            rotationSpeed: 0.0026,
            maxRenderNodes: options.maxRenderNodes || 400,
            maxRenderLinks: options.maxRenderLinks || 900,
            topTagLabelCount: options.topTagLabelCount || 14,
            lerpSpeed: 8,          // opacity/scale lerp 速度（per second）
            ...options,
        }

        this.container = null
        this.scene = null
        this.camera = null
        this.renderer = null
        this.networkGroup = null
        this.resizeObserver = null
        this.frameId = null
        this.lastFrameTime = 0

        this.starField = null
        this.deepStarField = null
        this._starPhases = null
        this.nebulaLayers = []

        // 扫描光环
        this.scanRingMesh = null
        this.scanRingT = 0    // 0~1 进度

        // 流动粒子池
        this.flowParticles = []
        this.linkPulses = []

        this.autoRotate = true
        this.isUserInteracting = false
        this.model = null
        this.nodeRecords = []
        this.nodeRecordMap = new Map()
        this.linkRecords = []
        this.adjacencyMap = new Map()
        this.activeNodeState = { hoveredNodeId: '', focusedNodeId: '', pinnedNodeId: '' }
        this.resourceCache = { geometries: new Map(), materials: new Map() }

        // 节点过滤函数（null = 显示全部）
        this.nodeFilter = null

        this.defaultCameraPosition = new THREE.Vector3(0, 10, 62)
        this.defaultCameraTarget = new THREE.Vector3(0, 0, 0)
        this.onTick = null
    }

    // ── 挂载 ─────────────────────────────────────
    mount(container) {
        if (!container) return
        this.container = container
        this.initScene()
        this.initRenderer()
        this.initEnvironment()
        this.startLoop()
        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(() => this.resize())
            this.resizeObserver.observe(container)
        }
        this.resize()
    }

    initScene() {
        this.scene = new THREE.Scene()
        this.scene.fog = new THREE.Fog(this.options.backgroundColor, this.options.fogNear, this.options.fogFar)
        this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 300)
        this.camera.position.copy(this.defaultCameraPosition)
        this.camera.lookAt(this.defaultCameraTarget)
        this.networkGroup = new THREE.Group()
        this.scene.add(this.networkGroup)
    }

    initRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.options.pixelRatioCap))
        this.renderer.setClearColor(this.options.backgroundColor, 0)
        this.renderer.outputColorSpace = THREE.SRGBColorSpace
        this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;position:absolute;inset:0'
        this.container.appendChild(this.renderer.domElement)
    }

    initEnvironment() {
        // 灯光
        this.scene.add(new THREE.AmbientLight(0x5a88ff, 0.55))
        const kl = new THREE.PointLight(0x00e5ff, 1.1, 200)
        kl.position.set(20, 18, 24); this.scene.add(kl)
        const sl = new THREE.PointLight(0x95b6ff, 0.72, 210)
        sl.position.set(-24, -8, -18); this.scene.add(sl)

        // ── 星尘粒子 ──────────────────────────────
        const N = 240
        const pos = new Float32Array(N * 3)
        this._starPhases = new Float32Array(N)
        for (let i = 0; i < N; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 160
            pos[i * 3 + 1] = (Math.random() - 0.5) * 100
            pos[i * 3 + 2] = (Math.random() - 0.5) * 160
            this._starPhases[i] = Math.random() * Math.PI * 2
        }
        const sg = new THREE.BufferGeometry()
        sg.setAttribute('position', new THREE.BufferAttribute(pos, 3))
        this.starField = new THREE.Points(sg, new THREE.PointsMaterial({
            color: 0x5bcfff, size: 0.46, transparent: true, opacity: 0.5,
        }))
        this.scene.add(this.starField)

        const deepGeo = new THREE.BufferGeometry()
        const deepPos = new Float32Array(N * 3)
        for (let i = 0; i < N; i++) {
            deepPos[i * 3] = (Math.random() - 0.5) * 210
            deepPos[i * 3 + 1] = (Math.random() - 0.5) * 140
            deepPos[i * 3 + 2] = (Math.random() - 0.5) * 210
        }
        deepGeo.setAttribute('position', new THREE.BufferAttribute(deepPos, 3))
        this.deepStarField = new THREE.Points(deepGeo, new THREE.PointsMaterial({
            color: 0xa5d4ff, size: 0.28, transparent: true, opacity: 0.2,
        }))
        this.scene.add(this.deepStarField)

        const nebulaGeo = new THREE.PlaneGeometry(130, 130)
        const nebulaDefs = [
            { color: 0x00d8ff, y: -10.5, opacity: 0.08, scale: 1.1 },
            { color: 0x5ea9ff, y: -9.8, opacity: 0.06, scale: 0.88 },
        ]
        this.nebulaLayers = nebulaDefs.map((d, idx) => {
            const mat = new THREE.MeshBasicMaterial({
                color: d.color,
                transparent: true,
                opacity: d.opacity,
                depthWrite: false,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending,
            })
            const mesh = new THREE.Mesh(nebulaGeo, mat)
            mesh.rotation.x = -Math.PI / 2
            mesh.rotation.z = idx * 0.82
            mesh.position.y = d.y
            mesh.scale.setScalar(d.scale)
            this.scene.add(mesh)
            return mesh
        })

        // ── 极坐标网格地面 ─────────────────────────
        const grid = new THREE.PolarGridHelper(40, 8, 4, 64, 0x003a55, 0x001828)
        grid.position.y = -13
        if (Array.isArray(grid.material)) {
            grid.material.forEach(m => { m.transparent = true; m.opacity = 0.25 })
        } else {
            grid.material.transparent = true; grid.material.opacity = 0.25
        }
        this.scene.add(grid)

        // ── 扫描光环（雷达圈）─────────────────────
        // 用 RingGeometry 在 XZ 平面上扫描（y = -12.5，和地面齐）
        const ringGeo = new THREE.RingGeometry(0.01, 0.7, 72)
        // RingGeometry 默认在 XY 平面，需旋转到 XZ
        ringGeo.rotateX(-Math.PI / 2)
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x00e5ff,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        })
        this.scanRingMesh = new THREE.Mesh(ringGeo, ringMat)
        this.scanRingMesh.position.y = -12.5
        this.scanRingMesh.renderOrder = 0
        this.scene.add(this.scanRingMesh)
    }

    // ── 资源缓存 ──────────────────────────────────
    getSphereGeometry(radius, w = 20, h = 20) {
        const key = `sph:${Number(radius).toFixed(2)}:${w}:${h}`
        if (!this.resourceCache.geometries.has(key)) {
            this.resourceCache.geometries.set(key, new THREE.SphereGeometry(radius, w, h))
        }
        return this.resourceCache.geometries.get(key)
    }

    getMaterialTemplate(key, factory) {
        if (!this.resourceCache.materials.has(key)) {
            this.resourceCache.materials.set(key, factory())
        }
        return this.resourceCache.materials.get(key)
    }

    cloneMaterialTemplate(key, factory) {
        return this.getMaterialTemplate(key, factory).clone()
    }

    // ── 模型 setter ───────────────────────────────
    setTopologyModel(model) {
        this.model = model || null
        this.rebuild()
        this.updateHighlightState()
    }

    setAutoRotate(en) { this.autoRotate = Boolean(en) }
    toggleAutoRotate() { this.autoRotate = !this.autoRotate; return this.autoRotate }

    // ── 节点过滤（动画隐藏） ──────────────────────
    /**
     * filterFn: (nodeRecord) => boolean | null（null 清除过滤）
     * 当节点不通过过滤时 tgtScale → 0，否则正常高亮逻辑
     */
    setNodeFilter(filterFn) {
        this.nodeFilter = filterFn || null
        this.updateHighlightState()
    }

    // ── 选中状态 ──────────────────────────────────
    setHoveredNodeId(id) { this.activeNodeState.hoveredNodeId = id || ''; this.updateHighlightState() }
    setFocusedNodeId(id) { this.activeNodeState.focusedNodeId = id || ''; this.updateHighlightState() }
    setPinnedNodeId(id) {
        this.activeNodeState.pinnedNodeId = id || ''
        if (this.activeNodeState.pinnedNodeId) this.activeNodeState.focusedNodeId = id
        this.updateHighlightState()
    }
    clearSelection() {
        this.activeNodeState = { hoveredNodeId: '', focusedNodeId: '', pinnedNodeId: '' }
        this.updateHighlightState()
    }

    getActiveNodeId() {
        return this.activeNodeState.hoveredNodeId
            || this.activeNodeState.pinnedNodeId
            || this.activeNodeState.focusedNodeId || ''
    }
    getActiveNodeRecord() { return this.getNodeRecord(this.getActiveNodeId()) }
    getNodeRecord(id) { return this.nodeRecordMap.get(String(id || '')) || null }

    getNodeWorldPosition(id) {
        const r = this.getNodeRecord(id)
        if (!r?.mesh) return null
        const wp = new THREE.Vector3()
        r.mesh.updateWorldMatrix(true, false)
        r.mesh.getWorldPosition(wp)
        return wp
    }

    projectNodeToScreen(id) {
        if (!this.container || !this.camera) return null
        const wp = this.getNodeWorldPosition(id)
        if (!wp) return null
        const rect = this.renderer?.domElement?.getBoundingClientRect?.()
        if (!rect) return null
        const p = wp.clone().project(this.camera)
        return { x: ((p.x + 1) / 2) * rect.width, y: ((-p.y + 1) / 2) * rect.height }
    }

    getNodeTooltipPayload(nodeId, options = {}) {
        const r = this.getNodeRecord(nodeId)
        if (!r) return null
        const pos = options.position || this.projectNodeToScreen(nodeId)
        return {
            show: true,
            x: Math.round(pos?.x ?? 0), y: Math.round(pos?.y ?? 0),
            title: r.name || r.id,
            type: r.typeLabel || r.type || '',
            valueText: String(r.value ?? 0),
            degreeText: String(r.degree ?? 0),
            riskLevel: r.riskLevel || 'low',
            nodeId: r.id,
            pinnedNodeId: this.activeNodeState.pinnedNodeId,
            focusedNodeId: this.activeNodeState.focusedNodeId,
            hoveredNodeId: this.activeNodeState.hoveredNodeId,
            locked: Boolean(options.locked),
            mode: options.mode || 'hover',
        }
    }

    getNodeByKeyword(kw) {
        const q = String(kw || '').trim().toLowerCase()
        if (!q || !this.model?.nodes?.length) return null
        const ns = this.model.nodes
        return ns.find(n => String(n?.id || '').toLowerCase() === q)
            || ns.find(n => String(n?.name || '').toLowerCase() === q)
            || ns.find(n => [n?.id, n?.name, n?.type].some(v => String(v || '').toLowerCase().includes(q)))
            || null
    }

    // ── 清空图 ────────────────────────────────────
    clearGraph() {
        if (!this.networkGroup) return
        while (this.networkGroup.children.length) {
            const c = this.networkGroup.children[this.networkGroup.children.length - 1]
            this.networkGroup.remove(c)
            c.geometry?.dispose()
            disposeMaterial(c.material)
        }
        this.flowParticles = []
        this.linkPulses = []
        this.nodeRecords = []
        this.nodeRecordMap = new Map()
        this.linkRecords = []
        this.adjacencyMap = new Map()
    }

    // ── 重建拓扑图 ────────────────────────────────
    rebuild() {
        if (!this.networkGroup || !this.model) return
        this.clearGraph()

        const { nodes = [], links = [], labelNodeIds = new Set(), stats = {} } = this.model
        const nodeMap = new Map()
        const nodeLinkMap = new Map()
        const weights = links.map(l => Number(l.weight) || 1)
        const minWeight = stats.minWeight ?? (weights.length ? Math.min(...weights) : 0)
        const maxWeight = stats.maxWeight ?? (weights.length ? Math.max(...weights) : 0)

        // ── 节点 ─────────────────────────────────
        for (const node of nodes) {
            const nodeType = String(node?.type || 'tag')
            const style = getNodeStyle(nodeType)
            const nodeId = String(node.id)
            const degree = Number(node.degree ?? 0)
            const riskStyle = node.riskStyle || {}
            const radiusScale = Number(node.radiusScale ?? 1)
            const riskLevel = node.risk_level || 'low'
            const position = ensureVector(node, this.nodeRecords.length, nodes.length)
            const finalRadius = style.radius * radiusScale

            // 主体球
            const geo = this.getSphereGeometry(finalRadius, 20, 20)
            const mat = this.cloneMaterialTemplate(`node:${nodeType}`, () =>
                new THREE.MeshPhysicalMaterial({
                    color: style.color,
                    transparent: true,
                    opacity: 0.72,
                    roughness: 0.12,
                    metalness: 0.08,
                    transmission: 0.7,
                    ior: 1.22,
                    thickness: 1.2,
                    clearcoat: 1,
                    clearcoatRoughness: 0.2,
                    emissive: new THREE.Color(style.color),
                    emissiveIntensity: 0.22,
                })
            )
            const mesh = new THREE.Mesh(geo, mat)
            mesh.position.copy(position)
            mesh.renderOrder = 2
            mesh.userData = { id: nodeId, name: node.name || nodeId, type: nodeType, typeLabel: style.label, value: node.value, degree }

            const coreMat = this.cloneMaterialTemplate(`node-core:${riskLevel}`, () =>
                new THREE.MeshBasicMaterial({
                    color: riskStyle.glowColor ?? style.color,
                    transparent: true,
                    opacity: clamp(0.42 + getRiskPulseBias(riskLevel) * 0.34, 0.38, 0.9),
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                })
            )
            const coreMesh = new THREE.Mesh(this.getSphereGeometry(finalRadius * 0.52, 14, 14), coreMat)
            coreMesh.position.copy(position)
            coreMesh.renderOrder = 3

            // 辉光球
            const glowColor = riskStyle.glowColor ?? style.color
            const glowOpBase = clamp(style.glowOpacity * (riskStyle.glowScale ?? 1.0), 0.04, 0.62)
            const glowGeo = this.getSphereGeometry(finalRadius * 1.9, 12, 12)
            const glowMat = new THREE.MeshBasicMaterial({
                color: glowColor, transparent: true, opacity: glowOpBase,
                blending: THREE.AdditiveBlending, depthWrite: false,
            })
            const glowMesh = new THREE.Mesh(glowGeo, glowMat)
            glowMesh.position.copy(position); glowMesh.renderOrder = 1

            // 外环光晕（critical / high）
            let auraRing = null
            if (riskLevel === 'critical' || riskLevel === 'high') {
                const auraColor = riskLevel === 'critical' ? 0xff1a3a : 0xff4400
                const auraMat = new THREE.MeshBasicMaterial({
                    color: auraColor, transparent: true, opacity: 0.07,
                    blending: THREE.AdditiveBlending, depthWrite: false,
                })
                auraRing = new THREE.Mesh(this.getSphereGeometry(finalRadius * 1.9 * 1.45, 10, 10), auraMat)
                auraRing.position.copy(position); auraRing.renderOrder = 0
            }

            // 文字标签
            let labelSprite = null
            if (nodeType === 'core' || nodeType === 'db_type' || labelNodeIds.has(nodeId)) {
                labelSprite = createCanvasTextSprite(node.name || nodeId, style.labelColor, { scale: style.labelScale })
                if (labelSprite) { labelSprite.position.copy(position); labelSprite.position.y += finalRadius + 1.1 }
            }

            this.networkGroup.add(mesh, glowMesh, coreMesh)
            if (auraRing) this.networkGroup.add(auraRing)
            if (labelSprite) this.networkGroup.add(labelSprite)

            const record = {
                id: nodeId, type: nodeType, typeLabel: style.label,
                name: node.name || nodeId,
                value: node.value, degree,
                riskLevel, riskStyle, radiusScale, finalRadius,
                mesh, glowMesh, coreMesh, auraRing, labelSprite,
                breathPhase: Math.random() * Math.PI * 2,
                style,
                glowOpBase,
                coreOpBase: coreMat.opacity,

                // ── 动画状态机 ──────────────────
                curOpacity: 0.95, tgtOpacity: 0.95,
                curScale: 0.01, tgtScale: 1.0,     // 从 0 动画弹入
                curGlowOp: glowOpBase, tgtGlowOp: glowOpBase,
                curCoreOp: coreMat.opacity, tgtCoreOp: coreMat.opacity,
                curAuraOp: 0.07, tgtAuraOp: 0.07,
                curLabelOp: 0.96, tgtLabelOp: 0.96,
            }

            this.nodeRecords.push(record)
            this.nodeRecordMap.set(nodeId, record)
            nodeMap.set(nodeId, position)
            nodeLinkMap.set(nodeId, new Set([nodeId]))
        }

        // ── 连线（贝塞尔） ────────────────────────
        for (const link of links) {
            const from = nodeMap.get(String(link.source))
            const to = nodeMap.get(String(link.target))
            if (!from || !to) continue

            const sev = getLinkStyle(link.severity)
            const weight = Number(link.weight) || 1
            const nw = maxWeight <= minWeight ? 1 : clamp((weight - minWeight) / (maxWeight - minWeight), 0, 1)
            const bOp = clamp(sev.baseOpacity * (0.36 + nw * 0.68), 0.14, 0.92)

            const curve = buildBezierCurve(from, to)
            const lineGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(BEZIER_SEGMENTS))
            const lineMat = new THREE.LineBasicMaterial({ color: sev.color, transparent: true, opacity: bOp })
            const line = new THREE.Line(lineGeo, lineMat)
            line.renderOrder = 0
            this.networkGroup.add(line)

            // 中点标记
            const markerR = 0.08 + nw * 0.22
            const markerMat = this.cloneMaterialTemplate(`marker:${sev.label}:${markerR.toFixed(2)}`, () =>
                new THREE.MeshBasicMaterial({
                    color: sev.color, transparent: true, opacity: 0.2 + nw * 0.55,
                    blending: THREE.AdditiveBlending, depthWrite: false,
                })
            )
            const markerMesh = new THREE.Mesh(this.getSphereGeometry(markerR, 8, 8), markerMat)
            markerMesh.position.copy(from.clone().lerp(to, 0.5))
            markerMesh.renderOrder = 1
            this.networkGroup.add(markerMesh)

            const pulseMat = this.cloneMaterialTemplate(`pulse:${sev.label}`, () =>
                new THREE.MeshBasicMaterial({
                    color: sev.color,
                    transparent: true,
                    opacity: 0.6,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                })
            )
            const pulseTailMat = this.cloneMaterialTemplate(`pulse-tail:${sev.label}`, () =>
                new THREE.MeshBasicMaterial({
                    color: sev.color,
                    transparent: true,
                    opacity: 0.28,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                })
            )
            const pulseMesh = new THREE.Mesh(this.getSphereGeometry(0.2 + nw * 0.22, 10, 10), pulseMat)
            const pulseTail = new THREE.Mesh(this.getSphereGeometry(0.16 + nw * 0.2, 8, 8), pulseTailMat)
            pulseMesh.renderOrder = 4
            pulseTail.renderOrder = 3
            this.networkGroup.add(pulseTail, pulseMesh)

            const rec = {
                id: `${link.source}->${link.target}:${this.linkRecords.length}`,
                sourceId: String(link.source), targetId: String(link.target),
                severity: String(link.severity || 'low'),
                weight, normalizedWeight: nw, color: sev.color, baseOpacity: bOp,
                line, markerMesh, curve,
                flowSpeed: 0.007 + nw * 0.018,
                pulseMesh,
                pulseTail,
                pulseT: Math.random(),
                pulseSpeed: 0.17 + nw * 0.28,
                // 动画
                curLineOp: bOp, tgtLineOp: bOp,
                curMarkerOp: 0.2 + nw * 0.55, tgtMarkerOp: 0.2 + nw * 0.55,
                curPulseStrength: getRiskPulseBias(link.risk_level || link.severity),
                tgtPulseStrength: getRiskPulseBias(link.risk_level || link.severity),
            }
            this.linkRecords.push(rec)

            if (!nodeLinkMap.has(link.source)) nodeLinkMap.set(link.source, new Set([link.source]))
            if (!nodeLinkMap.has(link.target)) nodeLinkMap.set(link.target, new Set([link.target]))
            nodeLinkMap.get(link.source).add(link.target)
            nodeLinkMap.get(link.target).add(link.source)
        }

        this.adjacencyMap = nodeLinkMap

        // ── 流动粒子池 ────────────────────────────
        if (this.linkRecords.length > 0) {
            const pGeo = this.getSphereGeometry(FLOW_PARTICLE_RADIUS, 8, 8)
            for (let i = 0; i < FLOW_PARTICLE_COUNT; i++) {
                const li = i % this.linkRecords.length
                const lr = this.linkRecords[li]
                const pMat = new THREE.MeshBasicMaterial({
                    color: lr.color, transparent: true, opacity: 0.85,
                    blending: THREE.AdditiveBlending, depthWrite: false,
                })
                const pm = new THREE.Mesh(pGeo, pMat)
                pm.renderOrder = 4
                this.networkGroup.add(pm)
                this.flowParticles.push({ mesh: pm, linkIndex: li, t: i / FLOW_PARTICLE_COUNT })
            }
        }

        this.linkPulses = this.linkRecords.map((r, idx) => ({
            linkId: r.id,
            phase: (idx % 9) / 9,
        }))

        this.updateHighlightState()
    }

    // ── 邻接关系 ──────────────────────────────────
    getRelatedNodeIds(id) {
        return this.adjacencyMap.get(String(id || '')) || new Set([String(id || '')])
    }

    // ── 设置高亮目标值（不直接应用，由 lerp 动画完成） ──
    updateHighlightState() {
        if (!this.nodeRecords.length) return

        const activeId = this.getActiveNodeId()
        const hasActive = Boolean(activeId)
        const related = hasActive ? this.getRelatedNodeIds(activeId) : null

        for (const r of this.nodeRecords) {
            // 1. 过滤器检查
            const passFilter = !this.nodeFilter || this.nodeFilter(r)
            if (!passFilter) {
                r.tgtScale = 0
                r.tgtOpacity = 0
                r.tgtGlowOp = 0
                r.tgtCoreOp = 0
                r.tgtAuraOp = 0
                r.tgtLabelOp = 0
                continue
            }

            // 2. 高亮逻辑
            const isActive = r.id === activeId
            const isRelated = related ? related.has(r.id) : true

            r.tgtScale = !hasActive ? 1 : isActive ? 1.5 : isRelated ? 1.1 : 0.82
            r.tgtOpacity = !hasActive ? 0.95 : isActive ? 1 : isRelated ? 0.88 : 0.22

            const gBase = r.glowOpBase
            r.tgtGlowOp = !hasActive ? gBase
                : isActive ? clamp(gBase * 2.0, 0.06, 0.72)
                    : isRelated ? clamp(gBase * 1.2, 0.04, 0.55)
                        : gBase * 0.28

            const cBase = r.coreOpBase
            r.tgtCoreOp = !hasActive ? cBase
                : isActive ? clamp(cBase * 1.9, 0.3, 1)
                    : isRelated ? clamp(cBase * 1.25, 0.24, 0.82)
                        : cBase * 0.32

            r.tgtAuraOp = !hasActive ? 0.07 : isActive ? 0.20 : isRelated ? 0.09 : 0.02
            r.tgtLabelOp = !hasActive ? 0.96 : isActive || isRelated ? 1.0 : 0.14
        }

        for (const r of this.linkRecords) {
            const isActive = !hasActive || r.sourceId === activeId || r.targetId === activeId
            r.tgtLineOp = !hasActive ? r.baseOpacity : isActive ? clamp(r.baseOpacity + 0.26, 0.2, 1) : 0.04
            r.tgtMarkerOp = !hasActive ? 0.2 + r.normalizedWeight * 0.55
                : isActive ? clamp(0.25 + r.normalizedWeight * 0.62, 0.15, 1) : 0.04
            r.tgtPulseStrength = !hasActive
                ? getRiskPulseBias(r.severity)
                : isActive
                    ? clamp(getRiskPulseBias(r.severity) + 0.32, 0.32, 1)
                    : 0.18
        }
    }

    // ── Lerp 动画：每帧逼近目标值 ─────────────────
    updateAnimations(delta) {
        const lsp = clamp(this.options.lerpSpeed * delta, 0, 1)
        const lspFast = clamp(lsp * 1.4, 0, 1)

        for (const r of this.nodeRecords) {
            r.curScale = lerp(r.curScale, r.tgtScale, lspFast)
            r.curOpacity = lerp(r.curOpacity, r.tgtOpacity, lsp)
            r.curGlowOp = lerp(r.curGlowOp, r.tgtGlowOp, lsp)
            r.curCoreOp = lerp(r.curCoreOp, r.tgtCoreOp, lsp)
            r.curAuraOp = lerp(r.curAuraOp, r.tgtAuraOp, lsp)
            r.curLabelOp = lerp(r.curLabelOp, r.tgtLabelOp, lsp)

            r.mesh.scale.setScalar(r.curScale)
            r.mesh.material.opacity = r.curOpacity
            r.glowMesh.material.opacity = r.curGlowOp
            r.coreMesh.material.opacity = r.curCoreOp
            r.coreMesh.scale.setScalar(clamp(0.92 + r.curScale * 0.14, 0.76, 1.24))
            if (r.auraRing) r.auraRing.material.opacity = r.curAuraOp
            if (r.labelSprite) {
                r.labelSprite.material.opacity = r.curLabelOp
                r.labelSprite.visible = r.curScale > 0.05
            }
        }

        for (const r of this.linkRecords) {
            r.curLineOp = lerp(r.curLineOp, r.tgtLineOp, lsp)
            r.curMarkerOp = lerp(r.curMarkerOp, r.tgtMarkerOp, lsp)
            r.curPulseStrength = lerp(r.curPulseStrength, r.tgtPulseStrength, lspFast)
            r.line.material.opacity = r.curLineOp
            r.markerMesh.material.opacity = r.curMarkerOp
        }
    }

    // ── 呼吸辉光（覆盖在 lerp 之上） ─────────────
    updateBreathingGlow(ts) {
        const t = ts * 0.001
        for (const r of this.nodeRecords) {
            if (r.curScale < 0.05) continue
            const breath = Math.sin(t * 1.4 + r.breathPhase)
            const amplitude = r.riskLevel === 'critical' ? 0.38
                : r.riskLevel === 'high' ? 0.26 : 0.1
            const glowFinal = r.curGlowOp * (1 + breath * amplitude)
            r.glowMesh.material.opacity = clamp(glowFinal, 0.02, 0.72)
            r.coreMesh.material.opacity = clamp(r.curCoreOp * (1.05 + breath * (amplitude * 0.66)), 0.06, 1)

            if (r.auraRing) {
                const aura = Math.sin(t * 0.8 + r.breathPhase + Math.PI * 0.5)
                r.auraRing.material.opacity = clamp(r.curAuraOp + aura * 0.05, 0.01, 0.22)
                r.auraRing.scale.setScalar(1 + aura * 0.06)
            }
        }
    }

    // ── 扫描光环动画 ──────────────────────────────
    updateScanRing(delta) {
        if (!this.scanRingMesh) return
        this.scanRingT += delta / (SCAN_RING_INTERVAL / 1000)
        if (this.scanRingT > 1) this.scanRingT = 0

        const t = this.scanRingT
        const radius = t * SCAN_RING_MAX_RADIUS
        // 透明度：出发时淡入，接近边界时淡出
        const alpha = Math.sin(t * Math.PI) * 0.45

        this.scanRingMesh.scale.setScalar(radius < 0.1 ? 0.1 : radius)
        this.scanRingMesh.material.opacity = alpha
    }

    // ── 流动粒子 ──────────────────────────────────
    updateFlowParticles() {
        if (!this.flowParticles.length || !this.linkRecords.length) return
        for (const p of this.flowParticles) {
            const lr = this.linkRecords[p.linkIndex % this.linkRecords.length]
            if (!lr?.curve) continue
            p.t += lr.flowSpeed
            if (p.t >= 1) {
                p.t = 0
                p.linkIndex = Math.floor(Math.random() * this.linkRecords.length)
                p.mesh.material.color.setHex(this.linkRecords[p.linkIndex].color)
            }
            p.mesh.position.copy(lr.curve.getPoint(p.t))
            p.mesh.material.opacity = clamp(Math.sin(p.t * Math.PI) * 0.9 * (0.35 + lr.curPulseStrength), 0.04, 0.92)
        }
    }

    updateLinkPulses(ts) {
        if (!this.linkRecords.length) return
        const dt = this.lastFrameTime ? clamp((ts - this.lastFrameTime) / 1000, 0, 0.08) : 0.016
        for (const r of this.linkRecords) {
            if (!r.curve || !r.pulseMesh || !r.pulseTail) continue
            r.pulseT += dt * r.pulseSpeed * (0.65 + r.curPulseStrength)
            if (r.pulseT > 1) r.pulseT -= 1

            const head = r.curve.getPoint(r.pulseT)
            const tailT = clamp(r.pulseT - LINK_PULSE_TAIL_OFFSET - (1 - r.curPulseStrength) * 0.03, 0, 1)
            const tail = r.curve.getPoint(tailT)
            const pulseEnvelope = Math.sin(r.pulseT * Math.PI)
            const pulseOp = clamp((0.35 + pulseEnvelope * 0.55) * r.curPulseStrength, 0.06, 0.95)

            r.pulseMesh.position.copy(head)
            r.pulseTail.position.copy(tail)
            r.pulseMesh.material.opacity = pulseOp
            r.pulseTail.material.opacity = pulseOp * 0.42
            r.pulseMesh.scale.setScalar(0.85 + r.normalizedWeight * 1.2 * r.curPulseStrength)
            r.pulseTail.scale.setScalar(0.72 + r.normalizedWeight * 0.8 * r.curPulseStrength)
            r.markerMesh.material.opacity = clamp(r.curMarkerOp + pulseOp * 0.18, 0.02, 1)
        }
    }

    // ── 星尘闪烁 ──────────────────────────────────
    updateStarTwinkle(ts) {
        if (!this.starField) return
        const t = ts * 0.0005
        this.starField.material.opacity = 0.46 + Math.sin(t) * 0.08
        if (this.deepStarField) {
            this.deepStarField.material.opacity = 0.18 + Math.sin(t * 0.6 + 1.2) * 0.06
            this.deepStarField.rotation.y += 0.00008
        }
        if (this.nebulaLayers.length) {
            this.nebulaLayers.forEach((layer, idx) => {
                layer.rotation.z += 0.00009 * (idx === 0 ? 1 : -0.8)
                layer.material.opacity = (idx === 0 ? 0.08 : 0.06) + Math.sin(t * (0.72 + idx * 0.18)) * 0.015
            })
        }
    }

    // ── 主循环 ────────────────────────────────────
    update(ts = performance.now()) {
        if (!this.scene || !this.camera || !this.renderer) return
        const delta = this.lastFrameTime ? clamp((ts - this.lastFrameTime) / 1000, 0, 0.1) : 0.016

        if (this.networkGroup && this.autoRotate && !this.isUserInteracting) {
            this.networkGroup.rotation.y += this.options.rotationSpeed
        }

        this.updateAnimations(delta)
        this.updateBreathingGlow(ts)
        this.updateLinkPulses(ts)
        this.updateFlowParticles()
        this.updateScanRing(delta)
        this.updateStarTwinkle(ts)

        this.renderer.render(this.scene, this.camera)
    }

    resize() {
        if (!this.container || !this.camera || !this.renderer) return
        const w = this.container.clientWidth
        const h = this.container.clientHeight
        if (!w || !h) return
        this.camera.aspect = w / Math.max(h, 1)
        this.camera.updateProjectionMatrix()
        this.renderer.setSize(w, h)
    }

    startLoop() {
        if (this.frameId) return
        const tick = (ts) => {
            this.frameId = requestAnimationFrame(tick)
            if (typeof this.onTick === 'function') this.onTick(ts)
            this.update(ts)
            this.lastFrameTime = ts
        }
        this.frameId = requestAnimationFrame(tick)
    }

    stopLoop() {
        if (!this.frameId) return
        cancelAnimationFrame(this.frameId)
        this.frameId = null
    }

    handleUserInteractionStart() { this.isUserInteracting = true }
    handleUserInteractionEnd() { this.isUserInteracting = false }

    dispose() {
        this.stopLoop()
        this.resizeObserver?.disconnect(); this.resizeObserver = null
        this.clearGraph()
        if (this.scene) {
            this.scene.traverse(o => { o.geometry?.dispose(); disposeMaterial(o.material) })
        }
        if (this.renderer) {
            this.renderer.renderLists?.dispose?.()
            this.renderer.dispose()
            this.renderer.forceContextLoss?.()
            const dom = this.renderer.domElement
            dom?.parentNode?.removeChild(dom)
        }
        this.scene = null; this.camera = null; this.renderer = null
        this.networkGroup = null; this.starField = null; this.deepStarField = null; this.scanRingMesh = null
        this.nebulaLayers = []
        this.container = null; this.model = null; this.flowParticles = []
        this.linkPulses = []
        this.nodeRecords = []; this.nodeRecordMap = new Map()
        this.linkRecords = []; this.adjacencyMap = new Map()
        this.activeNodeState = { hoveredNodeId: '', focusedNodeId: '', pinnedNodeId: '' }
        for (const g of this.resourceCache.geometries.values()) g.dispose()
        this.resourceCache.geometries.clear()
        for (const m of this.resourceCache.materials.values()) disposeMaterial(m)
        this.resourceCache.materials.clear()
    }
}
