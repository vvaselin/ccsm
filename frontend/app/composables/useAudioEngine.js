// composables/useAudioEngine.js
// アプリ全体で共有する AudioContext と、バックグラウンド再生のための配管
//
// 配線:
//   全ての音 → master(Gain) → MediaStreamDestination → <audio> 要素 → スピーカー
//
// なぜこうするか:
//   Web Audio API だけで鳴らしていると、Android Chrome は画面オフ時に
//   このページを「音楽再生中」と見なさず、タイマーを間引いたり
//   プロセスを止めたりする。<audio> 要素が再生中であれば
//   メディア再生として扱われ、ロック画面にもコントロールが出る。
//
// 使い方:
//   - unlock()      : 再生ボタンのタップ処理の中で「同期的に」最初に呼ぶ
//   - getCtx()      : AudioContext を取得（各 composable はこれだけを使う）
//   - getMaster()   : 出力先。ctx.destination の代わりにここへ connect する
//   - audioWait(ms) : setTimeout の代わり。音声クロックで待つので
//                     バックグラウンドでも間引かれない
//   - setPlaying(b) : <audio> 要素の再生/停止と MediaSession の状態を切り替える

let ctx = null
let master = null
let streamDest = null
let audioEl = null
let silentBuf = null
let unlocked = false
let outputMode = 'none'        // 'stream' | 'direct'
let internalPause = false      // 自分で pause() したときに true
const handlers = { play: null, pause: null }

export function getCtx() {
  if (!ctx) {
    // latencyHint: 'playback' は低遅延より省電力を優先する指定。睡眠用途なので十分
    ctx = new AudioContext({ latencyHint: 'playback' })
    master = ctx.createGain()
    master.gain.value = 1

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

// ユーザー操作（タップ）の同期処理内で呼ぶこと。
// AudioContext の resume と <audio>.play() はどちらもジェスチャー起点が必要。
export function unlock() {
  const c = getCtx()
  if (c.state === 'suspended') c.resume()

  if (unlocked) return
  unlocked = true

  try {
    streamDest = c.createMediaStreamDestination()
    master.connect(streamDest)

    audioEl = document.createElement('audio')
    audioEl.srcObject = streamDest.stream
    audioEl.setAttribute('playsinline', '')
    audioEl.style.display = 'none'
    document.body.appendChild(audioEl)

    // ロック画面やイヤホンのボタンで止められたとき
    audioEl.addEventListener('pause', () => {
      if (internalPause) { internalPause = false; return }   // 自分で止めた
      handlers.pause?.()                                       // 外から止められた
    })

    outputMode = 'stream'
    audioEl.play().catch(() => fallbackDirect())
  } catch {
    fallbackDirect()
  }
}

// <audio> 経由が使えない環境では直接出力に切り替える（バックグラウンド再生は保証されない）
function fallbackDirect() {
  if (outputMode === 'direct') return
  outputMode = 'direct'
  try { master.disconnect() } catch {}
  master.connect(ctx.destination)
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
