<!-- app.vue -->
<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { useAudioPlayer }  from '~/composables/useAudioPlayer'
import { useSleepTimer }   from '~/composables/useSleepTimer'
import { useWordLoop }     from '~/composables/useWordLoop'
import { useSpeaker }      from '~/composables/useSpeaker'
import { useAmbientSound } from '~/composables/useAmbientSound'


const {
  progress,
  playNext,
  playPhrase,
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
} = useSleepTimer(() => stopWithPhrase())

const { selectedSpeaker, selectSpeaker } = useSpeaker()

const {
  states:         ambientStates,
  toggle:         toggleAmbient,
  setVolume:      setAmbientVolume,
  startIfEnabled: startAmbient,
  stopAudio:      stopAmbient,
  fadeOutAudio,
  dispose:        disposeAmbient,
} = useAmbientSound()

const {
  word,
  phrase,
  isPlaying,
  phase,
  phaseLabel,
  stop:              _stop,
  start:             _start,
  toggle:            _toggle,
  playPhraseByType,
} = useWordLoop(
  computed(() => selectedSpeaker.value?.id),
  { playNext, playPhrase, startProgress, resetProgress, stopAudio: stopPlayerAudio }
)

async function stop() {
  await _stop()
  stopAmbient()
}

// タイマー満了時：ループ停止 → セリフ再生 → 環境音フェードアウト
async function stopWithPhrase() {
  await _stop(true)
  await playPhraseByType('stop')
  await fadeOutAudio(0, 3000)
}

async function start() {
  await _start()
  startAmbient()
}

const toggle = async () => {
  if (isPlaying.value) {
    // 停止：_toggleに任せつつ環境音も止める
    await _stop()
    stopAmbient()
  } else {
    // 開始：環境音を先に起動してから_toggleに任せる
    startAmbient()
    _toggle()
  }
}

const showSettingsMenu = ref(false)

onUnmounted(() => {
  stop()
  disposeTimer()
  disposeAmbient()
})
</script>

<template>
  <Head>
    <Meta name="apple-mobile-web-app-capable" content="yes" />
    <Meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <Meta name="apple-mobile-web-app-title" content="CSSM" />
    <Link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  </Head>
  <div class="min-h-screen flex items-center justify-center" style="background:#0d0f12">
    <div
      class="relative flex flex-col justify-between overflow-hidden w-full"
      style="max-width:390px; height:100dvh; max-height:844px; background:#0d0f12"
    >

      <!-- 上部：フェーズラベル＋単語＋セリフ -->
      <div class="text-center px-8" style="padding-top:64px">
        <p class="text-xs tracking-widest uppercase mb-4" style="color:#9aa0b0; height:16px">
          {{ phaseLabel }}&nbsp;
        </p>

        <!-- 固定高さコンテナ：単語とセリフを同じ場所に表示 -->
        <div style="position:relative; height:80px; display:flex; align-items:center; justify-content:center">

          <!-- 単語（セリフ再生中は非表示） -->
          <Transition name="fade-word">
            <p
              v-if="phase !== 'phrase'"
              :key="word"
              style="position:absolute; font-size:56px; color:rgba(232,234,240,0.45); letter-spacing:-0.01em; font-family:serif; line-height:1; margin:0"
            >
              {{ word }}
            </p>
          </Transition>

          <!-- セリフ（再生中のみ表示） -->
          <Transition name="fade-word">
            <p
              v-if="phase === 'phrase' && phrase"
              :key="phrase"
              style="position:absolute; font-size:22px; color:rgba(180,200,220,0.6); letter-spacing:0.05em; font-family:serif; line-height:1.4; margin:0"
            >
              {{ phrase }}
            </p>
          </Transition>

        </div>
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
        :ambient-states="ambientStates"
        @close="showSettingsMenu = false"
        @select-speaker="selectSpeaker"
        @toggle-ambient="toggleAmbient"
        @set-ambient-volume="setAmbientVolume"
      />

    </div>
  </div>
</template>

<style scoped>
.fade-word-enter-active {
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.fade-word-leave-active {
  transition: opacity 0.4s ease;
}
.fade-word-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.fade-word-enter-to {
  opacity: 1;
  transform: translateY(0);
}
.fade-word-leave-from {
  opacity: 1;
}
.fade-word-leave-to {
  opacity: 0;
}
</style>