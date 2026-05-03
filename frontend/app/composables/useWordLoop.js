// composables/useWordLoop.js
// 単語取得・読み上げのメインループ

import { ref, computed } from 'vue'

const API_BASE = 'http://127.0.0.1:8000'
const PAUSE_MS = 8000

// セリフ後の間
const PHRASE_PAUSE_MS = 5000

// 何語おきにリラックスセリフを挟むか（この値 ± RELAX_JITTER でランダム）
const RELAX_INTERVAL = 10
const RELAX_JITTER   = 3

export function useWordLoop(sessionId, speakerId, { playNext, startProgress, resetProgress, stopAudio }) {
  const word      = ref('タップして開始')
  const isPlaying = ref(false)
  const phase     = ref('idle')

  const phaseLabel = computed(() => {
    if (phase.value === 'loading')  return '読み込み中…'
    if (phase.value === 'speaking') return '読み上げ中'
    if (phase.value === 'pause')    return '思い浮かべて...'
    if (phase.value === 'phrase')   return ''
    return ''
  })

  let stopped = false
  let prev           = null
  let sessionStarted = false  // セッション内で開始セリフを流したか

  // 次のリラックスセリフまでのカウンタ
  let wordCount    = 0
  let nextRelaxAt  = _nextRelaxCount()

  function _nextRelaxCount() {
    return RELAX_INTERVAL + Math.floor(Math.random() * RELAX_JITTER * 2 + 1) - RELAX_JITTER
  }

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

  async function fetchPhrase(type) {
    const params = new URLSearchParams({
      type,
      speaker: speakerId.value,
    })
    const res = await fetch(`${API_BASE}/phrase?${params}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data = await res.json()
    if (data.audio_url?.startsWith('/')) {
      data.audio_url = API_BASE + data.audio_url
    }
    return data
  }

  async function playPhrase(type) {
    try {
      const data = await fetchPhrase(type)
      phase.value = 'phrase'
      resetProgress()
      await playNext(data.audio_url)
      // セリフ後に短い間
      await new Promise(resolve => setTimeout(resolve, PHRASE_PAUSE_MS))
    } catch {
      // セリフ再生失敗は無視してループ継続
    }
  }

  async function loop() {
    // 開始セリフ：セッション内で初回のみ
    if (!sessionStarted) {
      sessionStarted = true
      await playPhrase('start')
      if (stopped) return
    }

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
      // リラックスセリフのタイミングチェック
      if (wordCount > 0 && wordCount >= nextRelaxAt) {
        await playPhrase('relax')
        if (stopped) break
        wordCount   = 0
        nextRelaxAt = _nextRelaxCount()
        // セリフ後は次の単語を再取得
        phase.value = 'loading'
        try {
          next = await fetchNext(prev)
        } catch {
          break
        }
        if (stopped) break
      }

      // 単語・音声を表示＆再生
      word.value  = next.word
      prev        = next.word
      phase.value = 'speaking'
      wordCount++

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

      // 次の単語を取得
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
    stopped    = false
    prev       = null
    wordCount  = 0
    nextRelaxAt = _nextRelaxCount()
    await loop()
    isPlaying.value = false
  }

  async function stop(playStopPhrase = false) {
    stopped         = true
    isPlaying.value = false
    prev            = null
    stopAudio()
    phase.value = 'idle'

    if (playStopPhrase) {
      await playPhrase('stop')
    }
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