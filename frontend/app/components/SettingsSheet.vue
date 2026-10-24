<!-- components/SettingsSheet.vue -->
<script setup>
import { computed }                   from 'vue'
import { SPEAKERS }                   from '~/composables/useSpeaker'
import { VOICE_DISTANCES }            from '~/composables/useVoiceDistance'
import { AMBIENT_SOUNDS, MAX_VOLUME } from '~/composables/useAmbientSound'
import { useSheetDrag }               from '~/composables/useSheetDrag'

const props = defineProps({
  show:            { type: Boolean, required: true },
  selectedSpeaker: { type: Object,  required: true },
  voiceDistance:   { type: String,  required: true },  // 'ear' | 'near' | 'far'
  ambientStates:   { type: Object,  required: true },  // reactive { [id]: { enabled, volume, variant } }
})

const emit = defineEmits(['close', 'selectSpeaker', 'selectDistance', 'toggleAmbient', 'setAmbientVolume', 'setAmbientVariant'])

// 下スワイプで閉じる（シート全体で受ける。中身が最上部にあるときだけ動く）
const { dragY, isDragging, scrollRef, handlers: dragHandlers } = useSheetDrag(() => emit('close'))

// 長い名前は「＿」の後ろでだけ折り返す（「ナースロボ＿ / タイプＴ」）。ボタン側は word-break: keep-all
const breakName = name => name.replace('＿', '＿\u200B')

// 声の距離のアイコン：耳と、声までの弧の数
const DISTANCE_ICONS = {
  ear:  { paths: ['M6 15V7a5 5 0 0 1 10 0c0 3-3 4-3 7'], dot: 24 },
  near: { paths: ['M4 15V7a5 5 0 0 1 10 0c0 3-3 4-3 7', 'M20 5.5a5 5 0 0 1 0 7'], dot: 28 },
  far:  { paths: ['M2 15V7a5 5 0 0 1 10 0c0 3-3 4-3 7', 'M17 5.5a5 5 0 0 1 0 7M21 3a8 8 0 0 1 0 12'], dot: 30 },
}

// 音量（0〜MAX_VOLUME）を % に
const volumePercent = id => `${(props.ambientStates[id].volume / MAX_VOLUME) * 100}%`

// ON の音だけスライダーを並べる
const enabledSounds = computed(() => AMBIENT_SOUNDS.filter(s => props.ambientStates[s.id].enabled))
</script>

<template>
  <Transition name="fade">
    <div
      v-if="show"
      class="absolute inset-0 flex items-end z-50"
      style="background:rgba(10,11,13,0.55)"
      @click.self="$emit('close')"
    >
      <div
        class="w-full flex flex-col"
        v-bind="dragHandlers"
        :style="{
          background: 'var(--sv-sheet)',
          borderTop: '1px solid rgba(126,224,184,0.22)',
          borderRadius: '28px 28px 0 0',
          boxShadow: '0 -12px 40px rgba(0,0,0,0.45)',
          maxHeight: '72dvh',
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out',
          overscrollBehavior: 'contain'
        }"
      >
        <!-- ハンドル（当たり判定はこの帯全体） -->
        <div class="flex items-center justify-center" style="height:32px; flex-shrink:0; touch-action:none">
          <div style="width:36px; height:4px; border-radius:999px; background:rgba(255,255,255,0.3)" />
        </div>

        <!-- スクロール領域。min-height:0 が無いと、縦 flex の子は中身より縮まずシートからはみ出す -->
        <div
          ref="scrollRef"
          class="flex flex-col"
          style="flex:1; min-height:0; overflow-y:auto; overscroll-behavior:contain; padding:4px 24px calc(32px + env(safe-area-inset-bottom)); gap:28px"
        >
          <!-- 声 -->
          <section class="flex flex-col" style="gap:12px">
            <h2 class="section-title">声</h2>
            <div class="grid grid-cols-3" style="gap:8px">
              <button
                v-for="speaker in SPEAKERS"
                :key="speaker.id"
                type="button"
                :aria-pressed="selectedSpeaker?.id === speaker.id"
                class="tile"
                :class="{ 'is-on': selectedSpeaker?.id === speaker.id }"
                style="min-height:48px; padding:7px 10px; border-radius:12px; text-align:left; word-break:keep-all"
                :style="selectedSpeaker?.id === speaker.id ? {} : { color: 'var(--sv-text)' }"
                @click="$emit('selectSpeaker', speaker)"
              >
                <span style="display:block; font-size:12px; line-height:1.25">{{ breakName(speaker.name) }}</span>
                <span
                  style="display:block; font-size:10px; margin-top:2px"
                  :style="selectedSpeaker?.id === speaker.id
                    ? { color: 'var(--sv-accent)', opacity: 0.8 }
                    : { color: 'var(--sv-text-weak)' }"
                >{{ speaker.style }}</span>
              </button>
            </div>
          </section>

          <!-- 声の距離 -->
          <section class="flex flex-col" style="gap:12px">
            <h2 class="section-title">声の距離</h2>
            <div role="group" aria-label="声の距離" class="grid grid-cols-3" style="gap:8px">
              <button
                v-for="d in VOICE_DISTANCES"
                :key="d.id"
                type="button"
                :aria-pressed="voiceDistance === d.id"
                class="tile flex flex-col items-center justify-center"
                :class="{ 'is-on': voiceDistance === d.id }"
                style="height:68px; border-radius:14px; gap:8px"
                @click="$emit('selectDistance', d.id)"
              >
                <svg
                  aria-hidden="true"
                  width="34"
                  height="18"
                  viewBox="0 0 34 18"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                >
                  <path v-for="p in DISTANCE_ICONS[d.id].paths" :key="p" :d="p" />
                  <circle :cx="DISTANCE_ICONS[d.id].dot" cy="9" r="2.4" fill="currentColor" stroke="none" />
                </svg>
                <span style="font-size:12px">{{ d.label }}</span>
              </button>
            </div>
          </section>

          <!-- 環境音 -->
          <section class="flex flex-col" style="gap:12px">
            <h2 class="section-title">環境音</h2>
            <div role="group" aria-label="環境音" class="grid grid-cols-3" style="gap:8px">
              <button
                v-for="sound in AMBIENT_SOUNDS"
                :key="sound.id"
                type="button"
                :aria-pressed="ambientStates[sound.id].enabled"
                class="tile relative overflow-hidden flex flex-col items-center justify-center"
                :class="{ 'is-on': ambientStates[sound.id].enabled }"
                style="height:64px; border-radius:14px; gap:6px"
                @click="$emit('toggleAmbient', sound.id)"
              >
                <UIcon :name="sound.icon" style="width:22px; height:22px" />
                <span style="font-size:11px">{{ sound.label }}</span>
                <!-- 下辺の線の長さで音量を示す -->
                <span
                  v-if="ambientStates[sound.id].enabled"
                  aria-hidden="true"
                  style="position:absolute; left:0; bottom:0; height:2px; background:var(--sv-accent)"
                  :style="{ width: volumePercent(sound.id) }"
                />
              </button>
            </div>

            <!-- 鳴らす音だけ、細いスライダーで音量を合わせる -->
            <div v-if="enabledSounds.length" class="mixer">
              <template v-for="sound in enabledSounds" :key="sound.id">
                <label :for="`vol-${sound.id}`" style="font-size:12px; color:var(--sv-text-sub); white-space:nowrap">{{ sound.label }}</label>
                <input
                  :id="`vol-${sound.id}`"
                  type="range"
                  min="0"
                  :max="MAX_VOLUME"
                  step="0.01"
                  :value="ambientStates[sound.id].volume"
                  :aria-label="`${sound.label}の音量`"
                  class="volume"
                  :style="{ '--fill': volumePercent(sound.id), 'gridColumn': sound.variants ? 'auto' : 'span 2' }"
                  @touchstart.stop
                  @input="$emit('setAmbientVolume', sound.id, Number($event.target.value))"
                />
                <!-- 強さの切り替え（雨など variants を持つ音だけ） -->
                <div
                  v-if="sound.variants"
                  role="group"
                  :aria-label="`${sound.label}の強さ`"
                  class="flex"
                  style="gap:4px"
                >
                  <button
                    v-for="v in sound.variants"
                    :key="v.id"
                    type="button"
                    :aria-pressed="ambientStates[sound.id].variant === v.id"
                    class="chip"
                    :class="{ 'is-on': ambientStates[sound.id].variant === v.id }"
                    @click="$emit('setAmbientVariant', sound.id, v.id)"
                  >
                    {{ v.label }}
                  </button>
                </div>
              </template>
            </div>
          </section>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from,
.fade-leave-to     { opacity: 0; }

.section-title {
  margin: 0;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.2em;
  color: var(--sv-text-weak);
}

/* 選べるタイル（声・距離・環境音）。選択中だけ差し色 */
.tile {
  border: 1px solid var(--sv-surface-line);
  background: var(--sv-surface);
  color: var(--sv-text-sub);
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s, color 0.2s;
}
.tile.is-on {
  border-color: var(--sv-accent-line);
  background: var(--sv-accent-surface);
  color: var(--sv-accent);
}

/* 鳴っている音の行：ラベル（56px〜）＋スライダー＋（雨だけ）強さのチップ。
   列を揃えるため 1 つのグリッドにまとめ、チップの無い行はスライダーを右端まで伸ばす */
.mixer {
  display: grid;
  grid-template-columns: minmax(56px, max-content) minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 12px;
  row-gap: 10px;
  /* 環境音がオンのときはここがシートの最下段になるので、下に余白を足す */
  padding: 4px 0 20px;
}

.chip {
  height: 28px;
  padding: 0 9px;
  border: 0;
  border-radius: 8px;
  background: var(--sv-surface);
  color: var(--sv-text-weak);
  font-size: 11px;
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s;
}
.chip.is-on {
  background: rgba(126,224,184,0.28);
  color: var(--sv-accent);
}

/* 細いスライダー：見た目の線は 2px、指で掴む高さは確保する */
.volume {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 24px;
  margin: 0;
  background: transparent;
  cursor: pointer;
}
.volume::-webkit-slider-runnable-track {
  height: 2px;
  border-radius: 1px;
  background: linear-gradient(to right, var(--sv-accent) var(--fill), rgba(255,255,255,0.28) var(--fill));
}
.volume::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  margin-top: -6px;
  border-radius: 50%;
  background: var(--sv-accent);
}
.volume::-moz-range-track {
  height: 2px;
  border-radius: 1px;
  background: rgba(255,255,255,0.28);
}
.volume::-moz-range-progress {
  height: 2px;
  border-radius: 1px;
  background: var(--sv-accent);
}
.volume::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border: 0;
  border-radius: 50%;
  background: var(--sv-accent);
}
</style>
