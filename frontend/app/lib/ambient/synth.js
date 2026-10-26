// lib/ambient/synth.js
// Web Audio で合成する環境音（ピンク・ブラウンのノイズ、宇宙）

import { rampToZero }    from '~/lib/audio/context'
import { scheduleAhead } from '~/lib/ambient/schedule'

// 宇宙のふくらみを何秒先まで予約しておくか（scheduleAhead を参照）
const SPACE_AHEAD_SEC = 300

const rand = (a, b) => a + Math.random() * (b - a)

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

export function startPink(ctx, gain) {
  const src = ctx.createBufferSource()
  src.buffer = makePinkBuffer(ctx)
  src.loop   = true
  src.connect(gain)
  src.start()
  return () => { try { src.stop() } catch {} }
}

export function startBrown(ctx, gain) {
  const src = ctx.createBufferSource()
  src.buffer = makeBrownBuffer(ctx)
  src.loop   = true
  src.connect(gain)
  src.start()
  return () => { try { src.stop() } catch {} }
}

// ---- 宇宙 ----
// 低・中・高の 3 層を重ねた持続音。各層が別々の周期でふくらんでは消えるので、
// 全部が同時に黙ることはめったに無く、低い層だけ・高い層だけ・両方、と
// 鳴っている組み合わせがゆっくり入れ替わっていく。
// 周期を 10〜22 秒と互いにずらしてあるので、同じ重なり方には戻らない。
//
// 各層は  オシレータ群 → lowpass → エンベロープ  で、
// lowpass の開閉と音量は層ごとに同じ ConstantSourceNode で駆動している。
// つまりその層が大きくなるときは必ず開き、消えるときは必ずこもる。
//
// 音程は C3 を根音にした完全5度・オクターブの積み重ね（C3 / G3 / G4）。
const SPACE_LAYERS = [
  {
    // hz / cents: デチューン（±2 程度） / level: 層の中での相対振幅
    voices: [
      { hz: 130.81, cents: -2, level: 1.00, type: 'sine' },      // C3
      { hz: 130.81, cents:  0, level: 0.80, type: 'triangle' },
      { hz: 130.81, cents:  2, level: 1.00, type: 'sine' },
      { hz: 261.63, cents: -2, level: 0.20, type: 'sine' },      // C4
      { hz: 261.63, cents:  2, level: 0.16, type: 'triangle' }
    ],
    // 層ごとのゲイン。3層の合計が、ピンクノイズに対して上位5%で -4dB になるよう実測した
    level: 0.0113,
    lpf:   [200, 900],       // [消えているとき, 頂点] のカットオフ
    swell: [12, 18],         // ふくらんで消えるまでの秒数
    gap:   [2, 5],           // そのあとの休み
    lfo:   11,               // カットオフに足すゆっくりした揺れの周期
    start: 0                 // 他の層とずらすための開始オフセット
  },
  {
    voices: [
      { hz: 196.00, cents: -2, level: 1.00, type: 'sine' },      // G3
      { hz: 196.00, cents:  2, level: 0.85, type: 'triangle' },
      { hz: 392.00, cents:  0, level: 0.18, type: 'sine' }       // G4
    ],
    level: 0.0053,
    lpf:   [300, 1400],
    swell: [10, 15],
    gap:   [3, 7],
    lfo:   13,
    start: 6
  },
  {
    voices: [
      { hz: 392.00, cents: -2, level: 1.00, type: 'sine' },      // G4
      { hz: 523.25, cents:  2, level: 0.50, type: 'sine' },      // C5
      { hz: 784.00, cents:  0, level: 0.14, type: 'sine' }       // G5
    ],
    level: 0.0024,
    lpf:   [600, 2800],
    swell: [13, 22],
    gap:   [3, 8],
    lfo:   17,
    start: 13
  }
]

const SPACE_HPF_HZ    = 90     // これより下は切って、低音が溜まらないようにする
const SPACE_FADE_SEC  = 3.0    // 開始・停止のフェード
const SPACE_IR_SEC    = 3.0    // 残響の長さ
const SPACE_DRY       = 0.35   // 残響は wet 多め
const SPACE_WET       = 0.75
// モノラルの残響を広げるための [ディレイ秒, 定位]。左右で差をつけるだけ
const SPACE_WIDEN     = [[0.013, -0.5], [0.021, 0.5]]

// 白色ノイズ × 指数減衰のインパルス応答。
// ステレオにすると ConvolverNode のコストが倍になり（実測 150ms→264ms / 20秒）、
// 音声スレッドが重くなって環境音が途切れる原因になるのでモノラルで作り、
// 広がりは後段の短いディレイ（Haas）で付ける。
// 定常音を通しても音量が暴れないよう、パワーを 1 に正規化する
function makeReverbIR(ctx, seconds = SPACE_IR_SEC, decay = 3.2) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  let power = 0
  for (let i = 0; i < len; i++) {
    const v = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
    d[i] = v
    power += v * v
  }
  const norm = power > 0 ? 1 / Math.sqrt(power) : 1
  for (let i = 0; i < len; i++) d[i] *= norm
  return buf
}

// 0 →（ふくらむ）→ 1 →（消える）→ 0 のカーブ。前半・後半とも余弦なので角が立たない
function makeSwellCurve(attackSec, releaseSec) {
  const points = 192
  const total = attackSec + releaseSec
  const curve = new Float32Array(points)
  for (let i = 0; i < points; i++) {
    const t = (i / (points - 1)) * total
    curve[i] = t < attackSec
      ? 0.5 - 0.5 * Math.cos(Math.PI * t / attackSec)
      : 0.5 + 0.5 * Math.cos(Math.PI * (t - attackSec) / releaseSec)
  }
  curve[points - 1] = 0
  return curve
}

export function startSpace(ctx, gain) {
  const now    = ctx.currentTime
  const oscs          = []    // 止めるべき Oscillator / ConstantSource
  const stopSchedules = []

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

  // 3 層ぶんの出口。ここから先（highpass・残響）は共通
  const mix = ctx.createGain()

  SPACE_LAYERS.forEach((layer) => {
    const src = ctx.createGain()
    src.gain.value = layer.level
    layer.voices.forEach((v) => {
      const osc = ctx.createOscillator()
      osc.type = v.type
      osc.frequency.value = v.hz
      osc.detune.value = v.cents
      const g = ctx.createGain()
      g.gain.value = v.level
      osc.connect(g)
      g.connect(src)
      osc.start(now)
      oscs.push(osc)
    })

    const [lpfMin, lpfMax] = layer.lpf
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.Q.value = 1.8
    lp.frequency.value = lpfMin
    lfo(lp.frequency, layer.lfo, lpfMin * 0.4)   // エンベロープの上の、ゆっくりした揺れ
    src.connect(lp)

    const amp = ctx.createGain()
    amp.gain.value = 0            // 音量はエンベロープが全部決める
    lp.connect(amp)
    amp.connect(mix)

    // この層のふくらみ（0〜1）。音量とカットオフを同じ信号で駆動する
    const envSrc = ctx.createConstantSource()
    envSrc.offset.setValueAtTime(0, now)
    oscs.push(envSrc)

    envSrc.connect(amp.gain)   // 0〜1 がそのまま音量

    // カットオフは 0〜1 を [lpfMin, lpfMax] に引き伸ばしてから足す
    const toLpf = ctx.createGain()
    toLpf.gain.value = lpfMax - lpfMin
    envSrc.connect(toLpf)
    toLpf.connect(lp.frequency)

    envSrc.start(now)

    // サイクルを先々まで予約しておく。setValueCurveAtTime は区間が重なると例外になるので、
    // scheduleAhead に cursor を進めてもらって隙間なく・重なりなく並べる
    const startAt = now + SPACE_FADE_SEC + layer.start
    stopSchedules.push(scheduleAhead(ctx, startAt, SPACE_AHEAD_SEC, (at) => {
      const swell  = rand(layer.swell[0], layer.swell[1])
      const attack = swell * rand(0.40, 0.52)   // 消えるほうを少し長く
      envSrc.offset.setValueCurveAtTime(makeSwellCurve(attack, swell - attack), at, swell)
      return swell + rand(layer.gap[0], layer.gap[1])
    }))
  })

  // 低音を溜めないための highpass
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = SPACE_HPF_HZ
  hp.Q.value = 0.7
  mix.connect(hp)

  // 長い残響（モノラル）
  const conv = ctx.createConvolver()
  conv.buffer = makeReverbIR(ctx)
  const dry = ctx.createGain()
  dry.gain.value = SPACE_DRY

  hp.connect(dry)
  hp.connect(conv)
  dry.connect(out)

  // モノラルの残響を、左右で少しだけ違う短いディレイに通して広げる
  SPACE_WIDEN.forEach(([delaySec, pan]) => {
    const dl = ctx.createDelay(0.1)
    dl.delayTime.value = delaySec
    const pn = ctx.createStereoPanner()
    pn.pan.value = pan
    const wet = ctx.createGain()
    wet.gain.value = SPACE_WET
    conv.connect(dl)
    dl.connect(pn)
    pn.connect(wet)
    wet.connect(out)
  })

  return () => {
    stopSchedules.forEach(stop => stop())
    return rampToZero(out.gain, SPACE_FADE_SEC, ctx).then(() => {
      try { oscs.forEach(o => o.stop()) } catch {}
      try { out.disconnect() } catch {}
    })
  }
}
