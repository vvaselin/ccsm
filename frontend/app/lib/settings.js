// lib/settings.js
// 設定の永続化（localStorage）。SSR/プリレンダー時は何もしない

const KEY = 'somniovox_settings_v1'

function available() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

export function loadSettings() {
  if (!available()) return {}
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch {
    return {}
  }
}

// 部分更新。{ speakerId: 50 } や { ambient: {...} } を渡す
export function saveSettings(patch) {
  if (!available()) return
  try {
    const next = { ...loadSettings(), ...patch }
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // 容量超過やプライベートモードは無視
  }
}
