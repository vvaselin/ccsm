<!-- components/SleepTimerSheet.vue -->
<script setup>
import { useSheetDrag } from '~/composables/useSheetDrag'
import { TIMER_OPTIONS } from '~/composables/useSleepTimer'

defineProps({
  show:        { type: Boolean, required: true },
  timerOption: { type: Object,  default: null },
})

const emit = defineEmits(['close', 'select', 'clear'])

// 下スワイプで閉じる（シート全体で受ける）
const { dragY, isDragging, handlers: dragHandlers } = useSheetDrag(() => emit('close'))
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
        class="w-full"
        v-bind="dragHandlers"
        :style="{
          background: 'var(--sv-sheet)',
          borderTop: '1px solid rgba(126,224,184,0.22)',
          borderRadius: '28px 28px 0 0',
          boxShadow: '0 -12px 40px rgba(0,0,0,0.45)',
          padding: '0 24px 40px',
          touchAction: 'none',
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out',
          overscrollBehavior: 'contain'
        }"
      >
        <!-- ハンドル（当たり判定はシート全体） -->
        <div class="flex items-center justify-center" style="height:32px">
          <div style="width:36px; height:4px; border-radius:999px; background:rgba(255,255,255,0.3)" />
        </div>

        <h2
          class="text-center"
          style="margin:4px 0 16px; font-size:11px; font-weight:500; letter-spacing:0.2em; color:var(--sv-text-weak)"
        >
          スリープタイマー
        </h2>

        <!-- 選択肢 -->
        <div class="grid grid-cols-2" style="gap:8px; margin-bottom:16px">
          <button
            v-for="opt in TIMER_OPTIONS"
            :key="opt.ms"
            type="button"
            :aria-pressed="timerOption?.ms === opt.ms"
            class="option"
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
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from,
.fade-leave-to     { opacity: 0; }

/* 選択中だけ差し色（設定シートのタイルと同じ） */
.option {
  height: 48px;
  border: 1px solid var(--sv-surface-line);
  border-radius: 12px;
  background: var(--sv-surface);
  color: var(--sv-text-sub);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s, color 0.2s;
}
.option.is-on {
  border-color: var(--sv-accent-line);
  background: var(--sv-accent-surface);
  color: var(--sv-accent);
}
</style>
