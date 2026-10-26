// lib/audio/background.js
// バックグラウンド再生のための配管
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
//   - setPlaying(b) : <audio> 要素の再生/停止と MediaSession の状態を切り替える

import { getCtx }   from '~/lib/audio/context'
import { handlers } from '~/lib/audio/mediaSession'

const KEEPALIVE_SRC = '/keepalive.mp3'

let audioEl = null
let unlocked = false
let internalPause = false      // 自分で pause() したときに true

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

  // システム側で止められた時に復帰させる（<audio> が鳴っている間だけ。元は getCtx の中で登録していた）
  c.addEventListener('statechange', () => {
    if (c.state === 'suspended' && audioEl && !audioEl.paused) c.resume()
  })

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
