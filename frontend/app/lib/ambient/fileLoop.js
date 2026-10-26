// lib/ambient/fileLoop.js
// ファイル音源（public/ambient/）の読み込みと、クロスフェードでのループ再生

import { rampToZero }    from '~/lib/audio/context'
import { scheduleAhead } from '~/lib/ambient/schedule'

// ファイル音源の継ぎ目処理
const LOOP_XFADE_SEC = 1.0    // 継ぎ目で前後を重ねる長さ（下の startBufferLoop を参照）
const FILE_FADE_SEC  = 0.6    // 開始・停止・切り替え時のフェード
const LOOP_AHEAD_SEC = 120    // 何秒先まで予約しておくか（schedule.js の scheduleAhead を参照）

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
  // scheduleAhead（schedule.js）が一歩も進まず無限ループになるので、ここで弾いておく
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

export function loadBuffer(ctx, src) {
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
export function startBufferLoop(ctx, gain, buffer, region, level) {
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
    return rampToZero(lv.gain, FILE_FADE_SEC, ctx).then(() => {
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
