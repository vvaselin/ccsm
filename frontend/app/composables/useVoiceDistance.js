// composables/useVoiceDistance.js
// 声の距離（耳元 / そば / すこし離れて）の選択（選択は localStorage に保存）

import { ref, onMounted } from 'vue'
import { loadSettings, saveSettings } from '~/composables/useSettings'

export const VOICE_DISTANCES = [
  { id: 'ear',  label: '耳元' },
  { id: 'near', label: 'そば' },
  { id: 'far',  label: 'すこし離れて' },
]

const DEFAULT_DISTANCE = 'ear'

export function useVoiceDistance() {
  const voiceDistance = ref(DEFAULT_DISTANCE)

  // プリレンダーと食い違わないよう、復元はマウント後に行う
  onMounted(() => {
    const saved = loadSettings().voiceDistance
    if (VOICE_DISTANCES.some(d => d.id === saved)) voiceDistance.value = saved
  })

  function setVoiceDistance(id) {
    voiceDistance.value = id
    saveSettings({ voiceDistance: id })
  }

  return {
    voiceDistance,
    setVoiceDistance,
  }
}
