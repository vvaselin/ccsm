<!-- components/ProgressBar.vue -->
<!-- シャッフルは単語ごとの進捗、おはなしは朗読全体の進み具合 -->
<script setup>
defineProps({
  progress: { type: Number, required: true },  // 0〜100
})
</script>

<template>
  <div
    aria-hidden="true"
    style="height:2px; border-radius:1px; background:rgba(255,255,255,0.28); box-shadow:0 1px 3px rgba(0,0,0,0.5)"
  >
    <div
      style="height:2px; border-radius:1px; background:var(--sv-accent)"
      :style="{ width: `${progress}%` }"
    />
  </div>
</template>
