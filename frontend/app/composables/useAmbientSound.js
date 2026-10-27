// composables/useAmbientSound.js
// 環境音（複数同時再生・個別音量管理）
//   kind: 'synth' … Web Audio で合成（ノイズ、宇宙）
//   kind: 'file'  … public/ambient/ の音源を AudioBuffer にしてループ再生

import { reactive, onMounted } from 'vue'
import { getCtx as getEngineCtx, getMaster, audioWait, rampToZero } from '~/lib/audio/context'
import { loadSettings, saveSettings } from '~/lib/settings'
import { AMBIENT_SOUNDS, MAX_VOLUME }        from '~/lib/ambient/sounds'
import { loadBuffer, startBufferLoop }       from '~/lib/ambient/fileLoop'
import { startPink, startBrown, startSpace } from '~/lib/ambient/synth'

const SOUND_BY_ID = Object.fromEntries(AMBIENT_SOUNDS.map(s => [s.id, s]))
const maxOf       = id => SOUND_BY_ID[id].maxVolume ?? MAX_VOLUME

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

  // サウンドごとのノード（AudioContext は lib/audio/context で共有）
  const nodes = {}  // { [id]: { gainNode, stopFn } }

  function getCtx() {
    const ctx = getEngineCtx()
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  }

  // ---- 内部：1つのサウンドを起動・停止 ----

  function _startOne(id) {
    if (nodes[id]) return
    const sound = SOUND_BY_ID[id]
    const ctx   = getCtx()
    const gain  = ctx.createGain()
    gain.gain.value = Math.min(states[id].volume, maxOf(id))
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
          gain.disconnect()   // master につながったまま残さない
          if (nodes[id] === entry) nodes[id] = null
        })
      return
    }

    const starters = { pink: startPink, brown: startBrown, space: startSpace }
    entry.stopFn = starters[id]?.(ctx, gain)
  }

  function _stopOne(id) {
    const n = nodes[id]
    if (!n) return
    nodes[id] = null
    // フェードが終わってから外す（読み込み中に止めたときは stopFn が無いので、すぐ外れる）
    Promise.resolve(n.stopFn?.()).then(() => n.gainNode.disconnect())
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
    const clamped = Math.min(v, maxOf(id))
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
