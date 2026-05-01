<script setup>
import { ref, computed, onUnmounted } from 'vue'

// --- 設定 ---
const API_BASE = 'http://127.0.0.1:8000'
const PAUSE_MS = 3000
const DEFAULT_SPEAKER = 50
const PAN_STRENGTH = 0.8

const TIMER_OPTIONS = [
  { label: '30秒', ms: 30 * 1000 },
  { label: '15分', ms: 15 * 60 * 1000 },
  { label: '30分', ms: 30 * 60 * 1000 },
  { label: '45分', ms: 45 * 60 * 1000 },
  { label: '60分', ms: 60 * 60 * 1000 },
]

// --- セッションID ---
function getOrCreateSessionId() {
  const key = 'cssm_session_id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}
const sessionId = getOrCreateSessionId()

// --- 状態 ---
const word = ref('タップして開始')
const isPlaying = ref(false)
const phase = ref('idle')
const progress = ref(0)

// スリープタイマー
const timerOption = ref(null)
const timerRemainMs = ref(0)       // 残りミリ秒
const showTimerMenu = ref(false)   // メニュー表示フラグ

const timerLabel = computed(() => {
  if (!timerOption.value) return ''
  const m = Math.floor(timerRemainMs.value / 60000)
  const s = Math.floor((timerRemainMs.value % 60000) / 1000)
  return `${m}:${String(s).padStart(2, '0')}`
})

let prev = null
let stopped = false
let audioCtx = null
let currentSource = null
let progressTimer = null
let panSide = 1

// スリープタイマー用
let timerEndTime = null
let timerTick = null

// --- スリープタイマー ---
function setTimer(option) {
  timerOption.value = option
  showTimerMenu.value = false
  if (option === null) {
    timerEndTime = null
    timerRemainMs.value = 0
    clearInterval(timerTick)
    timerTick = null
    return
  }
  timerEndTime = Date.now() + option.ms
  timerRemainMs.value = option.ms
  clearInterval(timerTick)
  timerTick = setInterval(() => {
    const remain = timerEndTime - Date.now()
    if (remain <= 0) {
      timerRemainMs.value = 0
      clearInterval(timerTick)
      timerTick = null
      stop()
    } else {
      timerRemainMs.value = remain
    }
  }, 500)
}

// --- AudioContext ---
function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}

// --- base64 → ArrayBuffer ---
function b64ToArrayBuffer(b64) {
  const bin = atob(b64)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf.buffer
}

// --- 音声再生 ---
async function playAudio(b64, panValue = 0) {
  const ctx = getAudioCtx()
  if (ctx.state === 'suspended') await ctx.resume()
  const arrayBuf = b64ToArrayBuffer(b64)
  const buffer = await ctx.decodeAudioData(arrayBuf)
  return new Promise((resolve) => {
    if (currentSource) {
      currentSource.onended = null
      try { currentSource.stop() } catch {}
    }
    const source = ctx.createBufferSource()
    const panner = ctx.createStereoPanner()
    panner.pan.value = panValue
    source.buffer = buffer
    source.connect(panner)
    panner.connect(ctx.destination)
    source.onended = () => resolve(buffer.duration)
    source.start()
    currentSource = source
  })
}

// --- 進捗バー ---
function startProgress(durationMs) {
  clearInterval(progressTimer)
  progress.value = 0
  const start = Date.now()
  progressTimer = setInterval(() => {
    progress.value = Math.min(((Date.now() - start) / durationMs) * 100, 100)
  }, 16)
}

function resetProgress() {
  clearInterval(progressTimer)
  progress.value = 0
}

// --- API ---
async function fetchNext(prevWord) {
  const params = new URLSearchParams({ speaker: DEFAULT_SPEAKER, session_id: sessionId })
  if (prevWord) params.set('prev', prevWord)
  const res = await fetch(`${API_BASE}/next?${params}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// --- メインループ ---
async function loop() {
  phase.value = 'loading'
  let next
  try {
    next = await fetchNext(null)
  } catch {
    word.value = 'エラー'
    isPlaying.value = false
    phase.value = 'idle'
    return
  }

  while (!stopped) {
    word.value = next.word
    prev = next.word
    phase.value = 'speaking'

    const prefetchPromise = fetchNext(prev).catch(() => null)

    let speakDuration = 1.5
    try {
      speakDuration = await playAudio(next.audio, panSide * PAN_STRENGTH)
      panSide *= -1
      startProgress(speakDuration * 1000)
    } catch {
      panSide *= -1
      startProgress(speakDuration * 1000)
    }

    if (stopped) break
    phase.value = 'pause'
    resetProgress()
    startProgress(PAUSE_MS)
    await new Promise(resolve => setTimeout(resolve, PAUSE_MS))

    if (stopped) break
    phase.value = 'loading'
    resetProgress()
    const prefetched = await prefetchPromise
    if (!prefetched || stopped) break

    next = prefetched
  }

  resetProgress()
  phase.value = 'idle'
}

// --- 操作 ---
const start = async () => {
  if (isPlaying.value) return
  isPlaying.value = true
  stopped = false
  panSide = 1
  prev = null
  await loop()
  isPlaying.value = false
}

const stop = () => {
  stopped = true
  isPlaying.value = false
  if (currentSource) {
    currentSource.onended = null
    try { currentSource.stop() } catch {}
    currentSource = null
  }
  panSide = 1
  resetProgress()
  phase.value = 'idle'
}

const toggle = () => isPlaying.value ? stop() : start()

onUnmounted(() => {
  stop()
  clearInterval(timerTick)
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center">
    <div class="w-80 flex flex-col items-center gap-8 px-6 py-12">

      <!-- 単語表示 -->
      <div class="text-center">
        <p class="text-sm text-gray-500 mb-2">
          {{ phase === 'loading' ? '読み込み中…' : phase === 'speaking' ? '読み上げ中' : phase === 'pause' ? '思い浮かべて...' : '' }}
          &nbsp;
        </p>
        <p class="text-5xl font-medium tracking-wide text-gray-100">{{ word }}</p>
      </div>

      <!-- 進捗バー -->
      <div class="w-full px-1">
        <div class="w-full h-0.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-colors duration-300"
            :class="{
              'bg-gray-200': phase === 'speaking',
              'bg-gray-500': phase === 'pause',
              'bg-gray-600 animate-pulse': phase === 'loading',
            }"
            :style="{ width: progress + '%' }"
          />
        </div>
      </div>

      <!-- 再生ボタン + タイマーボタン -->
      <div class="relative flex items-center justify-center w-full">

        <!-- 再生・停止ボタン -->
        <button
          @click="toggle"
          class="w-18 h-18 rounded-full flex items-center justify-center transition-transform active:scale-95 bg-gray-700 hover:bg-gray-600"
          style="width:72px;height:72px"
        >
          <!-- 停止アイコン -->
          <span v-if="isPlaying" class="block w-5 h-5 bg-gray-200 rounded-sm" />
          <!-- 再生アイコン -->
          <span v-else class="block ml-1" style="width:0;height:0;border-top:13px solid transparent;border-bottom:13px solid transparent;border-left:20px solid white" />
        </button>

        <!-- タイマーボタン + 残り時間（右側） -->
        <div class="absolute flex items-center gap-2" style="left: calc(50% + 44px)">
          <button
            @click="showTimerMenu = !showTimerMenu"
            class="flex items-center justify-center rounded-full border transition-colors"
            :class="timerOption
              ? 'bg-gray-200 border-transparent'
              : 'bg-gray-800 border-gray-600'"
            style="width:38px;height:38px;flex-shrink:0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              :stroke="timerOption ? '#1f2937' : '#d1d5db'"
            >
              <circle cx="12" cy="13" r="8"/>
              <path d="M12 9v4l2 2"/>
              <path d="M9 2h6"/>
              <path d="M12 2v3"/>
            </svg>
          </button>
          <span
            v-if="timerOption"
            class="text-sm font-medium text-gray-400 tabular-nums"
            style="min-width:36px"
          >{{ timerLabel }}</span>
        </div>

      </div>

      <!-- タイマーオーバーレイ -->
      <Transition name="fade">
        <div
          v-if="showTimerMenu"
          class="fixed inset-0 flex items-center justify-center z-50"
          style="background:rgba(0,0,0,0.6);backdrop-filter:blur(4px)"
          @click.self="showTimerMenu = false"
        >
          <div class="w-72 bg-gray-800 rounded-2xl border border-gray-700 p-5">
            <p class="text-xs text-gray-500 text-center mb-4">スリープタイマー</p>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="opt in TIMER_OPTIONS"
                :key="opt.ms"
                @click="setTimer(opt)"
                class="py-3 rounded-xl text-sm font-medium transition-colors"
                :class="timerOption?.ms === opt.ms
                  ? 'bg-gray-200 text-gray-900'
                  : 'border border-gray-600 text-gray-300 hover:border-gray-400'"
              >
                {{ opt.label }}
              </button>
            </div>
            <button
              @click="setTimer(null)"
              class="w-full mt-4 pt-4 border-t border-gray-700 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              オフ
            </button>
          </div>
        </div>
      </Transition>

    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>