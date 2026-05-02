// composables/useAmbientSound.js
// Web Audio API による環境音生成（複数同時再生・個別音量管理）

import { ref, reactive } from 'vue'

// ピンクノイズに合わせた音量上限（小さめ）
const MAX_VOLUME = 0.5

export const AMBIENT_SOUNDS = [
  { id: 'pink',     label: 'ピンクノイズ', icon: '〜' },
  { id: 'brown',    label: 'ブラウンノイズ', icon: '▬' },
  { id: 'rain',     label: '雨音',          icon: '✦' },
  { id: 'binaural', label: 'バイノーラル',   icon: '◎' },
]

export function useAmbientSound() {
  // サウンドごとの状態
  const states = reactive(
    Object.fromEntries(
      AMBIENT_SOUNDS.map(s => [s.id, { enabled: false, volume: 0.3 }])
    )
  )

  // セッション再生中かどうか（start/stop と連動）
  let sessionActive = false

  // サウンドごとの AudioContext リソース
  let audioCtx = null
  const nodes = {}  // { [id]: { gainNode, stopFn } }

  function getCtx() {
    if (!audioCtx) audioCtx = new AudioContext()
    if (audioCtx.state === 'suspended') audioCtx.resume()
    return audioCtx
  }

  // ---- ノイズバッファ生成 ----

  function makePinkBuffer(ctx) {
    const len  = ctx.sampleRate * 2
    const buf  = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.99886*b0 + w*0.0555179; b1 = 0.99332*b1 + w*0.0750759
      b2 = 0.96900*b2 + w*0.1538520; b3 = 0.86650*b3 + w*0.3104856
      b4 = 0.55000*b4 + w*0.5329522; b5 = -0.7616*b5 - w*0.0168980
      data[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362) * 0.01  // ピンクノイズと同じ係数
      b6 = w * 0.115926
    }
    return buf
  }

  function makeBrownBuffer(ctx) {
    const len  = ctx.sampleRate * 2
    const buf  = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      last = (last + 0.02 * w) / 1.02
      data[i] = last * 0.35  // ピンクノイズに合わせて小さく
    }
    return buf
  }

  // ---- サウンド別スタート関数 ----

  function startPink(ctx, gain) {
    const src = ctx.createBufferSource()
    src.buffer = makePinkBuffer(ctx)
    src.loop   = true
    src.connect(gain)
    src.start()
    return () => { try { src.stop() } catch {} }
  }

  function startBrown(ctx, gain) {
    const src = ctx.createBufferSource()
    src.buffer = makeBrownBuffer(ctx)
    src.loop   = true
    src.connect(gain)
    src.start()
    return () => { try { src.stop() } catch {} }
  }

  function startRain(ctx, gain) {
    let running = true

    // ---- 空気感：ブラウンノイズを極小で敷くだけ ----
    const baseSrc = ctx.createBufferSource()
    baseSrc.buffer = makeBrownBuffer(ctx)
    baseSrc.loop   = true
    const baseLpf = ctx.createBiquadFilter()
    baseLpf.type            = 'lowpass'
    baseLpf.frequency.value = 300
    baseLpf.Q.value         = 0.2
    const baseGain = ctx.createGain()
    baseGain.gain.value = 0.018
    baseSrc.connect(baseLpf)
    baseLpf.connect(baseGain)
    baseGain.connect(gain)
    baseSrc.start()

    // ---- コトッ音：ノイズ × 指数減衰でインパルス感を出す ----
    function playDrop() {
      // アタック部（ごく短いノイズバースト）+ テール部（こもった余韻）
      const attackLen = Math.floor(ctx.sampleRate * 0.004)   // 4ms アタック
      const tailLen   = Math.floor(ctx.sampleRate * (0.04 + Math.random() * 0.05))  // 40〜90ms 余韻
      const totalLen  = attackLen + tailLen
      const buf       = ctx.createBuffer(1, totalLen, ctx.sampleRate)
      const d         = buf.getChannelData(0)

      for (let i = 0; i < totalLen; i++) {
        const white = Math.random() * 2 - 1
        if (i < attackLen) {
          // アタック：フルノイズ（立ち上がりをはっきりさせる）
          d[i] = white
        } else {
          // テール：急速に減衰するノイズ（余韻）
          const t = (i - attackLen) / ctx.sampleRate
          d[i] = white * Math.exp(-t / 0.015)
        }
      }

      const src = ctx.createBufferSource()
      src.buffer = buf

      // LPF：高域を削って布・木のこもり感に。周波数を低めに固定
      const lpf = ctx.createBiquadFilter()
      lpf.type            = 'lowpass'
      lpf.frequency.value = 400 + Math.random() * 300   // 400〜700Hz
      lpf.Q.value         = 0.4

      // GainNodeでエンベロープをかけて音量のばらつきを出す
      const g = ctx.createGain()
      g.gain.value = 0.05 + Math.random() * 0.18  // ゲイン下げる

      src.connect(lpf)
      lpf.connect(g)
      g.connect(gain)
      src.start()
    }

    // ---- サーッ音：ピンクノイズをBPFで雨っぽい帯域に絞る ----
    const rushSrc = ctx.createBufferSource()
    rushSrc.buffer = makePinkBuffer(ctx)
    rushSrc.loop   = true

    const rushBpf = ctx.createBiquadFilter()
    rushBpf.type            = 'bandpass'
    rushBpf.frequency.value = 2000   // 2kHz付近：雨の「サーッ」帯域
    rushBpf.Q.value         = 0.6    // 広めに通す

    const rushGain = ctx.createGain()
    rushGain.gain.value = 0.3

    rushSrc.connect(rushBpf)
    rushBpf.connect(rushGain)
    rushGain.connect(gain)
    rushSrc.start()

    async function dropLoop() {
      while (running) {
        await new Promise(r => setTimeout(r, 90 + Math.random() * 220))
        if (!running) break
        playDrop()

        // たまに2粒続けて落ちる
        if (Math.random() < 0.2) {
          await new Promise(r => setTimeout(r, 30 + Math.random() * 50))
          if (!running) break
          playDrop()
        }
      }
    }

    dropLoop()

    return () => {
      running = false
      try { baseSrc.stop() } catch {}
      try { rushSrc.stop() } catch {}
    }
  }

  function startBinaural(ctx, gain) {
    const BASE_FREQ = 200
    const BEAT_FREQ = 3  // デルタ波（深睡眠）

    const merger = ctx.createChannelMerger(2)
    merger.connect(gain)

    const gainL = ctx.createGain()
    gainL.gain.value = 0.012
    gainL.connect(merger, 0, 0)

    const gainR = ctx.createGain()
    gainR.gain.value = 0.012
    gainR.connect(merger, 0, 1)

    const oscL = ctx.createOscillator()
    oscL.type            = 'sine'
    oscL.frequency.value = BASE_FREQ
    oscL.connect(gainL)

    const oscR = ctx.createOscillator()
    oscR.type            = 'sine'
    oscR.frequency.value = BASE_FREQ + BEAT_FREQ
    oscR.connect(gainR)

    // ピンクノイズを極小で混ぜて耳疲れを防ぐ
    const pinkSrc = ctx.createBufferSource()
    pinkSrc.buffer = makePinkBuffer(ctx)
    pinkSrc.loop   = true
    const pinkGain = ctx.createGain()
    pinkGain.gain.value = 0.008
    pinkSrc.connect(pinkGain)
    pinkGain.connect(gain)
    pinkSrc.start()

    oscL.start(); oscR.start()

    return () => {
      try { oscL.stop(); oscR.stop(); pinkSrc.stop() } catch {}
    }
  }

  // ---- 内部：1つのサウンドを起動・停止 ----

  function _startOne(id) {
    if (nodes[id]) return
    const ctx  = getCtx()
    const gain = ctx.createGain()
    gain.gain.value = Math.min(states[id].volume, MAX_VOLUME)
    gain.connect(ctx.destination)

    const starters = { pink: startPink, brown: startBrown, rain: startRain, binaural: startBinaural }
    const stopFn   = starters[id]?.(ctx, gain)
    nodes[id]      = { gainNode: gain, stopFn }
  }

  function _stopOne(id) {
    if (!nodes[id]) return
    nodes[id].stopFn?.()
    nodes[id] = null
  }

  // ---- 公開 API ----

  function toggle(id) {
    states[id].enabled = !states[id].enabled
    if (states[id].enabled && sessionActive) {
      _startOne(id)
    } else if (!states[id].enabled) {
      _stopOne(id)
    }
  }

  function setVolume(id, v) {
    const clamped = Math.min(v, MAX_VOLUME)
    states[id].volume = clamped
    if (nodes[id]) {
      nodes[id].gainNode.gain.setTargetAtTime(clamped, getCtx().currentTime, 0.02)
    }
  }

  // 再生ボタン押下時：enabled なものを全部起動
  function startIfEnabled() {
    sessionActive = true
    AMBIENT_SOUNDS.forEach(s => {
      if (states[s.id].enabled) _startOne(s.id)
    })
  }

  // 停止ボタン押下時：全部止める
  function stopAudio() {
    sessionActive = false
    AMBIENT_SOUNDS.forEach(s => _stopOne(s.id))
  }

  function dispose() {
    stopAudio()
    audioCtx?.close()
    audioCtx = null
  }

  return {
    states,
    toggle,
    setVolume,
    startIfEnabled,
    stopAudio,
    dispose,
  }
}