/**
 * 模块职责：提供可复用的乱码解密文本动效。
 * 业务模块：通用动效模块
 * 主要数据流：目标文本 -> 帧计算 -> 回调更新
 */

export function useTextScramble(onFrame, symbols = '&!#%*^ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
  let rafId = 0

  const stop = () => {
    if (!rafId) return
    cancelAnimationFrame(rafId)
    rafId = 0
  }

  const start = (targetText, duration = 300) => {
    stop()

    const text = String(targetText || '')
    const totalFrames = Math.max(1, Math.round((duration / 1000) * 60))
    let currentFrame = 0

    const tick = () => {
      currentFrame += 1
      const progress = currentFrame / totalFrames
      const stableCount = Math.floor(text.length * progress)

      let scrambled = ''
      for (let i = 0; i < text.length; i += 1) {
        const char = text[i]
        if (char === ' ') {
          scrambled += ' '
          continue
        }

        if (i < stableCount) {
          scrambled += char
          continue
        }

        const randomIndex = Math.floor(Math.random() * symbols.length)
        scrambled += symbols[randomIndex]
      }

      onFrame(scrambled)

      if (currentFrame < totalFrames) {
        rafId = requestAnimationFrame(tick)
      } else {
        onFrame(text)
        rafId = 0
      }
    }

    rafId = requestAnimationFrame(tick)
  }

  return {
    start,
    stop,
  }
}
