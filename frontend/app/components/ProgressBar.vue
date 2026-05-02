<!-- components/ProgressBar.vue -->
<script setup>
defineProps({
  progress: { type: Number, required: true },
  phase:    { type: String, required: true },
})
</script>

<template>
  <div
    class="w-full rounded-full overflow-hidden"
    style="height:1px; background:rgba(255,255,255,0.08)"
  >
    <div
      class="h-full rounded-full transition-colors duration-300"
      :class="{
        'bg-gray-300':              phase === 'speaking',
        'bg-gray-500':              phase === 'pause',
        'bg-gray-600 animate-pulse': phase === 'loading',
      }"
      :style="{ width: progress + '%' }"
    />
  </div>
</template>
