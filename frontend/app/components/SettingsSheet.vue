<!-- components/SettingsSheet.vue -->
<script setup>
import { SPEAKERS } from '~/composables/useSpeaker'

defineProps({
  show:             { type: Boolean, required: true },
  selectedSpeaker:  { type: Object,  required: true },
  pinkNoiseOn:      { type: Boolean, required: true },
  pinkNoiseVolume:  { type: Number,  required: true },
})

defineEmits(['close', 'selectSpeaker', 'togglePinkNoise', 'setPinkNoiseVolume'])
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
              :style="selectedSpeaker?.id === speaker.id
                ? 'color:#7eb8c9'
                : 'color:rgba(232,234,240,0.85)'"
            >{{ speaker.name }}</p>
            <p class="text-xs leading-tight" style="color:#5a6070; margin-top:2px">
              {{ speaker.style }}
            </p>
          </button>
        </div>

        <!-- 区切り -->
        <div style="height:1px; background:rgba(255,255,255,0.07); margin-bottom:24px" />

        <!-- 環境音 -->
        <p class="text-xs tracking-widest uppercase" style="color:#5a6070; margin-bottom:16px">
          環境音
        </p>

        <!-- ピンクノイズ行 -->
        <div class="flex items-center" style="gap:12px">
          <!-- ON/OFFトグル -->
          <button
            @click="$emit('togglePinkNoise')"
            class="flex items-center justify-center rounded-xl text-xs font-medium transition-colors flex-shrink-0"
            style="padding:8px 14px"
            :style="pinkNoiseOn
              ? 'background:rgba(126,184,201,0.15); border:1px solid rgba(126,184,201,0.35); color:#7eb8c9'
              : 'background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); color:rgba(232,234,240,0.5)'"
          >
            〜 ピンクノイズ
          </button>

          <!-- ボリュームスライダー -->
          <div class="flex-1 flex items-center" :style="{ gap: '8px', opacity: pinkNoiseOn ? 1 : 0.3 }">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5a6070" stroke-width="2" stroke-linecap="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            </svg>
            <input
              type="range"
              min="0" max="1" step="0.01"
              :value="pinkNoiseVolume"
              :disabled="!pinkNoiseOn"
              class="flex-1 appearance-none rounded-full"
              style="height:3px; accent-color:#7eb8c9; background:rgba(255,255,255,0.08); cursor:pointer"
              @input="$emit('setPinkNoiseVolume', Number($event.target.value))"
            />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5a6070" stroke-width="2" stroke-linecap="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            </svg>
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