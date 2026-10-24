// composables/useStoryLoop.js
// おはなしモードの再生ループ（土台）
//
// 公開 API は useWordLoop と同じ形（isPlaying, progress, start(), stop()）で、
// app.vue はモードによって呼び分けるだけにしてある。
// 朗読の音声は useAudioEngine の getVoiceBus().input に流せば、声の距離と波形がそのまま効く

import { ref } from 'vue'

export function useStoryLoop() {
  const isPlaying = ref(false)
  const progress  = ref(0)   // 朗読全体の進み具合（0〜100）

  async function start() {
    // TODO: 朗読の再生
  }

  async function stop() {
    isPlaying.value = false
    progress.value  = 0
  }

  return {
    isPlaying,
    progress,
    start,
    stop,
  }
}
