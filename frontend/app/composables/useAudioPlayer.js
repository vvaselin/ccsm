// composables/useAudioPlayer.js
// 単語・セリフ音声の再生と進捗バー管理（出力は useAudioEngine の声のバス）

import { ref } from 'vue'
import { getCtx, getVoiceBus, getVoicePanWidth, audioWait } from '~/composables/useAudioEngine'

export function useAudioPlayer() {
  const progress = ref(0)

  let currentSource = null
  let progressTimer = null
  let panSide       = 1

  async function playAudio(audioUrl, panValue = 0) {
    const ctx = getCtx()
    if (ctx.state === 'suspended') await ctx.resume()

    const res      = await fetch(audioUrl)
    if (!res.ok) throw new Error(`音声の取得に失敗: ${audioUrl}`)
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
      panner.connect(getVoiceBus().input)
      source.onended = () => resolve(buffer.duration)
      source.start()
      currentSource = source
    })
  }

  function startProgress(durationMs) {
    clearInterval(progressTimer)
    progress.value = 0
    const start = Date.now()
    // UI 用。背面では間引かれるが、戻ってきた時に Date.now() で追いつくので問題ない
    progressTimer = setInterval(() => {
      progress.value = Math.min(((Date.now() - start) / durationMs) * 100, 100)
    }, 50)
  }

  function resetProgress() {
    clearInterval(progressTimer)
    progress.value = 0
  }

  // 単語用：左右交互に振る。振り幅は声の距離で変わる
  async function playNext(audioUrl) {
    const duration = await playAudio(audioUrl, panSide * getVoicePanWidth())
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
    wait: audioWait,   // ループの待機に使う（setTimeout の代わり）
  }
}
