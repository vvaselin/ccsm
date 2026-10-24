<!-- components/DustLayer.vue -->
<!--
  キャラの前面にまばらに舞う、埃のような光の粒。
  画面のどこにでもふっと現れ、ゆっくり漂って、そのまま消えていく。

  使い方（app.vue のメインコンテナ内、キャラ画像の後・UI の前に置く）:
    <DustLayer :enabled="dustEnabled" />

  省電力の工夫:
    - 30fps に間引く（dt ベースで動くので速度は変わらない）
    - タブが非表示になったら rAF を止め、戻ったら再開
    - 粒子は 30 個程度。発光はあらかじめ描いたスプライトを drawImage するだけ
    - prefers-reduced-motion のときは描かない
-->
<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  enabled:  { type: Boolean, default: true },
  count:    { type: Number,  default: 30 },       // 粒の数
  color:    { type: String,  default: '255,250,240' }, // "r,g,b"（少し暖かい白）
  maxAlpha: { type: Number,  default: 0.55 },
  fps:      { type: Number,  default: 30 },
})

const canvasRef = ref(null)

let ctx = null
let dpr = 1
let w = 0, h = 0          // CSS px
let sprite = null
let particles = []
let rafId = 0
let lastT = 0
let running = false
let reduceMotion = false
let resizeObserver = null

const rand = (a, b) => a + Math.random() * (b - a)

// 寿命のうち、現れる／消えるのに使う割合（両端それぞれ）。
// 0.4 なら寿命の 4 割かけて現れ、中央で最大、残り 4 割かけて消える
const FADE_RATIO = 0.4

// ---- 発光スプライト（1回だけ作る） ----
function makeSprite() {
  const size = 64
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0,    `rgba(${props.color},1)`)
  grad.addColorStop(0.25, `rgba(${props.color},0.6)`)
  grad.addColorStop(0.6,  `rgba(${props.color},0.12)`)
  grad.addColorStop(1,    `rgba(${props.color},0)`)
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  return c
}

// ---- 粒子 ----
// 湧き出し口は作らない。寿命が来た粒は画面のどこか別の場所に、
// また 0 から立ち上がる（= ふっと現れて、ふっと消える）
function spawn(p, stagger = false) {
  p.x = rand(0, w)
  p.y = rand(0, h)
  p.vx = rand(-3, 3)          // px/s：ほとんど留まったまま、わずかに漂う
  p.vy = rand(-3, 1)          // 上下もほぼ均等。ごくわずかに上寄り
  p.size = rand(3, 9)         // 見た目の直径（スプライトは拡縮）
  p.alpha = rand(0.25, 1)     // 個体差（maxAlpha に掛ける）
  p.wobbleAmp = rand(4, 14)
  p.wobbleSpd = rand(0.2, 0.6)
  p.twinkleSpd = rand(0.3, 1.2)
  p.phase = rand(0, Math.PI * 2)
  p.maxLife = rand(10, 22)    // 秒。寿命の前後 FADE_RATIO を使って出入りする
  // 初期配置だけは寿命の途中から始めて、全部が同時に明滅しないようにする
  p.life = stagger ? rand(0, p.maxLife) : 0
  return p
}

function initParticles() {
  particles = Array.from({ length: props.count }, () => spawn({}, true))
}

// ---- 描画ループ ----
function frame(t) {
  if (!running) return
  rafId = requestAnimationFrame(frame)

  const interval = 1000 / props.fps
  const elapsed = t - lastT
  if (elapsed < interval) return
  // 間引いた分の端数を持ち越して、平均 fps が狙い通りになるようにする
  lastT = t - (elapsed % interval)
  const dt = Math.min(elapsed, 100) / 1000   // 復帰直後の巨大 dt を抑える

  ctx.clearRect(0, 0, w, h)
  ctx.globalCompositeOperation = 'lighter'

  for (const p of particles) {
    p.life += dt
    p.phase += dt
    if (p.life > p.maxLife) spawn(p)

    p.x += (p.vx + Math.sin(p.phase * p.wobbleSpd) * p.wobbleAmp * 0.3) * dt
    p.y += p.vy * dt
    // ほとんど動かないが、端に出た分は反対側へ回す
    if (p.y < -20) p.y = h + 20
    if (p.y > h + 20) p.y = -20
    if (p.x < -20) p.x = w + 20
    if (p.x > w + 20) p.x = -20

    // 瞬き × 寿命の両端でのゆっくりしたフェード
    const twinkle = 0.8 + 0.2 * Math.sin(p.phase * p.twinkleSpd * 2)
    const fade = p.maxLife * FADE_RATIO
    const edge = Math.max(0, Math.min(1, p.life / fade, (p.maxLife - p.life) / fade))
    const eased = edge * edge * (3 - 2 * edge)   // smoothstep：出入りの角を取る
    const a = props.maxAlpha * p.alpha * twinkle * eased
    if (a <= 0.01) continue

    const d = p.size * 4   // スプライトは中心が明るいので、見た目の直径の約4倍で描く
    ctx.globalAlpha = a
    ctx.drawImage(sprite, p.x - d / 2, p.y - d / 2, d, d)
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}

function start() {
  if (running || !ctx || reduceMotion || !props.enabled) return
  running = true
  lastT = performance.now()
  rafId = requestAnimationFrame(frame)
}

function stop() {
  running = false
  cancelAnimationFrame(rafId)
}

function clear() {
  if (ctx) ctx.clearRect(0, 0, w, h)
}

// ---- サイズ ----
function resize() {
  const el = canvasRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  w = Math.max(1, Math.round(rect.width))
  h = Math.max(1, Math.round(rect.height))
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  el.width  = Math.round(w * dpr)
  el.height = Math.round(h * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  if (particles.length === 0) initParticles()
}

// ---- 表示状態 ----
function onVisibility() {
  if (document.hidden) stop()
  else start()
}

onMounted(() => {
  const el = canvasRef.value
  ctx = el.getContext('2d', { alpha: true })
  reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  sprite = makeSprite()
  resize()
  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(el)
  document.addEventListener('visibilitychange', onVisibility)
  start()
})

onBeforeUnmount(() => {
  stop()
  resizeObserver?.disconnect()
  document.removeEventListener('visibilitychange', onVisibility)
})

watch(() => props.enabled, (on) => {
  if (on) start()
  else { stop(); clear() }
})

watch(() => props.count, () => { particles = []; resize() })
</script>

<template>
  <canvas
    ref="canvasRef"
    aria-hidden="true"
    class="absolute inset-0 w-full h-full pointer-events-none"
  />
</template>
