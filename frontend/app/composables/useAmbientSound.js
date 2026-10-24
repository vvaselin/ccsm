// composables/useAmbientSound.js
// 環境音（複数同時再生・個別音量管理）
//   kind: 'synth' … Web Audio で合成（ノイズ、宇宙）
//   kind: 'file'  … public/ambient/ の音源を AudioBuffer にしてループ再生

import { reactive, onMounted } from 'vue'
import { getCtx as getEngineCtx, getMaster, audioWait } from '~/composables/useAudioEngine'
import { loadSettings, saveSettings } from '~/composables/useSettings'

// ピンクノイズに合わせた音量上限（小さめ）
export const MAX_VOLUME = 0.5

// ファイル音源の継ぎ目処理
const LOOP_TRIM_SEC  = 0      // ループ素材の継ぎ目に穴を開けないよう削らない（mp3 の先頭・末尾の無音はデコーダーが除去する）
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
  // 音源は -23 LUFS モノラル（両耳に同じ音が出るので再生時は -20 LUFS）。
  // 雨（普通、-36.6 LUFS）と同じスライダー位置で同じ音量感になるよう 0.18 × 10^(-16.6/20) にしてある
  { id: 'fire',     label: '焚き火',       icon: 'i-lucide-flame',          kind: 'file', level: 0.027, src: '/ambient/fire.mp3' },
  { id: 'river',    label: '川',           icon: 'i-lucide-waves',          kind: 'file', level: 0.027, src: '/ambient/river.mp3' },
  { id: 'pink',     label: 'ピンク',      icon: 'i-lucide-audio-waveform', kind: 'synth' },
  { id: 'brown',    label: 'ブラウン',     icon: 'i-lucide-activity',       kind: 'synth' },
  // 旧「バイノーラル」。3Hz のうなりが「ウォンウォン」と忙しなかったので、
  // 「ふぉ〜〜ん」とふくらむ低い持続音に差し替えた（左右 3Hz 差は残してある）
  { id: 'space',    label: '宇宙',         icon: 'i-lucide-orbit',          kind: 'synth' },
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
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759
      b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856
      b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.01  // ピンクノイズと同じ係数
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
  // <audio loop> だと継ぎ目で途切れるので、AudioBuffer をサンプル単位でループさせる。
  // 削る必要がある素材のために loopStart / loopEnd を LOOP_TRIM_SEC だけ内側にできる
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

  // ---- 宇宙 ----
  // 55Hz(A1) を基音に、±3〜8 cent ずらした oscillator を重ねた持続音。
  // 「ふぉ〜〜ん」とふくらむのは
  //   ・デチューン同士の 0.1〜0.3Hz のうなり（ごく遅い）
  //   ・カットオフ 200〜900Hz を 11 秒周期で動かす lowpass（こもる／開く）
  //   ・17 秒周期の音量 LFO（周期をフィルターとずらしてあるので同じ表情に戻らない）
  // の3つ。さらに自前生成した 5 秒のインパルス応答で長い残響をかけている。
  const SPACE_BASE = 55          // A1

  const SPACE_VOICES = [
    // ratio: 基音からの比 / cents: デチューン / level: 相対振幅
    { ratio: 1,   cents: -7, level: 1.00, type: 'sawtooth' },  // 55Hz（基音）
    { ratio: 1,   cents: -2, level: 0.95, type: 'triangle' },
    { ratio: 1,   cents:  3, level: 0.95, type: 'sawtooth' },
    { ratio: 1,   cents:  8, level: 0.90, type: 'triangle' },
    { ratio: 1.5, cents: -4, level: 0.38, type: 'triangle' },  // 82.5Hz（5度上）
    { ratio: 1.5, cents:  5, level: 0.34, type: 'triangle' },
    { ratio: 2,   cents: -5, level: 0.26, type: 'triangle' },  // 110Hz（オクターブ上）
    { ratio: 2,   cents:  6, level: 0.23, type: 'triangle' }
  ]

  const SPACE_BEAT_HZ    = 3      // 右チャンネルの基音だけ 3Hz 上げる（バイノーラルビート）
  const SPACE_LEVEL      = 0.065  // 全体ゲイン。ピンクノイズと K 特性（LUFS）の平均が揃う値を実測して決めた
  const SPACE_FADE_SEC   = 3.0    // 開始・停止のフェード
  const SPACE_IR_SEC     = 5.0    // 残響の長さ
  const SPACE_DRY        = 0.35   // 残響は wet 多め
  const SPACE_WET        = 0.75

  // 白色ノイズ × 指数減衰のインパルス応答。左右を別々のノイズにして広がりを出す。
  // 定常音を通しても音量が暴れないよう、チャンネルごとにパワーを 1 に正規化する
  function makeReverbIR(ctx, seconds = SPACE_IR_SEC, decay = 3.2) {
    const len = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch)
      let power = 0
      for (let i = 0; i < len; i++) {
        const v = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
        d[i] = v
        power += v * v
      }
      const norm = power > 0 ? 1 / Math.sqrt(power) : 1
      for (let i = 0; i < len; i++) d[i] *= norm
    }
    return buf
  }

  function startSpace(ctx, gain) {
    const now  = ctx.currentTime
    const oscs = []            // 止めるべき OscillatorNode（LFO も含む）

    // 全体のフェードイン／アウト用
    const out = ctx.createGain()
    out.gain.setValueAtTime(0, now)
    out.gain.linearRampToValueAtTime(1, now + SPACE_FADE_SEC)
    out.connect(gain)

    // sine の LFO を作って param に足し込む（param は中心値、depth は振れ幅）
    function lfo(param, periodSec, depth, phaseOffsetSec = 0) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = 1 / periodSec
      const d = ctx.createGain()
      d.gain.value = depth
      o.connect(d)
      d.connect(param)
      o.start(now + phaseOffsetSec)
      oscs.push(o)
    }

    // 左右で別々にオシレータを立て、右だけ基音を SPACE_BEAT_HZ 上げる
    const merger = ctx.createChannelMerger(2)
    for (let ch = 0; ch < 2; ch++) {
      const chGain = ctx.createGain()
      chGain.gain.value = SPACE_LEVEL
      chGain.connect(merger, 0, ch)

      SPACE_VOICES.forEach((v) => {
        const osc = ctx.createOscillator()
        osc.type = v.type
        // 5度・オクターブは左右同じ。うなりを作るのは基音だけ
        osc.frequency.value = SPACE_BASE * v.ratio
          + (ch === 1 && v.ratio === 1 ? SPACE_BEAT_HZ : 0)
        osc.detune.value = v.cents

        const g = ctx.createGain()
        g.gain.value = v.level
        osc.connect(g)
        g.connect(chGain)
        osc.start(now)
        oscs.push(osc)
      })
    }

    // こもる／開くを作る lowpass。200〜900Hz を 11 秒周期で行き来する
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.Q.value = 1.8
    lp.frequency.value = 550
    lfo(lp.frequency, 11, 350)
    merger.connect(lp)

    // ふくらみ。0.6〜1.0 を 17 秒周期で（フィルターとは周期をずらす）
    const amp = ctx.createGain()
    amp.gain.value = 0.8
    lfo(amp.gain, 17, 0.2, 2.5)
    lp.connect(amp)

    // 長い残響
    const conv = ctx.createConvolver()
    conv.buffer = makeReverbIR(ctx)
    const wet = ctx.createGain()
    wet.gain.value = SPACE_WET
    const dry = ctx.createGain()
    dry.gain.value = SPACE_DRY

    amp.connect(dry)
    amp.connect(conv)
    conv.connect(wet)
    dry.connect(out)
    wet.connect(out)

    return () => {
      const t = ctx.currentTime
      out.gain.cancelScheduledValues(t)
      out.gain.setValueAtTime(out.gain.value, t)
      out.gain.linearRampToValueAtTime(0, t + SPACE_FADE_SEC)
      audioWait(SPACE_FADE_SEC * 1000 + 50).then(() => {
        try { oscs.forEach(o => o.stop()) } catch {}
        try { out.disconnect() } catch {}
      })
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
      // 非同期で読み込む。読み込み中に止められたら entry が差し替わっているので捨てる。
      // variants の無い音（焚き火・川）は src をそのまま使う
      const variant = sound.variants?.find(v => v.id === states[id].variant)
        ?? sound.variants?.[0]
        ?? { src: sound.src, gain: 1 }
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

    const starters = { pink: startPink, brown: startBrown, space: startSpace }
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
    AMBIENT_SOUNDS.forEach((s) => {
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
      AMBIENT_SOUNDS.forEach((s) => {
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
