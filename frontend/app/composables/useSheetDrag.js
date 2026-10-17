// composables/useSheetDrag.js
// ボトムシートを下スワイプで閉じる。
//
// - シート全体で受ける（ハンドルだけに限定しない）
// - 中身がスクロール可能なときは scrollTop === 0 の場合だけシートを動かす
// - 距離か速度のどちらかが閾値を超えたら閉じる
// - touchcancel でも状態を戻す（途中で止まったまま残らない）
//
// 使う側:
//   const { dragY, isDragging, handlers, scrollRef } = useSheetDrag(() => emit('close'))
//   <div v-bind="handlers" :style="{ transform: `translateY(${dragY}px)` }">
//     <div ref="scrollRef" style="overflow-y:auto">...</div>

import { ref } from 'vue'

export function useSheetDrag(onClose, { threshold = 90, velocity = 0.45, deadZone = 8 } = {}) {
  const dragY      = ref(0)
  const isDragging = ref(false)
  const scrollRef  = ref(null)

  let tracking = false   // 指が触れている
  let startY   = 0
  let startT   = 0

  function onTouchStart(e) {
    if (e.touches.length !== 1) return
    tracking = true
    startY   = e.touches[0].clientY
    startT   = performance.now()
  }

  function onTouchMove(e) {
    if (!tracking) return
    const dy = e.touches[0].clientY - startY

    // 上方向は無視。スクロール領域の途中ならスクロールに譲る
    if (dy <= 0) { dragY.value = 0; return }
    if (!isDragging.value && scrollRef.value && scrollRef.value.scrollTop > 0) return

    if (!isDragging.value) {
      if (dy < deadZone) return
      isDragging.value = true
    }
    dragY.value = dy
    if (e.cancelable) e.preventDefault()   // スクロールやブラウザの引っ張り更新を止める
  }

  function finish(close) {
    tracking = false
    isDragging.value = false
    dragY.value = 0
    if (close) onClose()
  }

  function onTouchEnd() {
    if (!tracking) return
    const dy = dragY.value
    const v  = dy / Math.max(performance.now() - startT, 1)   // px/ms
    finish(isDragging.value && (dy > threshold || v > velocity))
  }

  function onTouchCancel() {
    if (tracking) finish(false)
  }

  const handlers = {
    onTouchstart:  onTouchStart,
    onTouchmove:   onTouchMove,
    onTouchend:    onTouchEnd,
    onTouchcancel: onTouchCancel,
  }

  return { dragY, isDragging, scrollRef, handlers }
}
