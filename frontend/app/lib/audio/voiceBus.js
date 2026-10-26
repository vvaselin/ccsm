// lib/audio/voiceBus.js
// 声（単語・セリフ・朗読）の出口。距離感のフィルタと残響、波形用の Analyser
//
// 使い方:
//   - getVoiceBus() : 声の出力先 { input, analyser, setDistance(d) }。声は master ではなくここへ
//   - setVoiceDistance(d) / getVoicePanWidth() : 声の距離の切り替えと、単語を左右に振る幅

import { getCtx, getMaster } from '~/lib/audio/context'

// ---- 声のバス ----
//
//   source → panner → input ─┬─ lowshelf ─ lowpass ─┬───────────────────→ output → master
//                            │                      └─ convolver ─ wetGain ┘
//                            └─ analyser（波形用。出力はどこにも繋がない）
//
// ConvolverNode は入力が無音の間だけ Chrome が処理を省く。つまり単語が鳴り始めた
// 瞬間だけ音声スレッドの負荷が跳ね上がり、環境音がプツプツ途切れる原因になる
// （実測：声のバス全体で 20ms/20秒 → 残響を足すと 160ms/20秒）。
// しかも耳元は wet=0 で残響が一切聞こえないのに、コストだけは満額かかっていた。
// そこで wet>0 の距離に切り替わったときだけ convolver を繋ぐようにしてある。
//
// 声の距離ごとの値。音量（ゲイン）は変えず、こもり具合・左右の振り幅・残響・低音で距離感を出す。
//
// lowpass はもともと「耳元ほどこもる」向きだったが、それだと耳元が壁越しのように
// 遠く聴こえていた。ささやき声の近さは息やサ行の高い成分が作るので、
// 近いほど開き、遠いほどこもる向きに直してある。
// bass は近接効果（口元に近いほど低音が持ち上がる）を真似た低域シェルフの dB。
const VOICE_DISTANCE_PARAMS = {
  ear:  { lowpass: 16000, pan: 1.0,  wet: 0,    bass: 4 },   // 真横・こもらせない・低音を足す
  near: { lowpass: 11000, pan: 0.55, wet: 0.12, bass: 1.5 },
  far:  { lowpass: 7000,  pan: 0.25, wet: 0.3,  bass: 0 },
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

  // 近接効果ぶんの低域シェルフ
  const lowshelf = c.createBiquadFilter()
  lowshelf.type            = 'lowshelf'
  lowshelf.frequency.value = 220
  lowshelf.gain.value      = p.bass

  const lowpass = c.createBiquadFilter()
  lowpass.type            = 'lowpass'
  lowpass.frequency.value = p.lowpass

  const wetGain = c.createGain()
  wetGain.gain.value = p.wet

  const output = c.createGain()

  const analyser = c.createAnalyser()
  analyser.fftSize               = 512
  analyser.smoothingTimeConstant = 0.7

  input.connect(lowshelf)
  lowshelf.connect(lowpass)
  lowpass.connect(output)
  wetGain.connect(output)
  output.connect(getMaster())
  input.connect(analyser)

  // 残響は使う距離に切り替わってから作る。IR の生成もここまで遅らせられる
  let convolver = null
  let detachId  = 0

  function attachConvolver() {
    if (!convolver) {
      convolver = c.createConvolver()
      convolver.buffer = makeImpulseResponse(c)
      convolver.connect(wetGain)
    }
    lowpass.connect(convolver)   // 繋がっている相手への connect は仕様上 no-op
  }

  // 入力を切るだけ。残った尾は鳴り切ってから勝手に止まる。
  // 繋がっていない相手への disconnect は例外になるので握りつぶす
  function detachConvolver() {
    if (convolver) { try { lowpass.disconnect(convolver) } catch {} }
  }

  function setDistance(d) {
    const q = VOICE_DISTANCE_PARAMS[d]
    if (!q) return
    voiceDistance = d
    // setTargetAtTime は時定数の約 3 倍でほぼ目標に届く
    const now = c.currentTime
    const tc  = DISTANCE_RAMP_SEC / 3
    lowpass.frequency.setTargetAtTime(q.lowpass, now, tc)
    lowshelf.gain.setTargetAtTime(q.bass, now, tc)
    wetGain.gain.setTargetAtTime(q.wet, now, tc)

    clearTimeout(detachId)
    if (q.wet > 0) {
      attachConvolver()
    } else {
      // wet が 0 に落ちきってから切り離す（切り替えの瞬間に残響が途切れないように）
      detachId = setTimeout(detachConvolver, DISTANCE_RAMP_SEC * 1000 + 100)
    }
  }

  if (p.wet > 0) attachConvolver()

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
