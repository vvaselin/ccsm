<!-- components/BottomSheet.vue -->
<!-- シート（設定・スリープタイマー・使い方／クレジット）の共通の外枠。中身はスロットで渡す -->
<script setup>
import { useSheetDrag } from '~/composables/useSheetDrag'

defineProps({
  show:      { type: Boolean, required: true },
  // 指定したときだけ、中身をこの高さまでのスクロール領域にする（例：'72dvh'）
  maxHeight: { type: String,  default: null },
})

const emit = defineEmits(['close'])

// 下スワイプで閉じる（シート全体で受ける。スクロール領域があるときは中身が最上部にあるときだけ動く）
const { dragY, isDragging, scrollRef, handlers: dragHandlers } = useSheetDrag(() => emit('close'))
</script>

<template>
  <Transition name="fade">
    <div
      v-if="show"
      class="absolute inset-0 flex items-end z-50"
      style="background:rgba(10,11,13,0.55)"
      @click.self="$emit('close')"
    >
      <!-- スクロール領域が無いシートは、どこを触ってもスワイプになるよう touch-action を切る -->
      <div
        class="w-full"
        :class="{ 'flex flex-col': maxHeight }"
        v-bind="dragHandlers"
        :style="{
          background: 'var(--sv-sheet)',
          borderTop: '1px solid var(--sv-sheet-line)',
          borderRadius: '28px 28px 0 0',
          boxShadow: '0 -12px 40px rgba(0,0,0,0.45)',
          maxHeight: maxHeight ?? undefined,
          touchAction: maxHeight ? undefined : 'none',
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out',
          overscrollBehavior: 'contain'
        }"
      >
        <!-- ハンドル（当たり判定はこの帯全体） -->
        <div
          class="flex items-center justify-center"
          style="height:32px; flex-shrink:0; touch-action:none"
        >
          <div style="width:36px; height:4px; border-radius:999px; background:rgba(255,255,255,0.3)" />
        </div>

        <!-- スクロール領域。min-height:0 が無いと、縦 flex の子は中身より縮まずシートからはみ出す -->
        <div
          v-if="maxHeight"
          ref="scrollRef"
          style="flex:1; min-height:0; overflow-y:auto; overscroll-behavior:contain"
        >
          <slot />
        </div>
        <slot v-else />
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
