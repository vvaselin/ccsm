<!-- app.vue -->
<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { useSession }     from '~/composables/useSession'
import { useAudioPlayer } from '~/composables/useAudioPlayer'
import { useSleepTimer }  from '~/composables/useSleepTimer'
import { useWordLoop }    from '~/composables/useWordLoop'
import { useSpeaker }     from '~/composables/useSpeaker'
import { usePinkNoise }   from '~/composables/usePinkNoise'

const { sessionId } = useSession()

const {
  progress,
  playNext,
  stopAudio: stopPlayerAudio,
  startProgress,
  resetProgress,
} = useAudioPlayer()

const {
  timerOption,
  timerLabel,
  showTimerMenu,
  setTimer,
  dispose: disposeTimer,
} = useSleepTimer(() => stop())

const { selectedSpeaker, selectSpeaker } = useSpeaker()

const {
  isEnabled:      pinkNoiseOn,
  volume:         pinkNoiseVolume,
  toggle:         _togglePinkNoise,
  startIfEnabled: startPinkNoise,
  stopAudio:      stopPinkNoise,
  setVolume:      setPinkNoiseVolume,
  dispose:        disposePinkNoise,
} = usePinkNoise()

const {
  word,
  isPlaying,
  phase,
  phaseLabel,
  stop:   _stop,
  start:  _start,
  toggle: _toggle,
} = useWordLoop(
  sessionId,
  computed(() => selectedSpeaker.value?.id),
  { playNext, startProgress, resetProgress, stopAudio: stopPlayerAudio }
)

// ピンクノイズと連動したstart/stop/toggle
function stop() {
  _stop()
  stopPinkNoise()
}

function start() {
  _start()
  startPinkNoise()
}

const toggle = () => isPlaying.value ? stop() : start()

// 設定ボタン用：isEnabledを切り替え＋再生中ならON時に音も開始
function togglePinkNoise() {
  _togglePinkNoise()
  if (isPlaying.value && pinkNoiseOn.value) {
    startPinkNoise()
  }
}

const showSettingsMenu = ref(false)

onUnmounted(() => {
  stop()
  disposeTimer()
  disposePinkNoise()
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center" style="background:#0d0f12">
    <div
      class="relative flex flex-col justify-between overflow-hidden w-full"
      style="max-width:390px; height:100dvh; max-height:844px; background:#0d0f12"
    >

      <!-- 上部：フェーズラベル＋単語 -->
      <div class="text-center px-8" style="padding-top:64px">
        <p class="text-xs tracking-widest uppercase mb-4" style="color:#9aa0b0; height:16px">
          {{ phaseLabel }}&nbsp;
        </p>
        <p
          class="leading-none"
          style="font-size:56px; color:rgba(232,234,240,0.45); letter-spacing:-0.01em; font-family:serif"
        >
          {{ word }}
        </p>
      </div>

      <!-- 下部：進捗バー＋コントロール -->
      <div class="px-8 flex flex-col" style="padding-bottom:64px; gap:28px">
        <ProgressBar :progress="progress" :phase="phase" />
        <PlayerControls
          :is-playing="isPlaying"
          :timer-option="timerOption"
          :timer-label="timerLabel"
          :show-timer-menu="showTimerMenu"
          :show-settings-menu="showSettingsMenu"
          @toggle="toggle"
          @toggle-timer="showTimerMenu = !showTimerMenu"
          @toggle-settings="showSettingsMenu = !showSettingsMenu"
        />
      </div>

      <!-- オーバーレイ -->
      <SleepTimerSheet
        :show="showTimerMenu"
        :timer-option="timerOption"
        @close="showTimerMenu = false"
        @select="setTimer"
        @clear="setTimer(null)"
      />
      <SettingsSheet
        :show="showSettingsMenu"
        :selected-speaker="selectedSpeaker"
        :pink-noise-on="pinkNoiseOn"
        :pink-noise-volume="pinkNoiseVolume"
        @close="showSettingsMenu = false"
        @select-speaker="selectSpeaker"
        @toggle-pink-noise="togglePinkNoise"
        @set-pink-noise-volume="setPinkNoiseVolume"
      />

    </div>
  </div>
</template>