// composables/useSleepTimer.js
// スリープタイマーのロジック

import { ref, computed } from 'vue'

export const TIMER_OPTIONS = [
  { label: '30秒', ms: 30 * 1000 },
  { label: '15分', ms: 15 * 60 * 1000 },
  { label: '30分', ms: 30 * 60 * 1000 },
  { label: '45分', ms: 45 * 60 * 1000 },
  { label: '60分', ms: 60 * 60 * 1000 },
]

export function useSleepTimer(onExpire) {
  const timerOption   = ref(null)
  const timerRemainMs = ref(0)
  const showTimerMenu = ref(false)

  const timerLabel = computed(() => {
    if (!timerOption.value) return ''
    const m = Math.floor(timerRemainMs.value / 60000)
    const s = Math.floor((timerRemainMs.value % 60000) / 1000)
    return `${m}:${String(s).padStart(2, '0')}`
  })

  let timerEndTime = null
  let timerTick    = null

  function setTimer(option) {
    timerOption.value   = option
    showTimerMenu.value = false

    clearInterval(timerTick)
    timerTick = null

    if (option === null) {
      timerEndTime       = null
      timerRemainMs.value = 0
      return
    }

    timerEndTime        = Date.now() + option.ms
    timerRemainMs.value = option.ms

    timerTick = setInterval(() => {
      const remain = timerEndTime - Date.now()
      if (remain <= 0) {
        timerRemainMs.value = 0
        clearInterval(timerTick)
        timerTick = null
        onExpire?.()
      } else {
        timerRemainMs.value = remain
      }
    }, 500)
  }

  function dispose() {
    clearInterval(timerTick)
  }

  return {
    timerOption,
    timerRemainMs,
    timerLabel,
    showTimerMenu,
    setTimer,
    dispose,
  }
}
