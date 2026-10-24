// composables/useMode.js
// 再生モード（シャッフル / おはなし）の選択（選択は localStorage に保存）

import { ref, onMounted } from 'vue'
import { loadSettings, saveSettings } from '~/composables/useSettings'

export const MODES = [
  { id: 'shuffle', label: 'シャッフル' },
  { id: 'story',   label: 'おはなし' },
]

const DEFAULT_MODE = 'shuffle'

export function useMode() {
  const mode = ref(DEFAULT_MODE)

  // プリレンダーと食い違わないよう、復元はマウント後に行う
  onMounted(() => {
    const saved = loadSettings().mode
    if (MODES.some(m => m.id === saved)) mode.value = saved
  })

  function setMode(id) {
    mode.value = id
    saveSettings({ mode: id })
  }

  return {
    mode,
    setMode,
  }
}
