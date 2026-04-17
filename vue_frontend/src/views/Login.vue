<template>
  <div class="login-shell" style="background-color: #050814;">
    <canvas ref="canvasRef" class="bg-canvas" :class="{ 'bg-canvas--ready': backgroundReady }" style="background-color: #050814;"></canvas>

    <div 
      v-show="backgroundReady && tooltip.show" 
      class="tooltip-overlay"
      :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
    >
      {{ tooltip.text }}
    </div>

    <div class="login-stage">
      <section class="brand-panel animate-item delay-1">
        <h1 class="title">
          <div class="title-main">DeepSOC</div>
          <div class="title-sub">智能安全运营中心</div>
        </h1>
      </section>

      <div class="form-panel animate-item delay-2">
        <NCard class="login-card" :bordered="false" embedded>
          <div class="card-head">
            <h2>系统登录</h2>
          </div>

          <NForm class="login-form" label-placement="top" @submit.prevent="handleLogin">
            <NAlert v-if="error" type="error" :show-icon="true" class="error-alert">
              {{ error }}
            </NAlert>

            <NFormItem label="用户名">
              <NInput
                v-model:value="username"
                autocomplete="username"
                placeholder="请输入用户名"
                :disabled="loading"
                clearable
              />
            </NFormItem>

            <NFormItem label="密码">
              <NInput
                v-model:value="password"
                type="password"
                show-password-on="mousedown"
                autocomplete="current-password"
                placeholder="请输入密码"
                :disabled="loading"
              />
            </NFormItem>

            <div class="helper-row">
              <NCheckbox v-model:checked="rememberMe" :disabled="loading">
                记住凭据
              </NCheckbox>
              <NButton
                text
                attr-type="button"
                class="prefill-button"
                :disabled="loading"
                @click="fillDefaultCredentials"
              >
                测试账号
              </NButton>
            </div>

            <NButton
              attr-type="submit"
              class="login-button"
              :loading="loading"
              :disabled="!canSubmit"
              block
            >
              登 录
            </NButton>
          </NForm>
        </NCard>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { NAlert, NButton, NCard, NCheckbox, NForm, NFormItem, NInput } from 'naive-ui'
import { useAuthStore } from '../stores/authStore'
import { useWindowSize } from '@vueuse/core'
import * as THREE from 'three'
import api from '../api'

// === 状态与鉴权逻辑 ===
const LOGIN_USERNAME_KEY = 'loginUsername'
const LOGIN_PASSWORD_KEY = 'loginPassword'
const LOGIN_REMEMBER_KEY = 'loginRememberMe'

const hasLegacyCredential = Boolean(localStorage.getItem(LOGIN_USERNAME_KEY)) || Boolean(localStorage.getItem(LOGIN_PASSWORD_KEY))
const rememberKey = localStorage.getItem(LOGIN_REMEMBER_KEY)
const shouldRestoreCredential = rememberKey == null ? hasLegacyCredential : rememberKey === '1'

const username = ref(shouldRestoreCredential ? localStorage.getItem(LOGIN_USERNAME_KEY) || '' : '')
const password = ref(shouldRestoreCredential ? localStorage.getItem(LOGIN_PASSWORD_KEY) || '' : '')
const rememberMe = ref(shouldRestoreCredential)
const loading = ref(false)
const error = ref('')

const router = useRouter()
const authStore = useAuthStore()

const canSubmit = computed(() => Boolean(username.value.trim()) && Boolean(password.value.trim()))

watch([username, password], () => {
  if (error.value) error.value = ''
})

const persistLoginCredentials = () => {
  if (rememberMe.value) {
    localStorage.setItem(LOGIN_USERNAME_KEY, username.value)
    localStorage.setItem(LOGIN_PASSWORD_KEY, password.value)
    localStorage.setItem(LOGIN_REMEMBER_KEY, '1')
    return
  }
  localStorage.removeItem(LOGIN_USERNAME_KEY)
  localStorage.removeItem(LOGIN_PASSWORD_KEY)
  localStorage.setItem(LOGIN_REMEMBER_KEY, '0')
}

const fillDefaultCredentials = () => {
  username.value = 'admin'
  password.value = 'secret'
}

const handleLogin = () => {
  if (!canSubmit.value) {
    error.value = '请输入完整的用户名和密码'
    return
  }
  loading.value = true
  error.value = ''
  
  api.login(username.value.trim(), password.value)
    .then(response => {
      persistLoginCredentials()
      authStore.setApiKey(response.data.api_key)
      router.push('/')
    })
    .catch(err => {
      error.value = err.response?.data?.error || '登录失败，请检查凭据'
    })
    .finally(() => {
      loading.value = false
    })
}

// === Three.js xAI 风格交互节点动效 ===
const canvasRef = ref(null)
const backgroundReady = ref(false)
const { width, height } = useWindowSize()

let scene, camera, renderer
let animationFrameId = 0
let networkGroup, nodesMesh

// 交互相关参数
const raycaster = new THREE.Raycaster()
raycaster.params.Points.threshold = 8 // 放宽容差方便拾取大端点
const mouse = new THREE.Vector2(-1000, -1000)
const tooltip = ref({ show: false, text: '', x: 0, y: 0 })

// 旋转速度控制
const BASE_SPEED = 0.001
const SLOW_SPEED = 0.0002
let targetSpeed = BASE_SPEED
let currentSpeed = BASE_SPEED

// 节点附加数据
const nodeData = []
const HIGHLIGHT_TEXTS = [
  "流式分析引擎", "多智能体协同", "结构化向量检索",
  "统一日志与情报", "秒级研判闭环", "全景安全态势看板",
  "OLLAMA 本地增强", "自动化证据链", "威胁意图识别"
]

const onMouseMove = (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
}

const initThreeJS = () => {
  if (!canvasRef.value) return

  scene = new THREE.Scene()
  // 严格匹配 styles.css 中的 --bg-base
  scene.background = new THREE.Color('#050814')
  
  camera = new THREE.PerspectiveCamera(50, width.value / height.value, 0.1, 2500)
  camera.position.set(0, 0, 800)

  renderer = new THREE.WebGLRenderer({
    canvas: canvasRef.value,
    alpha: false,
    antialias: true,
    powerPreference: 'high-performance',
  })
  renderer.setSize(width.value, height.value)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setClearColor('#050814', 1)

  networkGroup = new THREE.Group()
  networkGroup.position.set(0, 15, 0)
  networkGroup.rotation.x = 0.4
  scene.add(networkGroup)

  const rayCount = 60
  const linePositions = new Float32Array(rayCount * 6)
  const nodePositions = new Float32Array(rayCount * 3)
  const nodeSizes = new Float32Array(rayCount)
  const nodeColors = new Float32Array(rayCount * 3)

  // 使用 styles.css 中的主题色
  const colorActive = new THREE.Color('#00f2ff') // --neon-cyan
  const colorDim = new THREE.Color('#4787b6')   // --text-muted

  let textIndex = 0

  for (let i = 0; i < rayCount; i++) {
    // 核心均匀分布计算
    const y = 1 - (i / (rayCount - 1)) * 2; // y 从 1 到 -1
    const radiusAtY = Math.sqrt(1 - y * y); // 当前高度的圆半径
    const theta = 2.3999632 * i; // 黄金角度增量

    const dirX = Math.cos(theta) * radiusAtY;
    const dirY = y;
    const dirZ = Math.sin(theta) * radiusAtY;

    // 缩短连线长度，并加入微量波动增强自然感
    const radius = 240 + Math.random() * 120; 

    // 线段
    linePositions[i * 6] = 0;
    linePositions[i * 6 + 1] = 0;
    linePositions[i * 6 + 2] = 0;
    linePositions[i * 6 + 3] = dirX * radius;
    linePositions[i * 6 + 4] = dirY * radius;
    linePositions[i * 6 + 5] = dirZ * radius;

    // 节点位置
    nodePositions[i * 3] = dirX * radius;
    nodePositions[i * 3 + 1] = dirY * radius;
    nodePositions[i * 3 + 2] = dirZ * radius;
    
    // 逻辑：每隔几个点固定出现一个大端点，确保交互锚点也分布均匀
    const isLarge = (i % 4 === 0); 
    nodeSizes[i] = isLarge ? (28 + Math.random() * 8) : (10 + Math.random() * 6)
    
    const nodeColor = isLarge ? colorActive : colorDim;
    nodeColors[i * 3] = nodeColor.r;
    nodeColors[i * 3 + 1] = nodeColor.g;
    nodeColors[i * 3 + 2] = nodeColor.b;
    
    nodeData.push({
      index: i,
      text: isLarge ? HIGHLIGHT_TEXTS[textIndex++ % HIGHLIGHT_TEXTS.length] : null,
      isLarge
    });
  }

  // 连线材质：采用带有深蓝青色光泽的弱射线
  const lineGeo = new THREE.BufferGeometry()
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3))
  const lineMat = new THREE.LineBasicMaterial({
    color: new THREE.Color('#00E5FF'),
    transparent: true,
    opacity: 0.2,
  })
  const lines = new THREE.LineSegments(lineGeo, lineMat)
  networkGroup.add(lines)

  // 端点节点材质：通过 Attribute 注入每个顶点的尺寸与颜色
  const nodeGeo = new THREE.BufferGeometry()
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePositions, 3))
  nodeGeo.setAttribute('size', new THREE.BufferAttribute(nodeSizes, 1))
  nodeGeo.setAttribute('customColor', new THREE.BufferAttribute(nodeColors, 3))
  
  const nodeMat = new THREE.ShaderMaterial({
    vertexShader: `
      attribute float size;
      attribute vec3 customColor;
      varying vec3 vColor;
      void main() {
        vColor = customColor;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (400.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        // 直接使用传入的独立顶点色彩渲染方形
        gl_FragColor = vec4(vColor, 0.95);
      }
    `,
    transparent: true,
    depthWrite: false
  })
  
  nodesMesh = new THREE.Points(nodeGeo, nodeMat)
  networkGroup.add(nodesMesh)

  // 在场景与对象准备完成后再显示背景，避免加载前出现动态底图
  backgroundReady.value = true
  window.addEventListener('mousemove', onMouseMove)
  renderLoop()
}

const renderLoop = () => {
  if (!renderer || !scene) return
  
  raycaster.setFromCamera(mouse, camera)
  const intersects = raycaster.intersectObject(nodesMesh)

  if (intersects.length > 0) {
    const intersectedIndex = intersects[0].index
    const meta = nodeData[intersectedIndex]
    
    // 只有带有 text 的大端点才响应交互
    if (meta && meta.text) {
      targetSpeed = SLOW_SPEED 
      
      networkGroup.updateMatrixWorld()
      const pos = new THREE.Vector3(
        nodesMesh.geometry.attributes.position.getX(intersectedIndex),
        nodesMesh.geometry.attributes.position.getY(intersectedIndex),
        nodesMesh.geometry.attributes.position.getZ(intersectedIndex)
      )
      pos.applyMatrix4(networkGroup.matrixWorld)
      pos.project(camera)
      
      tooltip.value = {
        show: true,
        text: meta.text,
        x: (pos.x * 0.5 + 0.5) * window.innerWidth,
        y: (pos.y * -0.5 + 0.5) * window.innerHeight
      }
    } else {
      targetSpeed = BASE_SPEED
      tooltip.value.show = false
    }
  } else {
    targetSpeed = BASE_SPEED
    tooltip.value.show = false
  }

  currentSpeed += (targetSpeed - currentSpeed) * 0.05
  networkGroup.rotation.y += currentSpeed
  networkGroup.rotation.z += currentSpeed * 0.2

  renderer.render(scene, camera)
  animationFrameId = requestAnimationFrame(renderLoop)
}

watch([width, height], () => {
  if (camera && renderer) {
    camera.aspect = width.value / height.value
    camera.updateProjectionMatrix()
    renderer.setSize(width.value, height.value)
  }
})

onMounted(() => {
  initThreeJS()
})

onBeforeUnmount(() => {
  backgroundReady.value = false
  window.removeEventListener('mousemove', onMouseMove)
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
  if (networkGroup) {
    networkGroup.traverse(child => {
      if (child.geometry) child.geometry.dispose()
      if (child.material) child.material.dispose()
    })
  }
  if (renderer) renderer.dispose()
  if (scene) scene.clear()
})
</script>

<style scoped>
/* ================= 基础布局与动效 ================= */
.login-shell {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background: var(--bg-base);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-ui, system-ui, sans-serif);
}

.bg-canvas {
  position: absolute;
  inset: 0;
  z-index: 0;
  background-color: var(--bg-base);
  opacity: 0;
  transition: opacity 360ms ease;
}

.bg-canvas--ready {
  opacity: 1;
}

.tooltip-overlay {
  position: absolute;
  transform: translate(32px, -50%); /* 拉开悬浮间距，防止阻挡大端点 */
  color: var(--neon-cyan);
  font-family: var(--font-mono, monospace);
  font-size: 15px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  pointer-events: none;
  z-index: 10;
  white-space: nowrap;
  font-weight: 600;
  text-shadow: 0 2px 12px rgba(0, 229, 255, 0.5);
}

.login-stage {
  position: relative;
  z-index: 1;
  width: min(1200px, 90vw);
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 6rem;
  align-items: center;
  pointer-events: none;
}

.form-panel {
  pointer-events: auto;
}

.animate-item {
  opacity: 0;
  animation: float-up-fade 1.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.delay-1 { animation-delay: 0.15s; }
.delay-2 { animation-delay: 0.35s; }

@keyframes float-up-fade {
  0% { opacity: 0; transform: translateY(20px) scale(0.98); filter: blur(6px); }
  100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
}

.brand-panel {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0;
}

.title {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin: 0;
  gap: 1.2rem;
}

.title-main {
  font-size: clamp(3rem, 5.5vw, 5.5rem);
  line-height: 1.1;
  font-weight: 400;
  letter-spacing: 0.02em;
  background: linear-gradient(135deg, #FFFFFF 0%, #C0D6F0 35%, #9ABDF8 70%, #00E5FF 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  color: #00E5FF; /* Fallback */
}

.title-sub {
  font-size: clamp(1.8rem, 3.5vw, 3.2rem);
  line-height: 1.1;
  font-weight: 300;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  opacity: 0.85;
}

/* ================= 登录卡片核心样式 ================= */
.login-card {
  background: rgba(14, 21, 43, 0.8);
  backdrop-filter: blur(28px);
  -webkit-backdrop-filter: blur(28px);
  border: 1px solid var(--border-dim);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  box-shadow: 
    0 32px 80px rgba(0, 0, 0, 0.65),
    0 0 0 1px rgba(0, 229, 255, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  overflow: hidden;
  transition: box-shadow var(--transition-base);
}
.login-card:hover {
  box-shadow: 
    0 32px 80px rgba(0, 0, 0, 0.75),
    0 0 0 1px rgba(0, 229, 255, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.card-head {
  margin-bottom: 2.2rem;
  padding: 0 0.2rem;
}
.card-head h2 {
  color: var(--text-primary);
  font-size: 1.35rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  margin-bottom: 0.5rem;
}
.card-head p {
  color: var(--text-secondary);
  font-size: 0.8rem;
  letter-spacing: 0.02em;
}

/* ================= 表单与输入框 ================= */
.login-form :deep(.n-form-item-label__text) {
  color: var(--text-secondary);
  font-size: 0.9rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 8px;
  font-weight: 500;
}

.login-form :deep(.n-input-wrapper) {
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid var(--border-dim);
  border-radius: 0;
  transition: all var(--transition-base);
  height: 48px;
  display: flex;
  align-items: center; /* 垂直居中关键 */
  padding: 0 12px; /* 左右留白，避免贴边 */
}
.login-form :deep(.n-input-wrapper:hover) {
  background: rgba(0, 0, 0, 0.6);
  border-color: var(--border-active);
}
.login-form :deep(.n-input.n-input--focus .n-input-wrapper) {
  background: rgba(0, 0, 0, 0.7);
  border-color: var(--neon-cyan);
  box-shadow: 0 0 0 2px var(--neon-cyan-dim), inset 0 0 16px rgba(0, 229, 255, 0.06);
}
.login-form :deep(.n-input__input-el) {
  color: var(--text-primary);
  font-family: var(--font-ui);
  letter-spacing: 0.02em;
  font-size: 18px; 
  line-height: 1.5; 
}
.login-form :deep(.n-input__clear),
.login-form :deep(.n-input__password-toggle) {
  color: var(--text-muted);
  transition: color var(--transition-base);
}
.login-form :deep(.n-input__clear:hover),
.login-form :deep(.n-input__password-toggle:hover) {
  color: var(--neon-cyan);
}

/* ================= 辅助行（复选框 & 测试账号） ================= */
.helper-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0.8rem 0 2.4rem; 
}

.helper-row :deep(.n-checkbox) {
  display: flex;
  align-items: center;   
  cursor: pointer;
}

.helper-row :deep(.n-checkbox__label) {
  color: var(--text-secondary);
  font-size: 0.9rem;       
  line-height: 1.5;        
  margin-left: 6px;          
  user-select: none;
}

.helper-row :deep(.n-checkbox:hover) .n-checkbox__label {
  color: var(--neon-cyan);
  text-shadow: 0 0 8px var(--neon-cyan-dim);
}

.helper-row :deep(.n-checkbox-box) {
  border-color: var(--border-dim);
  background: rgba(0, 0, 0, 0.3);
  transition: all var(--transition-base);
}
.helper-row :deep(.n-checkbox.n-checkbox--checked .n-checkbox-box) {
  background: var(--neon-cyan);
  border-color: var(--neon-cyan);
  box-shadow: 0 0 10px var(--neon-cyan-dim);
}

.prefill-button {
  font-size: 0.9rem; 
  color: var(--text-secondary);
  transition: color var(--transition-base), text-shadow var(--transition-base);
  background: transparent !important;
  border: none !important;   
  padding: 4px 8px;      
  clip-path: none !important; 
  text-transform: none;
  letter-spacing: 0;
  font-weight: 400;
  line-height: 1.5;
  box-shadow: none !important; 
  outline: none !important;   
}

.prefill-button:hover {
  color: var(--neon-cyan);
  text-shadow: 0 0 8px var(--neon-cyan-dim); 

  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  transform: none !important; 
}

.prefill-button:active {
  color: var(--neon-cyan);
  text-shadow: 0 0 4px var(--neon-cyan-dim);
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  transform: none !important;
}

/* ================= 登录按钮 ================= */
.login-button {
  height: 50px;
  font-size: 1.2rem;
  font-weight: 500;
  letter-spacing: 0.25em;
  background: var(--neon-cyan-dim);
  color: var(--neon-cyan);
  border: 1px solid var(--border-active);
  border-radius: 0;
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
  box-shadow: 0 0 0 rgba(0, 229, 255, 0);
  transition: all var(--transition-base);
  text-transform: uppercase;
}
.login-button:not(:disabled):hover {
  background: rgba(0, 229, 255, 0.25);
  border-color: var(--neon-cyan);
  box-shadow: var(--neon-cyan-glow);
  transform: translateY(-1px);
}
.login-button:not(:disabled):active {
  transform: translateY(0);
  box-shadow: inset 0 2px 8px rgba(0, 229, 255, 0.2);
}
.login-button:disabled {
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-muted);
  border-color: var(--border-dim);
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* ================= 错误提示 ================= */
.error-alert {
  margin-bottom: 1.8rem;
  background: rgba(255, 0, 85, 0.08);
  border: 1px solid rgba(255, 0, 85, 0.35);
  color: var(--neon-red);
  border-radius: 0;
  clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px);
  font-size: 0.8rem;
  font-weight: 500;
  letter-spacing: 0.04em;
}

/* ================= 响应式适配 ================= */
@media (max-width: 1024px) {
  .login-stage {
    grid-template-columns: 1fr;
    max-width: 460px;
    gap: 3.5rem;
  }
  .title { align-items: center; width: 100%; }
  .card-head { text-align: center; }
}
</style>