// composables/useAudioEngine.js
// アプリ全体で共有する AudioContext と、バックグラウンド再生のための配管
//
// 配線:
//   声（単語・セリフ）→ 声のバス（距離感・波形用の Analyser）→ master
//   環境音            → master
//   master(Gain) → ctx.destination（通常の Web Audio 出力）
//   それとは別に、<audio> 要素で /keepalive.mp3（10秒・ほぼ無音）をループ再生する
//
// なぜこうするか:
//   Android Chrome は「5秒以上のメディアを <audio>/<video> 要素で再生中」のときだけ
//   そのページをメディア再生中と扱う。通知欄・ロック画面のコントロールが出るのも、
//   画面オフでプロセスが止められなくなるのも、この条件を満たしたときだけ。
//   Web Audio API の出力や、MediaStream を srcObject にした <audio> は対象外
//   （後者は Chrome が WontFix にしている）。なので実ファイルをループさせる。
//
// 使い方:
//   - unlock()      : 再生ボタンのタップ処理の中で「同期的に」最初に呼ぶ
//   - getCtx()      : AudioContext を取得（各 composable はこれだけを使う）
//   - getMaster()   : 出力先。ctx.destination の代わりにここへ connect する
//   - getVoiceBus() : 声の出力先 { input, analyser, setDistance(d) }。声は master ではなくここへ
//   - setVoiceDistance(d) / getVoicePanWidth() : 声の距離の切り替えと、単語を左右に振る幅
//   - audioWait(ms) : setTimeout の代わり。音声クロックで待つので
//                     バックグラウンドでも間引かれない
//   - setPlaying(b) : <audio> 要素の再生/停止と MediaSession の状態を切り替える

const KEEPALIVE_SRC = '/keepalive.mp3'

let ctx = null
let master = null
let audioEl = null
let silentBuf = null
let unlocked = false
let internalPause = false      // 自分で pause() したときに true
const handlers = { play: null, pause: null }

export function getCtx() {
  if (!ctx) {
    // latencyHint: 'playback' は低遅延より省電力を優先する指定。睡眠用途なので十分
    ctx = new AudioContext({ latencyHint: 'playback' })
    master = ctx.createGain()
    master.gain.value = 1
    master.connect(ctx.destination)

    // 画面復帰時やシステム側で止められた時に復帰させる
    ctx.addEventListener('statechange', () => {
      if (ctx.state === 'suspended' && audioEl && !audioEl.paused) ctx.resume()
    })
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && ctx.state === 'suspended') ctx.resume()
    })
  }
  return ctx
}

export function getMaster() {
  getCtx()
  return master
}

// ---- 声のバス ----
//
//   source → panner → input ─┬─ lowpass ─┬────────────────────→ output → master
//                            │           └─ convolver ─ wetGain ┘
//                            └─ analyser（波形用。出力はどこにも繋がない）
//
// 声の距離ごとの値。音量（ゲイン）は変えず、こもり具合・左右の振り幅・残響で距離感を出す
const VOICE_DISTANCE_PARAMS = {
  ear:  { lowpass: 3500,  pan: 0.8, wet: 0 },
  near: { lowpass: 8000,  pan: 0.5, wet: 0.12 },
  far:  { lowpass: 18000, pan: 0.2, wet: 0.3 },
}
const DISTANCE_RAMP_SEC = 0.4   // 距離を切り替えたとき、この時間をかけて滑らかに変える

let voiceBus = null
let voiceDistance = 'ear'

// 残響のインパルス応答。ファイルは使わず、ステレオの白色ノイズを指数減衰させて作る
function makeImpulseResponse(c, seconds = 1.6, decay = 3.5) {
  const len = Math.floor(c.sampleRate * seconds)
  const buf = c.createBuffer(2, len, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-(i / c.sampleRate) * decay)
    }
  }
  return buf
}

// 声（単語・セリフ・朗読）の入口。初回呼び出し時に作る
export function getVoiceBus() {
  if (voiceBus) return voiceBus
  const c = getCtx()
  const p = VOICE_DISTANCE_PARAMS[voiceDistance]

  const input = c.createGain()

  const lowpass = c.createBiquadFilter()
  lowpass.type            = 'lowpass'
  lowpass.frequency.value = p.lowpass

  const convolver = c.createConvolver()
  convolver.buffer = makeImpulseResponse(c)

  const wetGain = c.createGain()
  wetGain.gain.value = p.wet

  const output = c.createGain()

  const analyser = c.createAnalyser()
  analyser.fftSize               = 512
  analyser.smoothingTimeConstant = 0.7

  input.connect(lowpass)
  lowpass.connect(output)
  lowpass.connect(convolver)
  convolver.connect(wetGain)
  wetGain.connect(output)
  output.connect(master)
  input.connect(analyser)

  function setDistance(d) {
    const q = VOICE_DISTANCE_PARAMS[d]
    if (!q) return
    voiceDistance = d
    // setTargetAtTime は時定数の約 3 倍でほぼ目標に届く
    const now = c.currentTime
    const tc  = DISTANCE_RAMP_SEC / 3
    lowpass.frequency.setTargetAtTime(q.lowpass, now, tc)
    wetGain.gain.setTargetAtTime(q.wet, now, tc)
  }

  voiceBus = { input, analyser, setDistance }
  return voiceBus
}

// 声の距離を切り替える。バスがまだ無ければ値だけ覚えておき、作るときに使う
// （保存値の復元はタップ前に走るので、ここでは AudioContext を作らない）
export function setVoiceDistance(d) {
  if (!VOICE_DISTANCE_PARAMS[d]) return
  if (voiceBus) voiceBus.setDistance(d)
  else voiceDistance = d
}

// 単語を左右に振る幅（声の距離で変わる）
export function getVoicePanWidth() {
  return VOICE_DISTANCE_PARAMS[voiceDistance].pan
}

// ユーザー操作（タップ）の同期処理内で呼ぶこと。
// AudioContext の resume と <audio>.play() はどちらもジェスチャー起点が必要。
export function unlock() {
  const c = getCtx()
  if (c.state === 'suspended') c.resume()

  if (unlocked) return
  unlocked = true

  audioEl = document.createElement('audio')
  audioEl.src     = KEEPALIVE_SRC
  audioEl.loop    = true
  audioEl.preload = 'auto'
  audioEl.setAttribute('playsinline', '')
  audioEl.style.display = 'none'
  document.body.appendChild(audioEl)

  // ロック画面やイヤホンのボタンで止められたとき
  audioEl.addEventListener('pause', () => {
    if (internalPause) { internalPause = false; return }   // 自分で止めた
    handlers.pause?.()                                       // 外から止められた
  })

  audioEl.play().catch(() => {
    // 失敗しても Web Audio 自体は鳴る。バックグラウンド再生だけが保証されなくなる
  })
}

// 再生中かどうかを OS に伝える（<audio> の再生状態 = 通知やロック画面の表示）
export function setPlaying(playing) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
  }
  if (!audioEl) return
  if (playing) {
    if (audioEl.paused) audioEl.play().catch(() => {})
  } else if (!audioEl.paused) {
    internalPause = true   // 直後に飛ぶ pause イベントを無視するためのフラグ
    audioEl.pause()
  }
}

// ロック画面・通知のコントロール
export function setupMediaSession({ onPlay, onPause, title, artist, artwork = [] }) {
  if (!('mediaSession' in navigator)) return
  handlers.play  = onPlay
  handlers.pause = onPause

  const ms = navigator.mediaSession
  try {
    ms.metadata = new MediaMetadata({ title, artist, artwork })
  } catch {}

  const set = (action, fn) => { try { ms.setActionHandler(action, fn) } catch {} }
  set('play',  () => handlers.play?.())
  set('pause', () => handlers.pause?.())
  set('stop',  () => handlers.pause?.())
  // 使わないボタンは消す
  for (const a of ['seekbackward', 'seekforward', 'previoustrack', 'nexttrack', 'seekto']) set(a, null)
}

export function updateMediaMetadata({ title, artist, artwork = [] }) {
  if (!('mediaSession' in navigator)) return
  try { navigator.mediaSession.metadata = new MediaMetadata({ title, artist, artwork }) } catch {}
}

// setTimeout の代替。無音バッファを鳴らし、終わりを onended で受け取る。
// 音声スレッドの時計で進むので、タブが背面にいても間引かれない。
export function audioWait(ms) {
  const c = getCtx()
  if (!silentBuf) silentBuf = c.createBuffer(1, c.sampleRate, c.sampleRate)  // 1秒の無音

  return new Promise((resolve) => {
    const src = c.createBufferSource()
    src.buffer = silentBuf
    src.loop   = true
    src.connect(master)   // 接続していないソースは onended が来ないことがある
    src.onended = () => {
      try { src.disconnect() } catch {}
      resolve()
    }
    const now = c.currentTime
    src.start(now)
    src.stop(now + Math.max(ms, 1) / 1000)
  })
}