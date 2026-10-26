<!-- components/PlayerControls.vue -->
<!-- 設定・再生/停止・スリープタイマー。ボタンの下にラベルは付けない（aria-label だけ） -->
<script setup>
defineProps({
  isPlaying:   { type: Boolean, required: true },
  timerActive: { type: Boolean, default: false },
  timerLabel:  { type: String,  default: '' },
})

defineEmits(['toggle', 'toggleTimer', 'toggleSettings'])
</script>

<template>
  <div
    class="flex items-center justify-center"
    style="gap:32px"
  >
    <!-- 設定（左） -->
    <div
      class="flex flex-col items-center"
      style="width:72px"
    >
      <button
        type="button"
        aria-label="声と環境音の設定"
        class="float-button"
        style="width:60px; height:60px; border:1px solid rgba(255,255,255,0.28); color:var(--sv-text-strong)"
        @click="$emit('toggleSettings')"
      >
        <UIcon
          name="i-lucide-sliders-horizontal"
          style="width:26px; height:26px"
        />
      </button>
    </div>

    <!-- 再生・停止（中央） -->
    <button
      type="button"
      :aria-label="isPlaying ? '停止' : '再生'"
      class="float-button active:scale-95"
      style="width:88px; height:88px; border:2px solid var(--sv-accent); background:rgba(24,26,30,0.7); box-shadow:0 8px 24px rgba(0,0,0,0.5); color:var(--sv-text-strong)"
      @click="$emit('toggle')"
    >
      <svg
        v-if="isPlaying"
        aria-hidden="true"
        width="34"
        height="34"
        viewBox="0 0 24 24"
      >
        <rect
          x="6"
          y="6"
          width="12"
          height="12"
          rx="2.5"
          fill="currentColor"
        />
      </svg>
      <svg
        v-else
        aria-hidden="true"
        width="38"
        height="38"
        viewBox="0 0 24 24"
      >
        <path
          d="M8 5.5v13l10-6.5z"
          fill="currentColor"
        />
      </svg>
    </button>

    <!-- タイマー（右）。動作中は差し色にして、ボタンの下に残り時間 -->
    <div
      class="relative flex flex-col items-center"
      style="width:72px"
    >
      <button
        type="button"
        aria-label="スリープタイマー"
        class="float-button"
        style="width:60px; height:60px"
        :style="timerActive
          ? { border: '1px solid var(--sv-accent)', color: 'var(--sv-accent)' }
          : { border: '1px solid rgba(255,255,255,0.28)', color: 'var(--sv-text-strong)' }"
        @click="$emit('toggleTimer')"
      >
        <UIcon
          name="i-lucide-timer"
          style="width:26px; height:26px"
        />
      </button>
      <!-- 残り時間は流れの外に置く（出たり消えたりしてもボタンの位置が動かないように） -->
      <span
        v-if="timerActive"
        class="tabular-nums"
        style="position:absolute; top:calc(100% + 8px); font-size:11px; letter-spacing:0.06em; color:var(--sv-accent); white-space:nowrap"
      >{{ timerLabel }}</span>
    </div>
  </div>
</template>

<style scoped>
/* イラストの上に乗る丸ボタン */
.float-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: 999px;
  background: var(--sv-float-bg);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: var(--sv-float-shadow);
  cursor: pointer;
  transition: scale 0.15s, border-color 0.2s, color 0.2s;  /* active:scale-95 は scale プロパティ */
}
</style>
