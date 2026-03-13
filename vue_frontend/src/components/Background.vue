<template>
  <div class="fui-bg" aria-hidden="true">
    <!-- 透视网格层 -->
    <div class="grid-layer" />
    <!-- 粒子星空 Canvas -->
    <canvas ref="canvasRef" class="particle-canvas" />
    <!-- 顶部/底部渐变遮罩，让面板与背景自然融合 -->
    <div class="bg-vignette" />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const canvasRef = ref(null)
let animId = null

/* ── 粒子配置 ────────────────────────────────────── */
const STAR_COUNT  = 100   // 星点数量
const STAR_SPEED  = 0.5  // 漂移速度
const STAR_MAX_R  = 6   // 最大半径
const LINE_DIST   = 100   // 连线最大距离（px）
const LINE_ALPHA  = 0.18  // 连线最大透明度

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}
const CYAN_RGB   = hexToRgb('#00E5FF')
const PURPLE_RGB = hexToRgb('#7B2CBF')

function initStars(w, h) {
  return Array.from({ length: STAR_COUNT }, () => ({
    x:  Math.random() * w,
    y:  Math.random() * h,
    r:  Math.random() * STAR_MAX_R + 0.3,
    vx: (Math.random() - 0.5) * STAR_SPEED,
    vy: (Math.random() - 0.5) * STAR_SPEED,
    // 80% 霓虹蓝，20% 深紫
    color: Math.random() > 0.2 ? CYAN_RGB : PURPLE_RGB,
    alpha: Math.random() * 0.55 + 0.2,
  }))
}

onMounted(() => {
  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')

  let w, h, stars

  function resize() {
    w = canvas.width  = window.innerWidth
    h = canvas.height = window.innerHeight
    stars = initStars(w, h)
  }

  function draw() {
    ctx.clearRect(0, 0, w, h)

    // 更新并绘制星点
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

    // 绘制近邻连线
    for (let i = 0; i < stars.length; i++) {
      for (let j = i + 1; j < stars.length; j++) {
        const dx = stars[i].x - stars[j].x
        const dy = stars[i].y - stars[j].y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < LINE_DIST) {
          const alpha = LINE_ALPHA * (1 - dist / LINE_DIST)
          ctx.beginPath()
          ctx.moveTo(stars[i].x, stars[i].y)
          ctx.lineTo(stars[j].x, stars[j].y)
          ctx.strokeStyle = `rgba(${CYAN_RGB},${alpha})`
          ctx.lineWidth = 0.5
          ctx.stroke()
        }
      }
    }

    animId = requestAnimationFrame(draw)
  }

  resize()
  draw()
  window.addEventListener('resize', resize)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animId)
  window.removeEventListener('resize', () => {})
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

/* 透视网格 */
.grid-layer {
  position: absolute;
  inset: -50% -20%;
  background-image:
    linear-gradient(rgba(0, 229, 255, 0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 229, 255, 0.07) 1px, transparent 1px);
  background-size: 48px 48px;
  transform: perspective(600px) rotateX(55deg) translateY(10%);
  transform-origin: center bottom;
  animation: gridScroll 14s linear infinite;
  will-change: transform;
}
@keyframes gridScroll {
  from { background-position: 0 0; }
  to   { background-position: 0 48px; }
}

/* 粒子 Canvas */
.particle-canvas {
  position: absolute;
  inset: 0;
  display: block;
}

/* 四周渐变晕影，让背景与面板自然融合 */
.bg-vignette {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 50% 0%,   transparent 40%, #050814 100%),
    radial-gradient(ellipse at 50% 100%, transparent 40%, #050814 100%),
    radial-gradient(ellipse at 0%  50%,  transparent 60%, rgba(5, 8, 20, 0.6) 100%),
    radial-gradient(ellipse at 100% 50%, transparent 60%, rgba(5, 8, 20, 0.6) 100%);
}
</style>
