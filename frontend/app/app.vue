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
    await _stop()
    stopAmbient()
  } else {
    startAmbient()
    _toggle()
  }
}

const showSettingsMenu = ref(false)
const showInfoSheet = ref(null)

onUnmounted(() => {
  stop()
  disposeTimer()
  disposeAmbient()
})
</script>

<template>
  <!-- こんなとこ見てないで、はよ寝ろ -->
  <Head>
    <Meta name="apple-mobile-web-app-capable" content="yes" />
    <Meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <Meta name="apple-mobile-web-app-title" content="CSSM" />
    <Link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  </Head>
  <div class="min-h-screen flex items-center justify-center bg-animated">
    <div
      class="relative flex flex-col justify-between overflow-hidden w-full bg-animated"
      style="max-width:390px; height:100dvh; max-height:844px;"
    >

      <div
        class="flex items-center justify-between px-6"
        style="padding-top:20px; padding-bottom:4px; flex-shrink:0"
      >
        <p style="font-size:13px; color:rgba(232,234,240,0.35); letter-spacing:0.08em">SOMNIOVOX<span style="font-size:10px; opacity:0.6">（仮）</span> v0.8</p>
        <div class="flex items-center" style="gap:16px">
          <button
            @click="showInfoSheet = 'about'"
            style="font-size:12px; color:rgba(232,234,240,0.3); letter-spacing:0.05em; background:none; border:none; cursor:pointer; padding:4px"
          >
            使い方
          </button>
          <button
            @click="showInfoSheet = 'credit'"
            style="font-size:12px; color:rgba(232,234,240,0.3); letter-spacing:0.05em; background:none; border:none; cursor:pointer; padding:4px"
          >
            クレジット
          </button>
        </div>
      </div>

      <div class="text-center px-8" style="padding-top:32px">
        <p class="text-xs tracking-widest uppercase mb-4" style="color:#9aa0b0; height:16px">
          {{ phaseLabel }}&nbsp;
        </p>

        <div style="position:relative; height:80px; display:flex; align-items:center; justify-content:center">

          <Transition name="fade-word">
            <p
              v-if="phase !== 'phrase'"
              :key="word"
              style="position:absolute; font-size:56px; color:rgba(232,234,240,0.45); letter-spacing:-0.01em; font-family:serif; line-height:1; margin:0"
            >
              {{ word }}
            </p>
          </Transition>

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

      <InfoSheet
        :show="showInfoSheet"
        @close="showInfoSheet = null"
      />

    </div>
  </div>
</template>

<style scoped>
.bg-animated {
  background:
    radial-gradient(ellipse 120% 60% at 50% 0%,   #2d1b4e 0%, transparent 70%),
    radial-gradient(ellipse 120% 60% at 50% 50%,  #0f2a4a 0%, transparent 70%),
    radial-gradient(ellipse 120% 60% at 50% 100%, #0d2a1f 0%, transparent 70%),
    #0d0f18;
  background-attachment: fixed;
  animation: wave 6s ease-in-out infinite;
}

@keyframes wave {
  0%   { background-position: 50% 0%,   50% 50%,  50% 100%, 0 0; }
  25%  { background-position: 55% 5%,   48% 52%,  52% 95%,  0 0; }
  50%  { background-position: 50% 8%,   52% 48%,  48% 100%, 0 0; }
  75%  { background-position: 45% 3%,   50% 54%,  50% 97%,  0 0; }
  100% { background-position: 50% 0%,   50% 50%,  50% 100%, 0 0; }
}

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