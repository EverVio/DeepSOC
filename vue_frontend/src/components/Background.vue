<!--
  组件职责：渲染全局动态背景并管理动画帧与尺寸监听。
  业务模块：视觉背景层
  主要数据流：窗口尺寸/时间帧 -> canvas 绘制 -> 背景视觉输出
-->

<template>
  <div class="fui-bg" aria-hidden="true">
    <div class="grid-layer" />
    <canvas ref="canvasRef" class="particle-canvas" />
    <div class="bg-vignette" />
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const canvasRef = ref(null)
let animId = null
let resizeTimer = null
let lastFrameTime = 0
let handleResize = null

const STAR_COUNT = 100
const STAR_SPEED = 1
const STAR_MAX_R = 6
const LINE_DIST = 100
const LINE_ALPHA = 0.18
const ALPHA_LEVELS = 8
const BG_TARGET_FPS = 30
const FRAME_INTERVAL = 1000 / BG_TARGET_FPS

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}

const CYAN_RGB = hexToRgb('#00E5FF')
const PURPLE_RGB = hexToRgb('#7B2CBF')

function initStars(w, h) {
  return Array.from({ length: STAR_COUNT }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: Math.random() * STAR_MAX_R + 0.3,
    vx: (Math.random() - 0.5) * STAR_SPEED,
    vy: (Math.random() - 0.5) * STAR_SPEED,
    color: Math.random() > 0.2 ? CYAN_RGB : PURPLE_RGB,
    alpha: Math.random() * 0.55 + 0.2,
  }))
}

onMounted(() => {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return

  let w = 0
  let h = 0
  let stars = []

  function resize() {
    w = (canvas.width = window.innerWidth)
    h = (canvas.height = window.innerHeight)
    stars = initStars(w, h)
  }

  function draw(now = performance.now()) {
    animId = requestAnimationFrame(draw)

    if (now - lastFrameTime < FRAME_INTERVAL) {
      return
    }
    lastFrameTime = now

    ctx.clearRect(0, 0, w, h)

    for (const s of stars) {
      s.x += s.vx
      s.y += s.vy
      if (s.x < 0) s.x = w
      if (s.x > w) s.x = 0
      if (s.y < 0) s.y = h
      if (s.y > h) s.y = 0

      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${s.color},${s.alpha})`
      ctx.fill()
    }

    const paths = Array.from({ length: ALPHA_LEVELS }, () => new Path2D())
    const lineDistSq = LINE_DIST * LINE_DIST

    for (let i = 0; i < stars.length; i += 1) {
      for (let j = i + 1; j < stars.length; j += 1) {
        const dx = stars[i].x - stars[j].x
        const dy = stars[i].y - stars[j].y
        const distSq = dx * dx + dy * dy

        if (distSq < lineDistSq) {
          const dist = Math.sqrt(distSq)
          const alpha = LINE_ALPHA * (1 - dist / LINE_DIST)
          const levelIndex = Math.min(
            ALPHA_LEVELS - 1,
            Math.floor((alpha / LINE_ALPHA) * ALPHA_LEVELS),
          )

          paths[levelIndex].moveTo(stars[i].x, stars[i].y)
          paths[levelIndex].lineTo(stars[j].x, stars[j].y)
        }
      }
    }

    ctx.lineWidth = 0.5
    for (let i = 0; i < ALPHA_LEVELS; i += 1) {
      const levelAlpha = LINE_ALPHA * ((i + 1) / ALPHA_LEVELS)
      ctx.strokeStyle = `rgba(${CYAN_RGB},${levelAlpha})`
      ctx.stroke(paths[i])
    }
  }

  resize()
  draw()

  handleResize = () => {
    if (resizeTimer) {
      clearTimeout(resizeTimer)
    }
    resizeTimer = setTimeout(() => {
      resizeTimer = null
      resize()
    }, 150)
  }

  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  if (animId) {
    cancelAnimationFrame(animId)
    animId = null
  }
  if (resizeTimer) {
    clearTimeout(resizeTimer)
    resizeTimer = null
  }
  if (handleResize) {
    window.removeEventListener('resize', handleResize)
    handleResize = null
  }
})
</script>

<style scoped>
.fui-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  background-color: #050814;
  overflow: hidden;
  pointer-events: none;
}

.grid-layer {
  position: absolute;
  inset: -50% -20% -50% -20%;
  background-image:
    linear-gradient(rgba(0, 229, 255, 0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 229, 255, 0.07) 1px, transparent 1px);
  background-size: 48px 48px;
  transform: perspective(600px) rotateX(55deg) translateY(0);
  transform-origin: center bottom;
  animation: gridScroll 7s linear infinite;
  will-change: transform;
}

@keyframes gridScroll {
  from {
    transform: perspective(600px) rotateX(55deg) translateY(0);
  }
  to {
    transform: perspective(600px) rotateX(55deg) translateY(48px);
  }
}

.particle-canvas {
  position: absolute;
  inset: 0;
  display: block;
}

.bg-vignette {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 50% 0%, transparent 40%, #050814 100%),
    radial-gradient(ellipse at 50% 100%, transparent 40%, #050814 100%),
    radial-gradient(ellipse at 0% 50%, transparent 60%, rgba(5, 8, 20, 0.6) 100%),
    radial-gradient(ellipse at 100% 50%, transparent 60%, rgba(5, 8, 20, 0.6) 100%);
}
</style>
