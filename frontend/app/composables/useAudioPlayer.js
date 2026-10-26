// composables/useAudioPlayer.js
// 単語・セリフ音声の再生と進捗バー管理（出力は lib/audio/voiceBus の声のバス）

import { ref } from 'vue'
import { getCtx, audioWait }             from '~/lib/audio/context'
import { getVoiceBus, getVoicePanWidth } from '~/lib/audio/voiceBus'

export function useAudioPlayer() {
  const progress = ref(0)

  let currentSource = null
  let progressTimer = null
  let panSide       = 1
  let generation    = 0   // stopAudio() のたびに進める（読み込み中に止められた音を鳴らさないため）

  async function playAudio(audioUrl, panValue = 0) {
    const gen = generation
    const ctx = getCtx()
    if (ctx.state === 'suspended') await ctx.resume()

    const res      = await fetch(audioUrl)
    if (!res.ok) throw new Error(`音声の取得に失敗: ${audioUrl}`)
    const arrayBuf = await res.arrayBuffer()
    const buffer   = await ctx.decodeAudioData(arrayBuf)
    if (gen !== generation) return 0   // 読み込み中に停止・モード切替された

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
    generation++
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
