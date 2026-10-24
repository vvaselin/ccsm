<!-- components/VoiceWaveform.vue -->
<!--
  おはなしモードの声の波形。セリフや話者名の代わりに、声の揺れだけを見せる。
  44 本の縦棒（中央 16 本は差し色）。高さは声のバスの AnalyserNode から取る。

  使い方:
    <VoiceWaveform :analyser="analyser" :active="isPlaying" />

  省電力の工夫（DustLayer と同じ）:
    - 30fps に間引く
    - タブが非表示になったら rAF を止め、戻ったら再開
    - prefers-reduced-motion のときは動かさず、高さを固定する
-->
<script setup>
import { watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  analyser: { type: Object,  default: null },   // AnalyserNode。無いときは平らな線
  active:   { type: Boolean, default: false },  // 再生中だけ動かす
})

const BAR_COUNT    = 44
const ACCENT_COUNT = 16      // 中央の差し色の本数
const HALF         = BAR_COUNT / 2
const MIN_H        = 4       // 停止中の平らな線（px）
const MAX_H        = 64
const FPS          = 30

// 周波数ビンを左右 22 本ずつに間引く範囲。声（ささやき声）の帯域を対数で分ける
const FREQ_LO = 250
const FREQ_HI = 6000
const EDGE_TAPER = 0.6   // 外側ほど低くして、中央が盛り上がる形にする（端は 1 - 0.6 倍）

const CENTER = (BAR_COUNT - 1) / 2
const bars = Array.from({ length: BAR_COUNT }, (_, i) => ({
  i,
  accent: Math.abs(i - CENTER) < ACCENT_COUNT / 2,
}))

// reduced-motion で再生中のときの固定の形（中央が高い山）
const STILL_HEIGHTS = bars.map(({ i }) => {
  const d = (i - CENTER) / (HALF * 0.55)
  return Math.round(MIN_H + (MAX_H * 0.6 - MIN_H) * Math.exp(-d * d))
})

// 高さは 30fps で書き換えるので、Vue を通さず要素の style を直接触る
const barEls = []

let rafId = 0
let lastT = 0
let running = false
let reduceMotion = false
let data = null        // getByteFrequencyData の受け皿
let bandBins = []      // 片側 22 本ぶんの [開始ビン, 終了ビン)

// 中央が低い周波数、外へ行くほど高い周波数になるよう左右対称に並べる
function bandOf(i) {
  return i < HALF ? HALF - 1 - i : i - HALF
}

function setHeights(fn) {
  barEls.forEach((el, i) => {
    if (el) el.style.height = `${fn(i)}px`
  })
}

function setupBands(an) {
  data = new Uint8Array(an.frequencyBinCount)
  const binHz = an.context.sampleRate / an.fftSize
  const ratio = FREQ_HI / FREQ_LO
  bandBins = Array.from({ length: HALF }, (_, b) => {
    const lo = Math.floor((FREQ_LO * ratio ** (b / HALF)) / binHz)
    const hi = Math.ceil((FREQ_LO * ratio ** ((b + 1) / HALF)) / binHz)
    return [lo, Math.max(hi, lo + 1)]
  })
}

function frame(t) {
  if (!running) return
  rafId = requestAnimationFrame(frame)

  const interval = 1000 / FPS
  const elapsed = t - lastT
  if (elapsed < interval) return
  lastT = t - (elapsed % interval)

  props.analyser.getByteFrequencyData(data)
  const levels = bandBins.map(([lo, hi], b) => {
    let peak = 0
    for (let k = lo; k < hi; k++) peak = Math.max(peak, data[k])
    return (peak / 255) * (1 - EDGE_TAPER * (b / (HALF - 1)) ** 2)
  })
  setHeights(i => MIN_H + levels[bandOf(i)] * (MAX_H - MIN_H))
}

function start() {
  if (running || document.hidden) return
  if (!data) setupBands(props.analyser)
  running = true
  lastT = performance.now()
  rafId = requestAnimationFrame(frame)
}

function stop() {
  running = false
  cancelAnimationFrame(rafId)
}

// 状態に合わせて動かす・止める
function sync() {
  if (props.active && props.analyser && !reduceMotion) {
    start()
    return
  }
  stop()
  if (props.active && reduceMotion) setHeights(i => STILL_HEIGHTS[i])
  else setHeights(() => MIN_H)
}

function onVisibility() {
  if (document.hidden) stop()
  else sync()
}

onMounted(() => {
  reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  document.addEventListener('visibilitychange', onVisibility)
  sync()
})

onBeforeUnmount(() => {
  stop()
  document.removeEventListener('visibilitychange', onVisibility)
})

watch(() => props.analyser, () => {
  stop()
  data = null
})
watch(() => [props.active, props.analyser], sync, { flush: 'post' })
</script>

<template>
  <div
    aria-hidden="true"
    class="flex items-center justify-center"
    style="height:64px; gap:3px; filter:drop-shadow(0 2px 10px rgba(0,0,0,0.5))"
  >
    <span
      v-for="bar in bars"
      :key="bar.i"
      :ref="(el) => { barEls[bar.i] = el }"
      class="wave-bar"
      :style="{ background: bar.accent ? 'var(--sv-accent)' : 'rgba(255,255,255,0.85)' }"
    />
  </div>
</template>

<style scoped>
/* 高さは script から直接書き換える（ここでは停止中の平らな線） */
.wave-bar {
  width: 3px;
  height: 4px;
  border-radius: 2px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.45);
}
</style>
