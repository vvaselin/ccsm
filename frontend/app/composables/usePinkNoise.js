// composables/usePinkNoise.js
// Web Audio API によるピンクノイズ生成

import { ref } from 'vue'

const MAX_VOLUME = 0.5  // gainの上限（バッファ係数0.01で実音量を制限済み）

export function usePinkNoise() {
  const isEnabled = ref(true)   // 設定ON/OFF（再生停止をまたいで保持）
  const isPlaying = ref(false)  // 実際に音が出ているか
  const volume    = ref(0.3)

  let audioCtx     = null
  let bufferSource = null
  let gainNode     = null

  function getAudioCtx() {
    if (!audioCtx) audioCtx = new AudioContext()
    return audioCtx
  }

  function createPinkNoiseBuffer(ctx) {
    const bufferSize = ctx.sampleRate * 2
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data   = buffer.getChannelData(0)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.0750759
      b2 = 0.96900 * b2 + white * 0.1538520
      b3 = 0.86650 * b3 + white * 0.3104856
      b4 = 0.55000 * b4 + white * 0.5329522
      b5 = -0.7616 * b5 - white * 0.0168980
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.01
      b6 = white * 0.115926
    }
    return buffer
  }

  function _start() {
    if (isPlaying.value) return
    const ctx = getAudioCtx()
    if (ctx.state === 'suspended') ctx.resume()
    const buffer = createPinkNoiseBuffer(ctx)
    bufferSource = ctx.createBufferSource()
    bufferSource.buffer = buffer
    bufferSource.loop   = true
    gainNode = ctx.createGain()
    gainNode.gain.value = Math.min(volume.value, MAX_VOLUME)
    bufferSource.connect(gainNode)
    gainNode.connect(ctx.destination)
    bufferSource.start()
    isPlaying.value = true
  }

  function _stop() {
    if (!isPlaying.value) return
    try { bufferSource?.stop() } catch {}
    bufferSource = null
    isPlaying.value = false
  }

  // 設定ボタン用：ON/OFFを切り替えるだけ
  // 再生中にOFFにした場合のみ即座に音を止める
  // OFFからONにしても音は出ない（再生ボタンと連動させる）
  function toggle() {
    isEnabled.value = !isEnabled.value
    if (!isEnabled.value) _stop()
  }

  // 再生ボタン押下時に呼ぶ：isEnabledがtrueのときだけ音を出す
  function startIfEnabled() {
    if (isEnabled.value) _start()
  }

  // 停止ボタン押下時に呼ぶ
  function stopAudio() {
    _stop()
  }

  function setVolume(v) {
    const clamped = Math.min(v, MAX_VOLUME)
    volume.value = clamped
    if (gainNode) gainNode.gain.setTargetAtTime(clamped, getAudioCtx().currentTime, 0.01)
  }

  function dispose() {
    _stop()
    audioCtx?.close()
    audioCtx = null
  }

  return {
    isEnabled,
    isPlaying,
    volume,
    toggle,
    startIfEnabled,
    stopAudio,
    setVolume,
    dispose,
  }
}