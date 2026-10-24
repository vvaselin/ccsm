// composables/useAmbientSound.js
// 環境音（複数同時再生・個別音量管理）
//   kind: 'synth' … Web Audio で合成（ノイズ、バイノーラル）
//   kind: 'file'  … public/ambient/ の音源を AudioBuffer にしてループ再生

import { reactive, onMounted } from 'vue'
import { getCtx as getEngineCtx, getMaster, audioWait } from '~/composables/useAudioEngine'
import { loadSettings, saveSettings } from '~/composables/useSettings'

// ピンクノイズに合わせた音量上限（小さめ）
export const MAX_VOLUME = 0.5

// ファイル音源の継ぎ目処理
const LOOP_TRIM_SEC  = 0.03   // mp3 のエンコード無音を避けるため前後を少し削る
const FILE_FADE_SEC  = 0.6    // 開始・停止・切り替え時のフェード

// 並び順は設定シートのタイルの順（icon は lucide のクラス名）
export const AMBIENT_SOUNDS = [
  {
    id: 'rain', label: '雨', icon: 'i-lucide-cloud-rain', kind: 'file',
    // level: 合成ノイズ（かなり小さい）と音量感を揃えるための係数。耳で調整する
    level: 0.18,
    defaultVariant: 'normal',
    variants: [
      { id: 'quiet',  label: '静か', src: '/ambient/rain_quiet.mp3',  gain: 1.0 },
      { id: 'normal', label: '普通', src: '/ambient/rain_normal.mp3', gain: 1.0 },
      { id: 'heavy',  label: '強い', src: '/ambient/rain_heavy.mp3',  gain: 1.0 },
    ],
  },
  { id: 'pink',     label: 'ピンク',       icon: 'i-lucide-audio-waveform', kind: 'synth' },
  { id: 'brown',    label: 'ブラウン',     icon: 'i-lucide-activity',       kind: 'synth' },
  { id: 'binaural', label: 'バイノーラル', icon: 'i-lucide-headphones',     kind: 'synth' },
]

const SOUND_BY_ID = Object.fromEntries(AMBIENT_SOUNDS.map(s => [s.id, s]))

// デコード済みバッファのキャッシュ（src → AudioBuffer）。
// 60秒モノラルで約 11MB。雨3種で 35MB 弱なので全部持っていても問題ない
const bufferCache = new Map()

async function loadBuffer(ctx, src) {
  if (bufferCache.has(src)) return bufferCache.get(src)
  const res = await fetch(src)
  if (!res.ok) throw new Error(`環境音の取得に失敗: ${src}`)
  const buf = await ctx.decodeAudioData(await res.arrayBuffer())
  bufferCache.set(src, buf)
  return buf
}

export function useAmbientSound() {
  // サウンドごとの状態
  const states = reactive(
    Object.fromEntries(
      AMBIENT_SOUNDS.map(s => [s.id, { enabled: false, volume: 0.3, variant: s.defaultVariant ?? null }])
    )
  )

  // セッション再生中かどうか（start/stop と連動）
  let sessionActive = false

  // 保存済みの ON/OFF・音量を復元（プリレンダーと食い違わないようマウント後）
  onMounted(() => {
    const saved = loadSettings().ambient || {}
    for (const id of Object.keys(states)) {
      if (saved[id]) Object.assign(states[id], saved[id])
    }
  })

  function persist() {
    saveSettings({ ambient: JSON.parse(JSON.stringify(states)) })
  }

  // サウンドごとのノード（AudioContext は useAudioEngine で共有）
  const nodes = {}  // { [id]: { gainNode, stopFn } }

  function getCtx() {
    const ctx = getEngineCtx()
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
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

  // ---- ファイル音源：AudioBuffer をループ再生 ----
  // <audio loop> だと mp3 の先頭・末尾の無音で継ぎ目が切れるので、
  // loopStart / loopEnd で少し内側をループさせる
  function startBufferLoop(ctx, gain, buffer, level) {
    const src = ctx.createBufferSource()
    src.buffer    = buffer
    src.loop      = true
    src.loopStart = LOOP_TRIM_SEC
    src.loopEnd   = Math.max(buffer.duration - LOOP_TRIM_SEC, LOOP_TRIM_SEC + 1)

    const lv = ctx.createGain()
    lv.gain.setValueAtTime(0, ctx.currentTime)
    lv.gain.linearRampToValueAtTime(level, ctx.currentTime + FILE_FADE_SEC)   // フェードイン

    src.connect(lv)
    lv.connect(gain)
    src.start(0, LOOP_TRIM_SEC)

    return () => {
      // フェードアウトしてから止める
      const now = ctx.currentTime
      lv.gain.cancelScheduledValues(now)
      lv.gain.setValueAtTime(lv.gain.value, now)
      lv.gain.linearRampToValueAtTime(0, now + FILE_FADE_SEC)
      audioWait(FILE_FADE_SEC * 1000 + 50).then(() => {
        try { src.stop() } catch {}
        try { src.disconnect(); lv.disconnect() } catch {}
      })
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
    const sound = SOUND_BY_ID[id]
    const ctx   = getCtx()
    const gain  = ctx.createGain()
    gain.gain.value = Math.min(states[id].volume, MAX_VOLUME)
    gain.connect(getMaster())

    const entry = { gainNode: gain, stopFn: null }
    nodes[id] = entry

    if (sound.kind === 'file') {
      // 非同期で読み込む。読み込み中に止められたら entry が差し替わっているので捨てる
      const variant = sound.variants.find(v => v.id === states[id].variant) ?? sound.variants[0]
      loadBuffer(ctx, variant.src)
        .then((buffer) => {
          if (nodes[id] !== entry) return
          entry.stopFn = startBufferLoop(ctx, gain, buffer, (sound.level ?? 1) * (variant.gain ?? 1))
        })
        .catch(() => {
          if (nodes[id] === entry) nodes[id] = null
        })
      return
    }

    const starters = { pink: startPink, brown: startBrown, binaural: startBinaural }
    entry.stopFn = starters[id]?.(ctx, gain)
  }

  function _stopOne(id) {
    if (!nodes[id]) return
    nodes[id].stopFn?.()
    nodes[id] = null
  }

  // ---- 公開 API ----

  function toggle(id) {
    states[id].enabled = !states[id].enabled
    persist()
    if (states[id].enabled && sessionActive) {
      _startOne(id)
    } else if (!states[id].enabled) {
      _stopOne(id)
    }
  }

  // 雨の強さなどの切り替え。再生中なら止めて鳴らし直す（フェードで繋がる）
  function setVariant(id, variantId) {
    const sound = SOUND_BY_ID[id]
    if (!sound?.variants?.some(v => v.id === variantId)) return
    states[id].variant = variantId
    persist()
    if (nodes[id]) {
      _stopOne(id)
      _startOne(id)
    }
  }

  function setVolume(id, v) {
    const clamped = Math.min(v, MAX_VOLUME)
    states[id].volume = clamped
    persist()
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

  // タイマー終了時：fadeDurationMs かけてフェードアウトして停止
  async function fadeOutAudio(holdMs = 0, fadeDurationMs = 4000) {
    sessionActive = false

    if (holdMs > 0) {
      await audioWait(holdMs)
    }

    // 再生中のノードにフェードをかける
    const ctx = getEngineCtx()
    {
      AMBIENT_SOUNDS.forEach(s => {
        if (!nodes[s.id]) return
        const g   = nodes[s.id].gainNode
        const now = ctx.currentTime
        g.gain.cancelScheduledValues(now)
        g.gain.setValueAtTime(g.gain.value, now)
        g.gain.linearRampToValueAtTime(0, now + fadeDurationMs / 1000)
      })
    }

    await audioWait(fadeDurationMs + 200)
    AMBIENT_SOUNDS.forEach(s => _stopOne(s.id))
  }

  function dispose() {
    stopAudio()
    // AudioContext は共有なのでここでは閉じない
  }

  return {
    states,
    toggle,
    setVolume,
    setVariant,
    startIfEnabled,
    stopAudio,
    fadeOutAudio,
    dispose,
  }
}