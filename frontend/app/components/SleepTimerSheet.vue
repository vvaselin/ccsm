<!-- components/SleepTimerSheet.vue -->
<script setup>
import { TIMER_OPTIONS } from '~/composables/useSleepTimer'

defineProps({
  show:        { type: Boolean, required: true },
  timerOption: { type: Object,  default: null },
})

defineEmits(['close', 'select', 'clear'])
</script>

<template>
  <!-- 中身が短いのでスクロール領域は作らない（下スワイプの当たり判定はシート全体） -->
  <BottomSheet
    :show="show"
    @close="$emit('close')"
  >
    <div style="padding:0 24px 40px">
      <h2
        class="text-center"
        style="margin:4px 0 16px; font-size:11px; font-weight:500; letter-spacing:0.2em; color:var(--sv-text-weak)"
      >
        スリープタイマー
      </h2>

      <!-- 選択肢 -->
      <div
        class="grid grid-cols-2"
        style="gap:8px; margin-bottom:16px"
      >
        <button
          v-for="opt in TIMER_OPTIONS"
          :key="opt.ms"
          type="button"
          :aria-pressed="timerOption?.ms === opt.ms"
          class="sv-tile option"
          :class="{ 'is-on': timerOption?.ms === opt.ms }"
          @click="$emit('select', opt)"
        >
          {{ opt.label }}
        </button>
      </div>

      <!-- オフ -->
      <button
        type="button"
        class="w-full"
        style="padding-top:16px; border-top:1px solid var(--sv-surface); color:var(--sv-text-weak); font-size:12px; cursor:pointer"
        @click="$emit('clear')"
      >
        オフ
      </button>
    </div>
  </BottomSheet>
</template>

<style scoped>
/* 色と選択中の差し色は .sv-tile（main.css）。ここでは大きさと文字だけ */
.option {
  height: 48px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
}
</style>
