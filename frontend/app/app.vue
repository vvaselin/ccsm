<!-- app.vue -->
<script setup>
import { ref, computed, watch, onUnmounted, onMounted } from 'vue'
import { useAudioPlayer }  from '~/composables/useAudioPlayer'
import { useSleepTimer }   from '~/composables/useSleepTimer'
import { useWordLoop }     from '~/composables/useWordLoop'
import { useSpeaker }      from '~/composables/useSpeaker'
import { useAmbientSound } from '~/composables/useAmbientSound'
import { useMode, MODES }  from '~/composables/useMode'
import { useVoiceDistance } from '~/composables/useVoiceDistance'
import {
  unlock as unlockAudio,
  setPlaying as setEnginePlaying,
  setupMediaSession,
  updateMediaMetadata,
} from '~/composables/useAudioEngine'

const {
  progress,
  playNext,
  playPhrase,
  stopAudio: stopPlayerAudio,
  startProgress,
  resetProgress,
  wait,
} = useAudioPlayer()

const {
  timerOption,
  timerLabel,
  showTimerMenu,
  setTimer,
  dispose: disposeTimer,
} = useSleepTimer(() => stopWithPhrase())

const { selectedSpeaker, selectSpeaker } = useSpeaker()

const { mode, setMode } = useMode()

const { voiceDistance, setVoiceDistance } = useVoiceDistance()

const {
  states:         ambientStates,
  toggle:         toggleAmbient,
  setVolume:      setAmbientVolume,
  startIfEnabled: startAmbient,
  stopAudio:      stopAmbient,
  fadeOutAudio,
  dispose:        disposeAmbient,
  setVariant: setAmbientVariant,
} = useAmbientSound()

const {
  word,
  phrase,
  isPlaying,
  phase,
  phaseLabel,
  stop:              _stop,
  start:             _start,
  playPhraseByType,
} = useWordLoop(
  computed(() => selectedSpeaker.value?.id),
  { playNext, playPhrase, startProgress, resetProgress, stopAudio: stopPlayerAudio, wait }
)

async function stop() {
  await _stop()
  stopAmbient()
  setEnginePlaying(false)
}

async function stopWithPhrase() {
  await _stop(true)
  await playPhraseByType('stop')
  await fadeOutAudio(0, 3000)
  setEnginePlaying(false)
}

// ユーザーのタップから同期的に呼ばれる必要がある（unlockAudio のため）
function start() {
  if (isPlaying.value) return
  unlockAudio()
  setEnginePlaying(true)
  startAmbient()
  _start()
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

// 単語は 52px。長い単語（7文字〜）だけ、画面幅に収まるよう縮める
const wordLength = computed(() => [...word.value].length)

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

const showSettingsMenu = ref(false)
const showInfoSheet = ref(null)

// スクロール防止
onMounted(() => {
  document.body.style.overflow = 'hidden'
  document.documentElement.style.overflow = 'hidden'
})

onUnmounted(() => {
  stop()
  disposeTimer()
  disposeAmbient()
  document.body.style.overflow = ''
  document.documentElement.style.overflow = ''
})
</script>

<template>
  <!-- こんなとこ見てないで、はよ寝ろ -->
  <Head>
    <title>SOMNIOVOX</title>
    <Meta name="description" content="ランダムな単語を聞いて自然に眠りにつく。認知シャッフル睡眠法のWebアプリ。" />
    <Meta name="apple-mobile-web-app-capable" content="yes" />
    <Meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <Meta name="apple-mobile-web-app-title" content="CSSM" />
    <Meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <Link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  </Head>
  <div class="min-h-screen flex items-center justify-center" style="overflow:hidden; position:fixed; width:100%; height:100%; background:var(--sv-ground-3)">
    <div
      class="relative w-full"
      style="max-width:390px; height:100dvh; max-height:844px; overflow:hidden; color:var(--sv-text); background:radial-gradient(120% 70% at 50% 45%, var(--sv-ground-1) 0%, var(--sv-ground-2) 55%, var(--sv-ground-3) 100%)"
    >
      <!-- キャラクター（腰から上）。コンテナ幅を基準に置き、object-fit は使わない
           （目の位置が端末で変わらないように。縦長の端末では下の余白が増えるだけ） -->
      <Transition name="fade-character">
        <div
          v-if="selectedSpeaker?.id === 50"
          key="nurse-robot-bg"
          class="character-background"
        >
          <img
            src="/characters/nurse_robo.webp"
            alt=""
            aria-hidden="true"
            style="position:absolute; width:110.5%; left:-4.9%; top:116px; height:auto; max-width:none; pointer-events:none; user-select:none"
          />
        </div>
      </Transition>

      <!-- 光の粒（キャラの前、スクリムと UI の後ろ） -->
      <DustLayer />

      <!-- スクリム：文字と操作の下だけ暗くする（顔の部分は暗くしない） -->
      <div
        aria-hidden="true"
        style="position:absolute; left:0; right:0; top:0; height:230px; background:linear-gradient(rgba(14,15,17,0.72), rgba(14,15,17,0)); pointer-events:none"
      />
      <div
        aria-hidden="true"
        style="position:absolute; left:0; right:0; bottom:0; height:240px; background:linear-gradient(rgba(14,15,17,0), rgba(14,15,17,0.78)); pointer-events:none"
      />

      <!-- ===== UI（上と下に固定し、中央はキャラのために空ける） ===== -->

      <!-- ヘッダー -->
      <header
        class="flex items-center justify-between"
        style="position:absolute; left:0; right:0; top:0; height:56px; padding:0 12px 0 20px; color:var(--sv-on-image)"
      >
        <p class="flex items-baseline" style="gap:8px; text-shadow:0 1px 2px rgba(0,0,0,0.6)">
          <span style="font-size:12px; font-weight:500; letter-spacing:0.22em">SOMNIOVOX</span>
          <span style="font-size:11px; letter-spacing:0.06em">v0.9</span>
        </p>
        <div class="flex" style="gap:4px">
          <button
            type="button"
            aria-label="使い方"
            class="header-button"
            @click="showInfoSheet = 'about'"
          >
            <UIcon name="i-lucide-circle-help" style="width:20px; height:20px" />
          </button>
          <button
            type="button"
            aria-label="クレジット"
            class="header-button"
            @click="showInfoSheet = 'credit'"
          >
            <UIcon name="i-lucide-info" style="width:20px; height:20px" />
          </button>
        </div>
      </header>

      <!-- モード切替 -->
      <div class="flex justify-center" style="position:absolute; left:0; right:0; top:64px">
        <div
          role="group"
          aria-label="モード"
          class="flex"
          style="padding:3px; border-radius:999px; border:1px solid rgba(255,255,255,0.28); background:var(--sv-float-bg); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); box-shadow:var(--sv-float-shadow)"
        >
          <button
            v-for="m in MODES"
            :key="m.id"
            type="button"
            :aria-pressed="mode === m.id"
            style="height:32px; padding:0 18px; border-radius:999px; font-size:12px; letter-spacing:0.1em; cursor:pointer; transition:background-color 0.2s, color 0.2s"
            :style="mode === m.id
              ? { background: 'var(--sv-accent-surface)', color: 'var(--sv-accent)' }
              : { background: 'transparent', color: 'var(--sv-on-image)' }"
            @click="selectMode(m.id)"
          >
            {{ m.label }}
          </button>
        </div>
      </div>

      <!-- シャッフル：フェーズと単語（セリフのときは同じ位置にセリフ） -->
      <div
        v-if="mode === 'shuffle'"
        class="flex flex-col items-center text-center"
        style="position:absolute; left:0; right:0; top:118px; gap:8px; padding:0 12px"
      >
        <p style="font-size:12px; letter-spacing:0.18em; color:var(--sv-on-image); text-shadow:0 1px 2px rgba(0,0,0,0.6)">
          {{ phaseLabel }}&nbsp;
        </p>

        <div class="relative w-full" style="height:57px">
          <Transition name="fade-word">
            <p
              v-if="phase !== 'phrase'"
              :key="word"
              class="word"
              :style="{ '--word-length': wordLength }"
            >
              {{ word }}
            </p>
          </Transition>

          <Transition name="fade-word">
            <p
              v-if="phase === 'phrase' && phrase"
              :key="phrase"
              class="phrase"
            >
              {{ phrase }}
            </p>
          </Transition>
        </div>
      </div>

      <!-- おはなし：セリフも話者名も出さず、声の波形だけ -->
      <VoiceWaveform
        v-else
        :active="isPlaying"
        style="position:absolute; left:0; right:0; top:122px"
      />

      <!-- 進捗（844px の画面で top 684px。短い端末でも操作の上に来るよう下から置く） -->
      <ProgressBar
        :progress="progress"
        style="position:absolute; left:32px; right:32px; bottom:158px"
      />

      <!-- 操作 -->
      <PlayerControls
        :is-playing="isPlaying"
        :timer-active="!!timerOption"
        :timer-label="timerLabel"
        style="position:absolute; left:0; right:0; bottom:40px"
        @toggle="toggle"
        @toggle-timer="showTimerMenu = !showTimerMenu"
        @toggle-settings="showSettingsMenu = !showSettingsMenu"
      />

      <!-- ===== シート類 ===== -->

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
        :voice-distance="voiceDistance"
        :ambient-states="ambientStates"
        @close="showSettingsMenu = false"
        @select-speaker="selectSpeaker"
        @select-distance="setVoiceDistance"
        @toggle-ambient="toggleAmbient"
        @set-ambient-volume="setAmbientVolume"
        @set-ambient-variant="setAmbientVariant"
      />

      <InfoSheet
        :show="showInfoSheet"
        @close="showInfoSheet = null"
      />
    </div>
  </div>
</template>

<style scoped>
.character-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.header-button {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  cursor: pointer;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.7));
}

/* 単語：Shippori Mincho 52px。収まらない長さのときだけ画面幅に合わせて縮める */
.word {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  margin: 0;
  font-family: var(--font-serif);
  font-size: min(52px, calc((min(100vw, 390px) - 24px) / (var(--word-length) * 1.14)));
  line-height: 1.1;
  letter-spacing: 0.14em;
  white-space: nowrap;
  color: var(--sv-text-strong);
  text-shadow: var(--sv-text-shadow);
}

/* セリフ：単語と同じ位置に */
.phrase {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  margin: 0;
  padding: 0 12px;
  font-family: var(--font-serif);
  font-size: 21px;
  line-height: 1.75;
  letter-spacing: 0.06em;
  color: var(--sv-text-strong);
  text-shadow: var(--sv-text-shadow);
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

.fade-character-enter-active {
  transition: opacity 1s ease;
}
.fade-character-leave-active {
  transition: opacity 0.8s ease;
}
.fade-character-enter-from {
  opacity: 0;
}
.fade-character-enter-to {
  opacity: 1;
}
.fade-character-leave-from {
  opacity: 1;
}
.fade-character-leave-to {
  opacity: 0;
}
</style>
