// composables/useAmbientSound.js
// 環境音（複数同時再生・個別音量管理）
//   kind: 'synth' … Web Audio で合成（ノイズ、宇宙）
//   kind: 'file'  … public/ambient/ の音源を AudioBuffer にしてループ再生

import { reactive, onMounted } from 'vue'
import { getCtx as getEngineCtx, getMaster, audioWait, rampToZero } from '~/composables/useAudioEngine'
import { loadSettings, saveSettings } from '~/composables/useSettings'

// ピンクノイズに合わせた音量上限（小さめ）
export const MAX_VOLUME = 0.5

// ファイル音源の継ぎ目処理
const LOOP_XFADE_SEC = 1.0    // 継ぎ目で前後を重ねる長さ（下の startBufferLoop を参照）
const FILE_FADE_SEC  = 0.6    // 開始・停止・切り替え時のフェード
const LOOP_AHEAD_SEC = 120    // 何秒先まで予約しておくか（下の scheduleAhead を参照）
const SPACE_AHEAD_SEC = 300

// 先の時刻にイベントを並べておく共通の仕組み。
// emit(at) が at の音を予約し、次までの秒数を返す。cursor は呼び出しをまたいで
// 進み続けるので、予約が二重になったり抜けたりしない。
//
// 待ちに setInterval ではなく audioWait を使うのは、このアプリの決まりどおり
// 音声クロックで進めるため（背面タブでも間引かれない）。横着して先読みを
// 伸ばすより、時計そのものを間引かれないものにするほうが確実。
function scheduleAhead(ctx, startAt, aheadSec, emit) {
  let cursor  = startAt
  let running = true

  const tick = () => {
    const horizon = ctx.currentTime + aheadSec
    while (cursor < horizon) cursor += emit(cursor)
  }
  tick()

  ;(async () => {
    while (running) {
      await audioWait((aheadSec / 4) * 1000)
      if (running) tick()
    }
  })()

  return () => { running = false }
}

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
  // 旧「バイノーラル」。3Hz のうなりが忙しなく、低音の鳴りっぱなしも疲れるので、
  // C3 を基音に、ときどきふくらんでは消える軽い持続音にしてある
  { id: 'space',    label: '宇宙',         icon: 'i-lucide-orbit',          kind: 'synth' },
]

const SOUND_BY_ID = Object.fromEntries(AMBIENT_SOUNDS.map(s => [s.id, s]))

const rand = (a, b) => a + Math.random() * (b - a)

// デコード済み音源のキャッシュ（src → Promise<{ buffer, region }>）。
// 解決済みの値ではなく Promise を入れるので、読み込み中にもう一度 ON にされても
// fetch・デコード・region の解析が二重に走らない。
// rain_quiet は 301 秒ステレオで約 106MB とかなり大きいので、二重取りは避けたい。
const bufferCache = new Map()

// ループに使う区間を決める。素材の頭と尻が小さいまま終わっていると、そこが継ぎ目の穴になる。
// 実測では rain_quiet に 8 秒のフェードイン・11 秒のフェードアウトが焼き込まれていて、
// 無音だけを削っても継ぎ目で 45dB 落ちていた。
// そこで 50ms ごとの RMS を取り、その中央値（= 素材の定常レベル）から
// SILENCE_DROP_DB 以上下がっている頭と尻を落として、残りをループさせる。
// 継ぎ目の無い fire・river は中央値のすぐ近くから始まるので、何も削られない。
// 継ぎ目の重なりに使う等パワーのカーブ。中身は固定なので一度だけ作って使い回す
// （setValueCurveAtTime は配列をコピーするので共有して安全）。
// sin² + cos² = 1 なので、重なっている間もパワーが一定に保たれる
const XFADE_IN  = new Float32Array(64)
const XFADE_OUT = new Float32Array(64)
for (let i = 0; i < 64; i++) {
  const t = (i / 63) * (Math.PI / 2)
  XFADE_IN[i]  = Math.sin(t)
  XFADE_OUT[i] = Math.cos(t)
}

const SILENCE_DROP_DB = 3
const FRAME_SEC       = 0.05

function soundRegion(buffer) {
  const sr  = buffer.sampleRate
  const ch  = buffer.numberOfChannels
  const hop = Math.round(sr * FRAME_SEC)
  const data = Array.from({ length: ch }, (_, c) => buffer.getChannelData(c))

  const frames = []
  for (let i = 0; i + hop <= buffer.length; i += hop) {
    let sum = 0
    for (let c = 0; c < ch; c++) {
      const a = data[c]
      for (let k = i; k < i + hop; k++) sum += a[k] * a[k]
    }
    frames.push(Math.sqrt(sum / (hop * ch)))
  }

  // 1 フレームに満たない素材（実際には来ない）。duration が 0 だと
  // 下の scheduleAhead が一歩も進まず無限ループになるので、ここで弾いておく
  if (!frames.length) return { offset: 0, duration: Math.max(buffer.duration, 1) }

  const median = [...frames].sort((x, y) => x - y)[Math.floor(frames.length / 2)]
  const th = median * Math.pow(10, -SILENCE_DROP_DB / 20)

  // しきい値は中央値より下なので、頭も尻も必ず中央値のフレームで止まる
  let head = 0
  while (frames[head] < th) head++
  let tail = frames.length - 1
  while (frames[tail] < th) tail--

  return {
    offset: (head * hop) / sr,
    duration: ((tail - head + 1) * hop) / sr,
  }
}

function loadBuffer(ctx, src) {
  if (!bufferCache.has(src)) {
    const task = (async () => {
      const res = await fetch(src)
      if (!res.ok) throw new Error(`環境音の取得に失敗: ${src}`)
      const buffer = await ctx.decodeAudioData(await res.arrayBuffer())
      return { buffer, region: soundRegion(buffer) }   // 解析もデコードと同じ一回だけ
    })()
    task.catch(() => bufferCache.delete(src))          // 失敗は次回やり直せるように
    bufferCache.set(src, task)
  }
  return bufferCache.get(src)
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

  // ---- ファイル音源：AudioBuffer をクロスフェードでループ再生 ----
  // src.loop = true はサンプル単位では繋がるが、素材の頭と尻の波形が揃っていないと
  // 継ぎ目が穴に聴こえる（mp3 のエンコード由来の無音が残っている雨がこれ）。
  // そこで 1 本をループさせるのではなく、同じバッファを LOOP_XFADE_SEC だけ
  // 重ねながら次々に鳴らす。
  //
  //   ├──────── 1本目 ────────┐
  //                      ┌────┴─────── 2本目 ────────┐
  //                      └ ここが重なり（sin/cos で等パワー）
  //
  // 重なりは sin/cos にしてある。雨のような無相関なノイズは音量ではなくパワーで
  // 足し算されるので、直線のクロスフェードだと真ん中で約 3dB へこんで、
  // かえって「途切れた」ように聴こえてしまう。
  function startBufferLoop(ctx, gain, buffer, region, level) {
    const lv = ctx.createGain()
    lv.gain.setValueAtTime(0, ctx.currentTime)
    lv.gain.linearRampToValueAtTime(level, ctx.currentTime + FILE_FADE_SEC)   // フェードイン
    lv.connect(gain)

    // region は無音・フェードを避けた、実際に鳴っている区間（loadBuffer で解析済み）
    const { offset, duration: dur } = region
    const xfade  = Math.min(LOOP_XFADE_SEC, dur / 4)
    const period = dur - xfade          // 次を鳴らし始めるまでの間隔

    const live = new Set()
    function playOne(at) {
      const src = ctx.createBufferSource()
      src.buffer = buffer

      const g = ctx.createGain()
      g.gain.setValueCurveAtTime(XFADE_IN, at, xfade)
      g.gain.setValueAtTime(1, at + xfade)
      g.gain.setValueCurveAtTime(XFADE_OUT, at + dur - xfade, xfade)

      src.connect(g)
      g.connect(lv)
      src.start(at, offset, dur)   // dur を渡してあるので stop は要らない
      src.onended = () => {
        live.delete(src)
        try { src.disconnect(); g.disconnect() } catch {}
      }
      live.add(src)
    }

    const stopSchedule = scheduleAhead(ctx, ctx.currentTime, LOOP_AHEAD_SEC, (at) => {
      playOne(at)
      return period
    })

    return () => {
      // フェードアウトしてから止める
      stopSchedule()
      rampToZero(lv.gain, FILE_FADE_SEC, ctx).then(() => {
        for (const src of live) {
          src.onended = null
          try { src.stop() } catch {}
          try { src.disconnect() } catch {}
        }
        live.clear()
        try { lv.disconnect() } catch {}
      })
    }
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

  function startSpace(ctx, gain) {
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
      rampToZero(out.gain, SPACE_FADE_SEC, ctx).then(() => {
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
        .then(({ buffer, region }) => {
          if (nodes[id] !== entry) return
          entry.stopFn = startBufferLoop(ctx, gain, buffer, region, (sound.level ?? 1) * (variant.gain ?? 1))
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
    AMBIENT_SOUNDS.forEach((s) => {
      if (nodes[s.id]) rampToZero(nodes[s.id].gainNode.gain, fadeDurationMs / 1000, ctx)
    })

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
