// composables/usePlayback.js
// 再生の制御：モードによるループの切り替えと、環境音・エンジン（バックグラウンド再生）・MediaSession の開始と停止
//
// 使う側:
//   const ambient = useAmbientSound()
//   const { isPlaying, toggle, ... } = usePlayback({ mode, setMode, selectedSpeaker, ambient })
// onMounted の登録順を変えないよう、useSpeaker・useMode・useAmbientSound などの後に呼ぶ

import { shallowRef, computed, watch, onMounted } from 'vue'
import { useWordLoop }  from '~/composables/useWordLoop'
import { useStoryLoop } from '~/composables/useStoryLoop'
import { unlock as unlockAudio, setPlaying as setEnginePlaying } from '~/lib/audio/background'
import { setupMediaSession, updateMediaMetadata }                from '~/lib/audio/mediaSession'
import { getVoiceBus }                                           from '~/lib/audio/voiceBus'

export function usePlayback({ mode, setMode, selectedSpeaker, ambient }) {
  const {
    word,
    phrase,
    isPlaying:         wordPlaying,
    progress:          wordProgress,
    phase,
    phaseLabel,
    stop:              _stop,
    start:             _start,
    playPhraseByType,
  } = useWordLoop(computed(() => selectedSpeaker.value?.id))

  const {
    isPlaying: storyPlaying,
    progress:  storyProgress,
    start:     startStory,
    stop:      stopStory,
  } = useStoryLoop()

  // モードによって使うループを切り替える（どちらも公開 API は同じ形）。
  // 環境音・タイマー・MediaSession・バックグラウンド再生の仕組みは両モード共通
  const isStory   = computed(() => mode.value === 'story')
  const isPlaying = computed(() => isStory.value ? storyPlaying.value : wordPlaying.value)
  const progress  = computed(() => isStory.value ? storyProgress.value : wordProgress.value)

  async function stop() {
    if (isStory.value) await stopStory()
    else await _stop()
    ambient.stopAudio()
    setEnginePlaying(false)
  }

  async function stopWithPhrase() {
    // 停止中にタイマーが切れたときは何もしない（セリフも環境音のフェードも不要）
    if (!isPlaying.value) return
    if (isStory.value) {
      await stopStory()
    } else {
      await _stop(true)
      await playPhraseByType('stop')
    }
    await ambient.fadeOutAudio(0, 3000)
    setEnginePlaying(false)
  }

  // 波形に渡す声のバスの Analyser（AudioContext はタップ後に作るので、それまでは null）
  const voiceAnalyser = shallowRef(null)

  // ユーザーのタップから同期的に呼ばれる必要がある（unlockAudio のため）
  function start() {
    if (isPlaying.value) return
    unlockAudio()
    voiceAnalyser.value = getVoiceBus().analyser
    if (isStory.value) startStory()
    else _start()
    // おはなしはまだ再生の中身が無く、再生状態にならない。そのときは何も鳴らさない
    if (!isPlaying.value) {
      setEnginePlaying(false)
      return
    }
    setEnginePlaying(true)
    ambient.startIfEnabled()
  }

  const toggle = () => {
    if (isPlaying.value) {
      stop()
    } else {
      start()
    }
  }

  // 再生中に切り替えたら、いったん止めてから切り替える
  async function selectMode(id) {
    if (id === mode.value) return
    if (isPlaying.value) await stop()
    setMode(id)
  }

  // ロック画面・通知・イヤホンのボタン
  onMounted(() => {
    setupMediaSession({
      title:   'SOMNIOVOX',
      artist:  selectedSpeaker.value?.name ?? '',
      artwork: [{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
      onPlay:  () => start(),
      onPause: () => stop(),
    })
  })
  watch(selectedSpeaker, (s) => {
    updateMediaMetadata({
      title:   'SOMNIOVOX',
      artist:  s?.name ?? '',
      artwork: [{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
    })
  })

  return {
    word,
    phrase,
    phase,
    phaseLabel,
    isPlaying,
    progress,
    voiceAnalyser,
    stop,
    stopWithPhrase,
    toggle,
    selectMode,
  }
}
