import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { findNodeByKeyword, getNodeStyle } from './TopologyDataAdapter.js'
import { TopologyRenderer } from './TopologyRenderer.js'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const easeOutCubic = (value) => 1 - Math.pow(1 - value, 3)
const bezierPoint = (a, c, b, t) => {
    const inv = 1 - t
    return a.clone().multiplyScalar(inv * inv)
        .add(c.clone().multiplyScalar(2 * inv * t))
        .add(b.clone().multiplyScalar(t * t))
}

export class TopologyInteraction extends TopologyRenderer {
    constructor(options = {}) {
        super(options)

        this.onNodeStateChange = options.onNodeStateChange || null
        this.onStatusChange = options.onStatusChange || null
        this.onNodeSelect = options.onNodeSelect || null

        this.controls = null
        this.raycaster = new THREE.Raycaster()
        this.pointer = new THREE.Vector2(2, 2)
        this.pointerInside = false
        this.pointerMoved = false
        this.lastPointerClient = { x: 0, y: 0 }
        this.cameraTween = null
        this.domElement = null
        this.boundPointerMove = (event) => this.handlePointerMove(event)
        this.boundPointerLeave = () => this.handlePointerLeave()
        this.boundClick = (event) => this.handleClick(event)
        this.boundDoubleClick = (event) => this.handleDoubleClick(event)
        this.boundWheel = () => {
            if (this.autoRotate) {
                this.emitStatus()
            }
        }
    }

    mount(container) {
        super.mount(container)
        if (!this.renderer || !this.camera) return

        this.domElement = this.renderer.domElement
        this.controls = new OrbitControls(this.camera, this.domElement)
        this.controls.enableDamping = true
        this.controls.dampingFactor = 0.05
        this.controls.minDistance = 20
        this.controls.maxDistance = 150
        this.controls.enablePan = false
        this.controls.rotateSpeed = 0.65
        this.controls.zoomSpeed = 0.8
        this.controls.target.copy(this.defaultCameraTarget)
        this.controls.update()

        this.controls.addEventListener('start', () => this.handleUserInteractionStart())
        this.controls.addEventListener('end', () => this.handleUserInteractionEnd())
        this.controls.addEventListener('change', () => {
            this.pointerMoved = true
        })

        this.domElement.addEventListener('pointermove', this.boundPointerMove)
        this.domElement.addEventListener('pointerleave', this.boundPointerLeave)
        this.domElement.addEventListener('click', this.boundClick)
        this.domElement.addEventListener('dblclick', this.boundDoubleClick)
        this.domElement.addEventListener('wheel', this.boundWheel, { passive: true })

        this.emitStatus('READY')
    }

    setTopologyModel(model) {
        super.setTopologyModel(model)
        this.emitStatus()
    }

    setAutoRotate(enabled) {
        super.setAutoRotate(enabled)
        this.emitStatus()
    }

    toggleAutoRotate() {
        const next = super.toggleAutoRotate()
        this.emitStatus()
        return next
    }

    handlePointerMove(event) {
        if (!this.domElement || !this.camera) return

        const rect = this.domElement.getBoundingClientRect()
        if (!rect.width || !rect.height) return

        this.pointerInside = true
        this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
        this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
        this.lastPointerClient = { x: event.clientX - rect.left, y: event.clientY - rect.top }
        this.pointerMoved = true
    }

    handlePointerLeave() {
        this.pointerInside = false
        this.pointer.set(2, 2)
        this.setHoveredNodeId('')

        const activeNodeId = this.getActiveNodeId()
        if (activeNodeId) {
            const payload = this.getNodeTooltipPayload(activeNodeId, {
                locked: Boolean(this.activeNodeState.pinnedNodeId || this.activeNodeState.focusedNodeId),
                mode: this.activeNodeState.pinnedNodeId ? 'pin' : 'focus',
                position: this.projectNodeToScreen(activeNodeId),
            })
            this.emitNodeState(payload)
            this.emitStatus()
            return
        }

        this.emitNodeState({ show: false })
        this.emitStatus('READY')
    }

    handleClick(event) {
        if (event.defaultPrevented || this.isUserInteracting) return
        const hit = this.pickHoveredNode()
        if (!hit) {
            if (!this.activeNodeState.pinnedNodeId && !this.activeNodeState.focusedNodeId) {
                this.setHoveredNodeId('')
                this.emitNodeState({ show: false })
                this.emitStatus('READY')
            }
            return
        }

        this.focusNode(hit.id, { pin: false, source: 'click' })
        if (typeof this.onNodeSelect === 'function') {
            this.onNodeSelect(hit)
        }
    }

    handleDoubleClick(event) {
        if (event.defaultPrevented || this.isUserInteracting) return
        const hit = this.pickHoveredNode()
        if (!hit) return

        this.togglePin(hit.id)
    }

    pickHoveredNode() {
        if (!this.camera || !this.pointerInside || !this.nodeRecords.length) return null

        this.raycaster.setFromCamera(this.pointer, this.camera)
        const meshes = this.nodeRecords.map((record) => record.mesh)
        const hits = this.raycaster.intersectObjects(meshes, false)
        if (!hits.length) return null

        const mesh = hits[0].object
        const nodeId = String(mesh.userData?.id || '')
        return this.getNodeRecord(nodeId)
    }

    focusNode(nodeId, options = {}) {
        const record = this.getNodeRecord(nodeId)
        if (!record || !this.controls || !this.camera) return false

        if (options.pin) {
            this.setPinnedNodeId(record.id)
        } else {
            if (this.activeNodeState.pinnedNodeId && this.activeNodeState.pinnedNodeId !== record.id) {
                this.activeNodeState.pinnedNodeId = ''
            }
            this.setFocusedNodeId(record.id)
        }

        const targetPosition = this.getNodeWorldPosition(record.id)
        if (!targetPosition) return false

        const style = getNodeStyle(record.type)
        const direction = this.camera.position.clone().sub(targetPosition)
        if (direction.lengthSq() < 0.001) {
            direction.set(0, 0.42, 1)
        }
        direction.normalize()

        const cameraDistance = style.focusDistance || 24
        const cameraPosition = targetPosition.clone().add(direction.multiplyScalar(cameraDistance))
        cameraPosition.y += cameraDistance * 0.12

        const startPosition = this.camera.position.clone()
        const startTarget = this.controls.target.clone()
        const span = startPosition.distanceTo(cameraPosition)
        const lateral = new THREE.Vector3(direction.z, 0, -direction.x)
        if (lateral.lengthSq() < 0.0001) {
            lateral.set(0.6, 0, 0.2)
        }
        lateral.normalize()

        const arcLift = clamp(cameraDistance * 0.32, 2.6, 10)
        const arcSide = clamp(span * 0.16, 0, 7)
        const controlPosition = startPosition.clone().lerp(cameraPosition, 0.5)
            .add(new THREE.Vector3(0, arcLift, 0))
            .add(lateral.multiplyScalar(arcSide))
        const controlTarget = startTarget.clone().lerp(targetPosition, 0.5)
            .add(new THREE.Vector3(0, arcLift * 0.22, 0))

        this.cameraTween = {
            active: true,
            progress: 0,
            duration: options.immediate ? 0 : 0.78,
            startPosition,
            endPosition: cameraPosition,
            controlPosition,
            startTarget,
            endTarget: targetPosition.clone(),
            controlTarget,
        }

        this.setHoveredNodeId(record.id)
        this.controls.target.copy(targetPosition)
        this.emitNodeState(
            this.getNodeTooltipPayload(record.id, {
                locked: true,
                mode: options.pin ? 'pin' : 'focus',
                position: this.projectNodeToScreen(record.id),
            }),
        )
        this.emitStatus(options.pin ? `PINNED: ${record.name}` : `FOCUSED: ${record.name}`)
        return true
    }

    focusByKeyword(keyword, options = {}) {
        const node = findNodeByKeyword(this.model?.nodes, keyword)
        if (!node) {
            this.emitStatus('NO MATCH')
            return false
        }

        return this.focusNode(node.id, {
            pin: options.pin !== false,
            source: 'search',
            immediate: options.immediate,
        })
    }

    togglePin(nodeId) {
        const targetId = nodeId || this.getActiveNodeId()
        if (!targetId) return false

        if (this.activeNodeState.pinnedNodeId === targetId) {
            this.activeNodeState.pinnedNodeId = ''
            this.updateHighlightState()
            const activeNodeId = this.getActiveNodeId()
            if (activeNodeId) {
                const isPinned = this.activeNodeState.pinnedNodeId === activeNodeId
                const isFocused = this.activeNodeState.focusedNodeId === activeNodeId
                const mode = isPinned ? 'pin' : isFocused ? 'focus' : 'hover'
                this.emitNodeState(
                    this.getNodeTooltipPayload(activeNodeId, {
                        locked: isPinned || isFocused,
                        mode,
                        position: this.projectNodeToScreen(activeNodeId),
                    }),
                )
            } else {
                this.emitNodeState({ show: false })
            }
            this.emitStatus(`UNPINNED: ${this.getNodeRecord(targetId)?.name || targetId}`)
            return true
        }

        return this.focusNode(targetId, { pin: true, source: 'pin' })
    }

    clearSelection() {
        super.clearSelection()
        this.emitNodeState({ show: false })
        this.emitStatus('READY')
    }

    resetView() {
        this.cameraTween = null
        this.activeNodeState.hoveredNodeId = ''
        this.activeNodeState.focusedNodeId = ''
        this.activeNodeState.pinnedNodeId = ''
        this.setAutoRotate(this.autoRotate)
        if (this.controls && this.camera) {
            this.controls.target.copy(this.defaultCameraTarget)
            this.camera.position.copy(this.defaultCameraPosition)
            this.controls.update()
        }
        this.updateHighlightState()
        this.emitNodeState({ show: false })
        this.emitStatus('READY')
    }

    updateCameraTween(deltaSeconds = 0.016) {
        if (!this.cameraTween || !this.controls || !this.camera) return

        const tween = this.cameraTween
        if (tween.duration === 0) {
            this.camera.position.copy(tween.endPosition)
            this.controls.target.copy(tween.endTarget)
            this.controls.update()
            this.cameraTween = null
            return
        }

        tween.progress = clamp(tween.progress + deltaSeconds / tween.duration, 0, 1)
        const eased = easeOutCubic(tween.progress)
        this.camera.position.copy(bezierPoint(tween.startPosition, tween.controlPosition, tween.endPosition, eased))
        this.controls.target.copy(bezierPoint(tween.startTarget, tween.controlTarget, tween.endTarget, eased))
        this.controls.update()

        if (tween.progress >= 1) {
            this.cameraTween = null
            this.controls.target.copy(tween.endTarget)
            this.controls.update()
        }
    }

    updateRaycast() {
        if (!this.camera || !this.pointerInside || !this.nodeRecords.length) {
            this.pointerMoved = false
            if (!this.pointerInside && !this.activeNodeState.pinnedNodeId && !this.activeNodeState.focusedNodeId) {
                this.setHoveredNodeId('')
                this.emitNodeState({ show: false })
            }
            return
        }

        if (!this.pointerMoved) {
            return
        }

        this.pointerMoved = false

        this.raycaster.setFromCamera(this.pointer, this.camera)
        const meshes = this.nodeRecords.map((record) => record.mesh)
        const hits = this.raycaster.intersectObjects(meshes, false)

        if (hits.length > 0) {
            const mesh = hits[0].object
            const nodeId = String(mesh.userData?.id || '')
            if (nodeId && this.activeNodeState.hoveredNodeId !== nodeId) {
                this.setHoveredNodeId(nodeId)
                const isPinned = this.activeNodeState.pinnedNodeId === nodeId
                const isFocused = this.activeNodeState.focusedNodeId === nodeId
                const mode = isPinned ? 'pin' : isFocused ? 'focus' : 'hover'
                this.emitNodeState(
                    this.getNodeTooltipPayload(nodeId, {
                        locked: isPinned || isFocused,
                        mode,
                        position: {
                            x: this.lastPointerClient.x + 16,
                            y: this.lastPointerClient.y + 16,
                        },
                    }),
                )
                this.emitStatus(`${mode.toUpperCase()}: ${this.getNodeRecord(nodeId)?.name || nodeId}`)
            }
            return
        }

        if (this.activeNodeState.hoveredNodeId) {
            this.setHoveredNodeId('')
            const activeNodeId = this.getActiveNodeId()
            if (activeNodeId) {
                this.emitNodeState(
                    this.getNodeTooltipPayload(activeNodeId, {
                        locked: Boolean(this.activeNodeState.pinnedNodeId || this.activeNodeState.focusedNodeId),
                        mode: this.activeNodeState.pinnedNodeId ? 'pin' : 'focus',
                        position: this.projectNodeToScreen(activeNodeId),
                    }),
                )
            } else {
                this.emitNodeState({ show: false })
            }
        }
    }

    emitNodeState(payload) {
        if (typeof this.onNodeStateChange === 'function') {
            this.onNodeStateChange(payload)
        }
    }

    emitStatus(text) {
        const activeNode = this.getActiveNodeRecord()
        const defaultText = activeNode
            ? `${this.activeNodeState.pinnedNodeId ? 'PINNED' : this.activeNodeState.focusedNodeId ? 'FOCUSED' : 'HOVER'}: ${activeNode.name || activeNode.id}`
            : this.autoRotate
                ? 'AUTO ROTATE ON'
                : 'AUTO ROTATE OFF'

        if (typeof this.onStatusChange === 'function') {
            this.onStatusChange(text || defaultText)
        }
    }

    update(timestamp = performance.now()) {
        const deltaSeconds = this.lastFrameTime ? clamp((timestamp - this.lastFrameTime) / 1000, 0, 0.1) : 0.016
        this.updateCameraTween(deltaSeconds)
        if (this.controls) {
            this.controls.update()
        }
        if (this.autoRotate || this.cameraTween || this.isUserInteracting) {
            this.pointerMoved = true
        }
        this.updateRaycast()
        super.update(timestamp)
    }

    dispose() {
        this.domElement?.removeEventListener('pointermove', this.boundPointerMove)
        this.domElement?.removeEventListener('pointerleave', this.boundPointerLeave)
        this.domElement?.removeEventListener('click', this.boundClick)
        this.domElement?.removeEventListener('dblclick', this.boundDoubleClick)
        this.domElement?.removeEventListener('wheel', this.boundWheel)
        if (this.controls) {
            this.controls.dispose()
            this.controls = null
        }
        this.domElement = null
        this.cameraTween = null
        super.dispose()
    }
}
