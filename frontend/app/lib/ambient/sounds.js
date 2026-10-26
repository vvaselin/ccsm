// lib/ambient/sounds.js
// 環境音の一覧。Vue に依存しないデータなので、nuxt.config.ts（アイコン一覧）からも読める
//   kind: 'synth' … Web Audio で合成（ノイズ、宇宙）
//   kind: 'file'  … public/ambient/ の音源を AudioBuffer にしてループ再生

// ピンクノイズに合わせた音量上限（小さめ）
export const MAX_VOLUME = 0.5

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
