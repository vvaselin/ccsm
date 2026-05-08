// composables/useWordLoop.js
// 単語取得・読み上げのメインループ（APIなし・フロント完結版）

import { ref, computed } from 'vue'
import { useWordPicker } from '~/composables/useWordPicker'

const PAUSE_MIN_MS    = 8000   // 最小待機時間: 8秒
const PAUSE_MAX_MS    = 13000  // 最大待機時間: 13秒
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

// ランダムな待機時間を生成（8秒～13秒）
function getRandomPauseTime() {
  return PAUSE_MIN_MS + Math.random() * (PAUSE_MAX_MS - PAUSE_MIN_MS)
}

export function useWordLoop(speakerId, { playNext, playPhrase: playPhraseAudio, startProgress, resetProgress, stopAudio }) {
  const { pickNext } = useWordPicker()

  const word      = ref('再生ボタンで開始')
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

  let currentLoopId = 0  // 現在のループを識別するID
  let sessionStarted = false
  let prev = null
  let wordCount = 0
  let nextRelaxAt = _nextRelaxCount()

  function _nextRelaxCount() {
    return RELAX_INTERVAL + Math.floor(Math.random() * RELAX_JITTER * 2 + 1) - RELAX_JITTER
  }

  async function playPhrase(type, loopId) {
    try {
      const phrases = await loadPhrases()
      const text    = pickPhrase(phrases, type, speakerId.value)
      if (!text) return

      // ループが無効化されていないかチェック
      if (loopId !== currentLoopId) return

      phrase.value = text
      phase.value  = 'phrase'
      resetProgress()

      await playPhraseAudio(phraseAudioUrl(text, speakerId.value))
      
      // 待機中にループが無効化されていないかチェック
      if (loopId !== currentLoopId) return
      
      await new Promise(resolve => setTimeout(resolve, PHRASE_PAUSE_MS))
    } catch {
      // セリフ再生失敗は無視してループ継続
    } finally {
      // ループが有効な場合のみクリア
      if (loopId === currentLoopId) {
        phrase.value = ''
      }
    }
  }

  async function loop(loopId) {
    // このループが最新でなければ即座に終了
    if (loopId !== currentLoopId) return

    if (!sessionStarted) {
      sessionStarted = true
      await playPhrase('start', loopId)
      if (loopId !== currentLoopId) return
    }

    phase.value = 'loading'
    let nextWord
    try {
      nextWord = await pickNext(null)
    } catch {
      if (loopId !== currentLoopId) return
      word.value      = 'エラー'
      isPlaying.value = false
      phase.value     = 'idle'
      return
    }

    while (loopId === currentLoopId) {
      if (wordCount > 0 && wordCount >= nextRelaxAt) {
        await playPhrase('relax', loopId)
        if (loopId !== currentLoopId) break
        wordCount   = 0
        nextRelaxAt = _nextRelaxCount()
        phase.value = 'loading'
        try { nextWord = await pickNext(prev) } catch { break }
        if (loopId !== currentLoopId) break
      }

      word.value  = nextWord
      prev        = nextWord
      phase.value = 'speaking'
      wordCount++

      let speakDuration = 1.5
      try {
        speakDuration = await playNext(wordAudioUrl(nextWord, speakerId.value))
        if (loopId !== currentLoopId) break
        startProgress(speakDuration * 1000)
      } catch {
        if (loopId !== currentLoopId) break
        startProgress(speakDuration * 1000)
      }

      if (loopId !== currentLoopId) break
      
      // ランダムな待機時間を取得（8秒～13秒）
      const pauseTime = getRandomPauseTime()
      
      phase.value = 'pause'
      resetProgress()
      startProgress(pauseTime)
      await new Promise(resolve => setTimeout(resolve, pauseTime))

      if (loopId !== currentLoopId) break
      phase.value = 'loading'
      resetProgress()
      try { nextWord = await pickNext(prev) } catch { break }
      if (loopId !== currentLoopId) break
    }

    // このループが最新の場合のみ状態をリセット
    if (loopId === currentLoopId) {
      resetProgress()
      phase.value = 'idle'
      isPlaying.value = false
    }
  }

  async function start() {
    // 既に再生中の場合は何もしない
    if (isPlaying.value) return
    
    // 新しいループIDを発行（古いループを無効化）
    const loopId = ++currentLoopId
    
    stopAudio()
    isPlaying.value = true
    prev        = null
    wordCount   = 0
    nextRelaxAt = _nextRelaxCount()
    
    await loop(loopId)
  }

  async function stop(stopPlayerAudio = true) {
    // 現在のループを無効化
    currentLoopId++
    
    isPlaying.value = false
    prev            = null
    if (stopPlayerAudio) stopAudio()
    phase.value = 'idle'
    resetProgress()
  }

  async function playPhraseByType(type) {
    // 単発のフレーズ再生用（ループIDは不要）
    const loopId = currentLoopId
    await playPhrase(type, loopId)
  }

  const toggle = async () => {
    if (isPlaying.value) {
      await stop()
    } else {
      await start()
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