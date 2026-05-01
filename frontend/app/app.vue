<script setup>
import { ref, onUnmounted } from 'vue'

// --- 設定 ---
const API_BASE = 'http://127.0.0.1:8000'
const PAUSE_MS = 8000       // 読み上げ後の間（ミリ秒）
const DEFAULT_SPEAKER = 50  // ナースロボ＿タイプＴ 内緒話

// --- 状態 ---
const word = ref('ボタンを押してね')
const isPlaying = ref(false)
const phase = ref('idle')   // 'speaking' | 'pause' | 'loading' | 'idle'
const progress = ref(0)

let prev = null
let stopped = false
let audioCtx = null
let currentSource = null
let progressTimer = null

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

// --- 音声再生（再生時間をPromiseで返す）---
async function playAudio(b64) {
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
    source.buffer = buffer
    source.connect(ctx.destination)
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

// --- /next を叩いて { word, audio } を取得 ---
async function fetchNext(prevWord) {
  const params = new URLSearchParams({ speaker: DEFAULT_SPEAKER })
  if (prevWord) params.set('prev', prevWord)
  const res = await fetch(`${API_BASE}/next?${params}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()  // { word, audio }
}

// --- メインループ ---
async function loop() {
  // 最初の1語を取得（loading表示）
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
    // テキストと音声を同時に開始
    word.value = next.word
    prev = next.word
    phase.value = 'speaking'

    // バックグラウンドで次を先読み（単語テキストはまだ表示しない）
    const prefetchPromise = fetchNext(prev).catch(() => null)

    // 音声再生（再生時間が返ってくる）
    let speakDuration = 1.5
    try {
      speakDuration = await playAudio(next.audio)
      startProgress(speakDuration * 1000)
    } catch {
      startProgress(speakDuration * 1000)
    }

    // 読み上げ終了 → 間
    if (stopped) break
    phase.value = 'pause'
    resetProgress()
    startProgress(PAUSE_MS)
    await new Promise(resolve => setTimeout(resolve, PAUSE_MS))

    // 間が終わったら先読み結果を待つ
    if (stopped) break
    phase.value = 'loading'
    resetProgress()
    const prefetched = await prefetchPromise
    if (!prefetched || stopped) break

    next = prefetched
    // → ループ先頭で word.value = next.word （テキスト切り替えと再生が同時）
  }

  resetProgress()
  phase.value = 'idle'
}

// --- 操作 ---
const start = async () => {
  if (isPlaying.value) return
  isPlaying.value = true
  stopped = false
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
  resetProgress()
  phase.value = 'idle'
}

const toggle = () => isPlaying.value ? stop() : start()

onUnmounted(() => stop())
</script>

<template>
  <div class="p-4 max-w-md mx-auto">
    <div class="flex justify-center">
      <button
        @click="toggle"
        class="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl transition-transform active:scale-90"
        :class="isPlaying ? 'bg-red-500' : 'bg-blue-500'"
      >
        {{ isPlaying ? '■' : '▶' }}
      </button>
    </div>

    <UCard class="mt-4 text-center">
      <!-- 単語表示 -->
      <div class="text-4xl font-bold h-32 flex items-center justify-center">
        {{ word }}
      </div>

      <!-- 進捗バー -->
      <div class="mt-4 px-2">
        <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            class="h-full rounded-full transition-colors duration-300"
            :class="{
              'bg-primary':              phase === 'speaking',
              'bg-gray-400':             phase === 'pause',
              'bg-gray-300 animate-pulse': phase === 'loading',
            }"
            :style="{ width: progress + '%' }"
          />
        </div>
      </div>
    </UCard>
  </div>
</template>