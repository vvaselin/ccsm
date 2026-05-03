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
  <Transition name="fade">
    <div
      v-if="show"
      class="absolute inset-0 flex items-end z-50"
      style="background:rgba(10,12,15,0.3); backdrop-filter:blur(2px)"
      @click.self="$emit('close')"
    >
      <div
        class="w-full"
        style="background:#1a1f2a; border-top:1px solid rgba(126,184,201,0.12); border-radius:24px 24px 0 0; padding:24px 24px 48px"
      >
        <!-- ハンドル -->
        <div class="rounded-full mx-auto" style="width:36px; height:3px; background:rgba(255,255,255,0.12); margin-bottom:24px" />

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
