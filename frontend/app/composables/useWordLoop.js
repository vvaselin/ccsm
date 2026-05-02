// composables/useWordLoop.js
// 単語取得・読み上げのメインループ

import { ref, computed } from 'vue'

const API_BASE = 'http://127.0.0.1:8000'
const PAUSE_MS = 8000

export function useWordLoop(sessionId, speakerId, { playNext, startProgress, resetProgress, stopAudio }) {
  const word      = ref('タップして開始')
  const isPlaying = ref(false)
  const phase     = ref('idle')

  const phaseLabel = computed(() => {
    if (phase.value === 'loading')  return '読み込み中…'
    if (phase.value === 'speaking') return '読み上げ中'
    if (phase.value === 'pause')    return '思い浮かべて...'
    return ''
  })

  let stopped = false
  let prev    = null

  async function fetchNext(prevWord) {
    const params = new URLSearchParams({
      speaker:    speakerId.value,
      session_id: sessionId.value,
    })
    if (prevWord) params.set('prev', prevWord)

    const res = await fetch(`${API_BASE}/next?${params}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data = await res.json()
    if (data.audio_url?.startsWith('/')) {
      data.audio_url = API_BASE + data.audio_url
    }
    return data
  }

  async function loop() {
    // 最初の単語を取得
    phase.value = 'loading'
    let next
    try {
      next = await fetchNext(null)
    } catch {
      word.value      = 'エラー'
      isPlaying.value = false
      phase.value     = 'idle'
      return
    }

    while (!stopped) {
      // 単語・音声を表示＆再生
      word.value  = next.word
      prev        = next.word
      phase.value = 'speaking'

      let speakDuration = 1.5
      try {
        speakDuration = await playNext(next.audio_url)
        startProgress(speakDuration * 1000)
      } catch {
        startProgress(speakDuration * 1000)
      }

      // 間（ポーズ）
      if (stopped) break
      phase.value = 'pause'
      resetProgress()
      startProgress(PAUSE_MS)
      await new Promise(resolve => setTimeout(resolve, PAUSE_MS))

      // 間が終わったタイミングで次を取得（この時点のspeakerIdが使われる）
      if (stopped) break
      phase.value = 'loading'
      resetProgress()
      try {
        next = await fetchNext(prev)
      } catch {
        break
      }
      if (stopped) break
    }

    resetProgress()
    phase.value = 'idle'
  }

  async function start() {
    if (isPlaying.value) return
    isPlaying.value = true
    stopped = false
    prev    = null
    await loop()
    isPlaying.value = false
  }

  function stop() {
    stopped         = true
    isPlaying.value = false
    prev            = null
    stopAudio()
    phase.value = 'idle'
  }

  const toggle = () => isPlaying.value ? stop() : start()

  return {
    word,
    isPlaying,
    phase,
    phaseLabel,
    start,
    stop,
    toggle,
  }
}