// composables/useWordLoop.js
// 単語取得・読み上げのメインループ（APIなし・フロント完結版）

import { ref, computed } from 'vue'
import { useWordPicker } from '~/composables/useWordPicker'

const PAUSE_MS        = 8000
const PHRASE_PAUSE_MS = 5000
const RELAX_INTERVAL  = 10
const RELAX_JITTER    = 3

// 音声ファイルのベースURL
// 本番（GCS）: VITE_AUDIO_BASE_URL=https://storage.googleapis.com/cssm-audio
// ローカル: public/audio_cache/ を参照
const AUDIO_BASE = import.meta.env.VITE_AUDIO_BASE_URL || '/audio_cache'

// スピーカーIDに対応する口調スタイル（phrases.pyのSPEAKER_STYLEと同期）
const SPEAKER_STYLE = {
  19:  'formal',
  22:  'noda',
  31:  'default',
  36:  'ojosama',
  45:  'loli',
  50:  'default',
  105: 'loli',
  117: 'mon',
  125: 'formal',
}

let _phrasesCache = null

async function loadPhrases() {
  if (_phrasesCache) return _phrasesCache
  const res = await fetch('/phrases.json')
  if (!res.ok) throw new Error('phrases.json の読み込みに失敗しました')
  _phrasesCache = await res.json()
  return _phrasesCache
}

function pickPhrase(phrases, type, speakerId) {
  const style      = SPEAKER_STYLE[speakerId] ?? 'default'
  const candidates = phrases[type]?.[style] ?? phrases[type]?.['default'] ?? []
  if (candidates.length === 0) return null
  return candidates[Math.floor(Math.random() * candidates.length)]
}

function wordAudioUrl(word, speakerId) {
  return `${AUDIO_BASE}/speaker_${speakerId}/${encodeURIComponent(word)}.wav`
}

function phraseAudioUrl(phrase, speakerId) {
  return `${AUDIO_BASE}/phrases/speaker_${speakerId}/${encodeURIComponent(phrase)}.wav`
}

export function useWordLoop(speakerId, { playNext, playPhrase: playPhraseAudio, startProgress, resetProgress, stopAudio }) {
  const { pickNext } = useWordPicker()

  const word      = ref('タップして開始')
  const phrase    = ref('')
  const isPlaying = ref(false)
  const phase     = ref('idle')

  const phaseLabel = computed(() => {
    if (phase.value === 'loading')  return '読み込み中…'
    if (phase.value === 'speaking') return '読み上げ中'
    if (phase.value === 'pause')    return '思い浮かべて...'
    if (phase.value === 'phrase')   return ''
    return ''
  })

  let stopped        = false
  let prev           = null
  let sessionStarted = false

  let wordCount   = 0
  let nextRelaxAt = _nextRelaxCount()

  function _nextRelaxCount() {
    return RELAX_INTERVAL + Math.floor(Math.random() * RELAX_JITTER * 2 + 1) - RELAX_JITTER
  }

  async function playPhrase(type) {
    try {
      const phrases = await loadPhrases()
      const text    = pickPhrase(phrases, type, speakerId.value)
      if (!text) return

      phrase.value = text
      phase.value  = 'phrase'
      resetProgress()

      await playPhraseAudio(phraseAudioUrl(text, speakerId.value))
      await new Promise(resolve => setTimeout(resolve, PHRASE_PAUSE_MS))
    } catch {
      // セリフ再生失敗は無視してループ継続
    } finally {
      phrase.value = ''
    }
  }

  async function loop() {
    if (!sessionStarted) {
      sessionStarted = true
      await playPhrase('start')
      if (stopped) return
    }

    phase.value = 'loading'
    let nextWord
    try {
      nextWord = await pickNext(null)
    } catch {
      word.value      = 'エラー'
      isPlaying.value = false
      phase.value     = 'idle'
      return
    }

    while (!stopped) {
      if (wordCount > 0 && wordCount >= nextRelaxAt) {
        await playPhrase('relax')
        if (stopped) break
        wordCount   = 0
        nextRelaxAt = _nextRelaxCount()
        phase.value = 'loading'
        try { nextWord = await pickNext(prev) } catch { break }
        if (stopped) break
      }

      word.value  = nextWord
      prev        = nextWord
      phase.value = 'speaking'
      wordCount++

      let speakDuration = 1.5
      try {
        speakDuration = await playNext(wordAudioUrl(nextWord, speakerId.value))
        startProgress(speakDuration * 1000)
      } catch {
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
      try { nextWord = await pickNext(prev) } catch { break }
      if (stopped) break
    }

    resetProgress()
    phase.value = 'idle'
  }

  let _toggling = false  // 連打防止フラグ

  async function start() {
    if (isPlaying.value) return
    stopAudio()
    isPlaying.value = true
    stopped     = false
    prev        = null
    wordCount   = 0
    nextRelaxAt = _nextRelaxCount()
    await loop()
    isPlaying.value = false
  }

  async function stop(stopPlayerAudio = true) {
    stopped         = true
    isPlaying.value = false
    prev            = null
    if (stopPlayerAudio) stopAudio()
    phase.value = 'idle'
  }

  async function playPhraseByType(type) {
    await playPhrase(type)
  }

  const toggle = async () => {
    if (_toggling) return
    _toggling = true
    try {
      if (isPlaying.value) {
        await stop()
      } else {
        start()  // awaitしない
        // isPlayingがtrueになるまで少し待ってから解除
        await new Promise(r => setTimeout(r, 150))
      }
    } finally {
      _toggling = false
    }
  }

  return {
    word,
    phrase,
    isPlaying,
    phase,
    phaseLabel,
    start,
    stop,
    toggle,
    playPhraseByType,
  }
}