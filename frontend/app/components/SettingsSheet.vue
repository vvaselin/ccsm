<!-- components/SettingsSheet.vue -->
<script setup>
import { SPEAKERS }       from '~/composables/useSpeaker'
import { AMBIENT_SOUNDS } from '~/composables/useAmbientSound'

defineProps({
  show:            { type: Boolean, required: true },
  selectedSpeaker: { type: Object,  required: true },
  ambientStates:   { type: Object,  required: true },  // reactive { [id]: { enabled, volume } }
})

defineEmits(['close', 'selectSpeaker', 'toggleAmbient', 'setAmbientVolume'])
</script>

<template>
  <Transition name="fade">
    <div
      v-if="show"
      class="absolute inset-0 flex items-end z-50"
      style="background:rgba(10,12,15,0.3); backdrop-filter:blur(2px)"
      @click.self="$emit('close')"
    >
      <div
        class="w-full"
        style="background:#161920; border-top:1px solid rgba(255,255,255,0.07); border-radius:24px 24px 0 0; padding:24px 24px 48px"
      >
        <!-- ハンドル -->
        <div
          class="rounded-full mx-auto"
          style="width:36px; height:3px; background:rgba(255,255,255,0.12); margin-bottom:24px"
        />

        <!-- 声 -->
        <p class="text-xs tracking-widest uppercase" style="color:#5a6070; margin-bottom:14px">
          声
        </p>
        <div class="grid grid-cols-3" style="gap:8px; margin-bottom:28px">
          <button
            v-for="speaker in SPEAKERS"
            :key="speaker.id"
            @click="$emit('selectSpeaker', speaker)"
            class="rounded-xl text-left transition-colors"
            style="padding:10px 12px"
            :style="selectedSpeaker?.id === speaker.id
              ? 'background:rgba(126,184,201,0.15); border:1px solid rgba(126,184,201,0.35)'
              : 'background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08)'"
          >
            <p
              class="text-xs font-medium leading-tight"
              :style="selectedSpeaker?.id === speaker.id ? 'color:#7eb8c9' : 'color:rgba(232,234,240,0.85)'"
            >{{ speaker.name }}</p>
            <p class="text-xs leading-tight" style="color:#5a6070; margin-top:2px">
              {{ speaker.style }}
            </p>
          </button>
        </div>

        <!-- 区切り -->
        <div style="height:1px; background:rgba(255,255,255,0.07); margin-bottom:24px" />

        <!-- 環境音 -->
        <p class="text-xs tracking-widest uppercase" style="color:#5a6070; margin-bottom:14px">
          環境音
        </p>

        <!-- 縦リスト：ボタン + スライダー -->
        <div style="display:flex; flex-direction:column; gap:10px">
          <div
            v-for="sound in AMBIENT_SOUNDS"
            :key="sound.id"
            class="flex items-center"
            style="gap:12px"
          >
            <!-- ON/OFFトグルボタン -->
            <button
              @click="$emit('toggleAmbient', sound.id)"
              class="rounded-xl text-xs font-medium transition-colors flex-shrink-0"
              style="width:116px; padding:8px 0; text-align:center"
              :style="ambientStates[sound.id].enabled
                ? 'background:rgba(126,184,201,0.15); border:1px solid rgba(126,184,201,0.35); color:#7eb8c9'
                : 'background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); color:rgba(232,234,240,0.45)'"
            >
              {{ sound.icon }} {{ sound.label }}
            </button>

            <!-- ボリュームスライダー -->
            <div
              class="flex items-center"
              style="gap:6px; width:148px; flex-shrink:0"
              :style="{ opacity: ambientStates[sound.id].enabled ? 1 : 0.3, transition: 'opacity 0.2s' }"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5a6070" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              </svg>
              <input
                type="range"
                min="0" max="0.5" step="0.01"
                :value="ambientStates[sound.id].volume"
                class="flex-1 appearance-none rounded-full"
                style="height:3px; accent-color:#7eb8c9; background:rgba(255,255,255,0.08); cursor:pointer"
                @input="$emit('setAmbientVolume', sound.id, Number($event.target.value))"
              />
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5a6070" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
              </svg>
            </div>
          </div>
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

input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #e8eaf0;
  cursor: pointer;
}
</style>