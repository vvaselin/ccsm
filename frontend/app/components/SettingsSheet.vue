<!-- components/SettingsSheet.vue -->
<script setup>
import { ref } from 'vue'
import { SPEAKERS }       from '~/composables/useSpeaker'
import { AMBIENT_SOUNDS } from '~/composables/useAmbientSound'

defineProps({
  show:            { type: Boolean, required: true },
  selectedSpeaker: { type: Object,  required: true },
  ambientStates:   { type: Object,  required: true },  // reactive { [id]: { enabled, volume } }
})

const emit = defineEmits(['close', 'selectSpeaker', 'toggleAmbient', 'setAmbientVolume'])

// スワイプ機能
const sheetRef = ref(null)
const isDragging = ref(false)
const startY = ref(0)
const currentY = ref(0)

function onTouchStart(e) {
  isDragging.value = true
  startY.value = e.touches[0].clientY
  currentY.value = 0
}

function onTouchMove(e) {
  if (!isDragging.value) return
  const deltaY = e.touches[0].clientY - startY.value
  if (deltaY > 0) { // 下方向のみ
    currentY.value = deltaY
    e.preventDefault()
  }
}

function onTouchEnd() {
  if (!isDragging.value) return
  isDragging.value = false
  
  // 100px以上スワイプしたら閉じる
  if (currentY.value > 100) {
    emit('close')
  }
  
  currentY.value = 0
}
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
        ref="sheetRef"
        class="w-full flex flex-col"
        :style="{
          background: '#1a1f2a',
          borderTop: '1px solid rgba(126,184,201,0.12)',
          borderRadius: '24px 24px 0 0',
          maxHeight: '72dvh',
          transform: `translateY(${currentY}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out'
        }"
      >
        <!-- ハンドル（固定・ドラッグ可能） -->
        <div style="padding:16px 24px 0; flex-shrink:0">
          <div
            class="rounded-full mx-auto"
            style="width:36px; height:3px; background:rgba(255,255,255,0.15); margin-bottom:16px; cursor:grab; touch-action:none"
            @touchstart="onTouchStart"
            @touchmove="onTouchMove"
            @touchend="onTouchEnd"
          />
        </div>

        <!-- スクロール領域 -->
        <div style="overflow-y:auto; padding:0 24px 48px; flex:1">

          <!-- 声 -->
          <p class="text-xs tracking-widest uppercase" style="color:#6a7a90; margin-bottom:12px">
            声
          </p>
          <div class="grid grid-cols-3" style="gap:8px; margin-bottom:24px">
            <button
              v-for="speaker in SPEAKERS"
              :key="speaker.id"
              @click="$emit('selectSpeaker', speaker)"
              class="rounded-xl text-left transition-colors"
              style="padding:10px 12px"
              :style="selectedSpeaker?.id === speaker.id
                ? 'background:rgba(126,184,201,0.15); border:1px solid rgba(126,184,201,0.35)'
                : 'background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1)'"
            >
              <p
                class="text-xs font-medium leading-tight"
                :style="selectedSpeaker?.id === speaker.id ? 'color:#7eb8c9' : 'color:rgba(232,234,240,0.9)'"
              >{{ speaker.name }}</p>
              <p class="text-xs leading-tight" style="color:#6a7a90; margin-top:2px">
                {{ speaker.style }}
              </p>
            </button>
          </div>

          <!-- 区切り -->
          <div style="height:1px; background:rgba(126,184,201,0.1); margin-bottom:20px" />

          <!-- 環境音 -->
          <p class="text-xs tracking-widest uppercase" style="color:#6a7a90; margin-bottom:12px">
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
                  : 'background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); color:rgba(200,210,228,0.6)'"
              >
                {{ sound.icon }} {{ sound.label }}
              </button>

              <!-- ボリュームスライダー -->
              <div
                class="flex-1 flex items-center"
                :style="{ opacity: ambientStates[sound.id].enabled ? 1 : 0.35, transition: 'opacity 0.2s' }"
              >
                <input
                  type="range"
                  min="0" max="0.5" step="0.01"
                  :value="ambientStates[sound.id].volume"
                  class="w-full appearance-none rounded-full"
                  style="height:3px; accent-color:#7eb8c9; background:rgba(126,184,201,0.15); cursor:pointer"
                  @input="$emit('setAmbientVolume', sound.id, Number($event.target.value))"
                />
              </div>
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