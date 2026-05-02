<!-- components/PlayerControls.vue -->
<script setup>
defineProps({
  isPlaying:       { type: Boolean, required: true },
  timerOption:     { type: Object,  default: null },
  timerLabel:      { type: String,  default: '' },
  showTimerMenu:   { type: Boolean, required: true },
  showSettingsMenu:{ type: Boolean, required: true },
})

defineEmits(['toggle', 'toggleTimer', 'toggleSettings'])
</script>

<template>
  <div class="relative flex items-center justify-center">

    <!-- 設定ボタン（左） -->
    <div class="absolute" style="right: calc(50% + 44px)">
      <button
        @click="$emit('toggleSettings')"
        class="flex items-center justify-center rounded-full transition-colors"
        :style="{
          width: '38px', height: '38px',
          background: showSettingsMenu ? 'rgba(126,184,201,0.15)' : 'rgba(255,255,255,0.06)',
          border:     showSettingsMenu ? '1px solid rgba(126,184,201,0.3)' : '1px solid rgba(255,255,255,0.08)',
        }"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round"
          :stroke="showSettingsMenu ? '#7eb8c9' : '#6b7280'">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07M8.46 8.46a5 5 0 0 0 0 7.07"/>
        </svg>
      </button>
    </div>

    <!-- 再生・停止ボタン -->
    <button
      @click="$emit('toggle')"
      class="flex items-center justify-center rounded-full transition-all active:scale-95"
      style="width:68px; height:68px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.1); box-shadow:0 8px 24px rgba(0,0,0,0.4)"
    >
      <span v-if="isPlaying"
        class="block rounded-sm"
        style="width:18px; height:18px; background:rgba(232,234,240,0.85)"
      />
      <span v-else
        class="block"
        style="width:0; height:0; margin-left:3px; border-top:11px solid transparent; border-bottom:11px solid transparent; border-left:18px solid rgba(232,234,240,0.85)"
      />
    </button>

    <!-- タイマーボタン＋残り時間（右） -->
    <div class="absolute flex items-center" style="left: calc(50% + 44px); gap:8px">
      <button
        @click="$emit('toggleTimer')"
        class="flex items-center justify-center rounded-full transition-colors"
        :style="{
          width: '38px', height: '38px',
          background: timerOption ? 'rgba(126,184,201,0.15)' : 'rgba(255,255,255,0.06)',
          border:     timerOption ? '1px solid rgba(126,184,201,0.3)' : '1px solid rgba(255,255,255,0.08)',
        }"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round"
          :stroke="timerOption ? '#7eb8c9' : '#6b7280'">
          <circle cx="12" cy="13" r="8"/>
          <path d="M12 9v4l2 2"/>
          <path d="M9 2h6M12 2v3"/>
        </svg>
      </button>
      <span
        v-if="timerOption"
        class="tabular-nums text-xs"
        style="color:#7eb8c9; min-width:36px"
      >{{ timerLabel }}</span>
    </div>

  </div>
</template>
