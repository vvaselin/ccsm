// lib/audio/mediaSession.js
// ロック画面・通知のコントロールと表示

export const handlers = { play: null, pause: null }

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
