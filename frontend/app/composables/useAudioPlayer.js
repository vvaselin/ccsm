// composables/useAudioPlayer.js
// Web Audio API による音声再生・進捗バー管理

import { ref } from 'vue'

const PAN_STRENGTH = 0.8

export function useAudioPlayer() {
  const progress = ref(0)

  let audioCtx      = null
  let currentSource = null
  let progressTimer = null
  let panSide       = 1

  function getAudioCtx() {
    if (!audioCtx) audioCtx = new AudioContext()
    return audioCtx
  }

  async function playAudio(audioUrl, panValue = 0) {
    const ctx = getAudioCtx()
    if (ctx.state === 'suspended') await ctx.resume()

    const res      = await fetch(audioUrl)
    const arrayBuf = await res.arrayBuffer()
    const buffer   = await ctx.decodeAudioData(arrayBuf)

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

  async function playNext(audioUrl) {
    const duration = await playAudio(audioUrl, panSide * PAN_STRENGTH)
    panSide *= -1
    return duration
  }

  // セリフ用：パンを変えずに中央で再生
  async function playPhrase(audioUrl) {
    return await playAudio(audioUrl, 0)
  }

  function stopAudio() {
    if (currentSource) {
      currentSource.onended = null
      try { currentSource.stop() } catch {}
      currentSource = null
    }
    panSide = 1
    resetProgress()
  }

  return {
    progress,
    playNext,
    playPhrase,
    stopAudio,
    startProgress,
    resetProgress,
  }
}