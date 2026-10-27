// lib/audio/context.js
// アプリ全体で共有する AudioContext と master、音声クロックで待つ audioWait
//
// 配線:
//   声（単語・セリフ）→ 声のバス（距離感・波形用の Analyser）→ master
//   環境音            → master
//   master(Gain) → ctx.destination（通常の Web Audio 出力）
//   それとは別に、<audio> 要素で /keepalive.mp3（10秒・ほぼ無音）をループ再生する
//
// 使い方:
//   - getCtx()      : AudioContext を取得（各 composable はこれだけを使う）
//   - getMaster()   : 出力先。ctx.destination の代わりにここへ connect する
//   - audioWait(ms) : setTimeout の代わり。音声クロックで待つので
//                     バックグラウンドでも間引かれない

let ctx = null
let master = null
let silentBuf = null

export function getCtx() {
  if (!ctx) {
    // 出力バッファの長さ。'playback' だと Chrome では 20ms しか取られず、画面オフで
    // CPU が落ちたときに音声スレッドが間に合わずプツプツ途切れていた。秒で渡すと
    // そのまま使われる（Chrome は約 170ms が上限）。長くするほど途切れにくいが、
    // 解析した波形の更新がこの間隔でまとめて来るので、波形表示が粗くならない程度にしてある
    ctx = new AudioContext({ latencyHint: 0.1 })
    master = ctx.createGain()
    master.gain.value = 1
    master.connect(ctx.destination)

    // 画面復帰時やシステム側で止められた時に復帰させる
    // （システム側で止められた時のほうは、<audio> を作る background.js の unlock で登録する）
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

// 現在値から 0 まで滑らかに落として、落ち切るまで待つ。
// cancelScheduledValues の前に生の現在値を setValueAtTime で固定するのが肝で、
// これを忘れるとランプが「最後に予約された値」から始まって音が飛ぶ。
export function rampToZero(param, sec, c = getCtx()) {
  const now = c.currentTime
  param.cancelScheduledValues(now)
  param.setValueAtTime(param.value, now)
  param.linearRampToValueAtTime(0, now + sec)
  return audioWait(sec * 1000 + 50)
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
