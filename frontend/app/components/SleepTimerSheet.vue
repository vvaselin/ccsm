<!-- components/SleepTimerSheet.vue -->
<script setup>
import { ref } from 'vue'
import { TIMER_OPTIONS } from '~/composables/useSleepTimer'

defineProps({
  show:        { type: Boolean, required: true },
  timerOption: { type: Object,  default: null },
})

const emit = defineEmits(['close', 'select', 'clear'])

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
        class="w-full"
        :style="{
          background: '#1a1f2a',
          borderTop: '1px solid rgba(126,184,201,0.12)',
          borderRadius: '24px 24px 0 0',
          padding: '24px 24px 48px',
          transform: `translateY(${currentY}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out'
        }"
      >
        <!-- ハンドル（ドラッグ可能） -->
        <div
          class="rounded-full mx-auto"
          style="width:36px; height:3px; background:rgba(255,255,255,0.12); margin-bottom:24px; cursor:grab; touch-action:none"
          @touchstart="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="onTouchEnd"
        />

        <p class="text-xs tracking-widest uppercase text-center" style="color:#5a6070; margin-bottom:20px">
          スリープタイマー
        </p>

        <!-- 選択肢 -->
        <div class="grid grid-cols-2" style="gap:8px; margin-bottom:16px">
          <button
            v-for="opt in TIMER_OPTIONS"
            :key="opt.ms"
            @click="$emit('select', opt)"
            class="rounded-xl text-sm font-medium transition-colors"
            style="padding:12px"
            :style="timerOption?.ms === opt.ms
              ? 'background:rgba(232,234,240,0.9); color:#0d0f12'
              : 'background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); color:rgba(232,234,240,0.6)'"
          >{{ opt.label }}</button>
        </div>

        <!-- オフ -->
        <button
          @click="$emit('clear')"
          class="w-full text-xs transition-colors"
          style="padding-top:16px; border-top:1px solid rgba(255,255,255,0.07); color:#5a6070"
        >オフ</button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from,
.fade-leave-to     { opacity: 0; }
</style>