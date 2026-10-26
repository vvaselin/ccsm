// composables/useSpeaker.js
// スピーカー選択の管理（選択は localStorage に保存）

import { ref, onMounted } from 'vue'
import { loadSettings, saveSettings } from '~/lib/settings'

// 話者の一覧。並び順は設定シートのタイルとクレジットの順
//   style       … 設定シートに出す声のスタイル名
//   phraseStyle … セリフの口調（phrases.pyのSPEAKER_STYLEと同期）
//   image       … 背景に出すキャラ画像（ある話者だけ）
export const SPEAKERS = [
  { id: 19,  name: '九州そら',             style: 'ささやき',   phraseStyle: 'formal' },
  { id: 22,  name: 'ずんだもん',           style: 'ささやき',   phraseStyle: 'noda' },
  { id: 31,  name: 'No.7',                 style: '読み聞かせ', phraseStyle: 'default' },
  { id: 36,  name: '四国めたん',           style: 'ささやき',   phraseStyle: 'ojosama' },
  { id: 45,  name: '櫻歌ミコ',             style: 'ロリ',       phraseStyle: 'loli' },
  { id: 50,  name: 'ナースロボ＿タイプＴ', style: '内緒話',     phraseStyle: 'default', image: '/characters/nurse_robo.webp' },
  { id: 105, name: 'ユーレイちゃん',       style: 'ささやき',   phraseStyle: 'loli' },
  { id: 117, name: 'あんこもん',           style: 'ささやき',   phraseStyle: 'mon' },
  { id: 125, name: '暁記ミタマ',           style: 'ささやき',   phraseStyle: 'formal' },
]

const DEFAULT_SPEAKER_ID = 50

export function useSpeaker() {
  const selectedSpeaker = ref(
    SPEAKERS.find(s => s.id === DEFAULT_SPEAKER_ID)
  )

  // プリレンダーと食い違わないよう、復元はマウント後に行う
  onMounted(() => {
    const saved = SPEAKERS.find(s => s.id === loadSettings().speakerId)
    if (saved) selectedSpeaker.value = saved
  })

  function selectSpeaker(speaker) {
    selectedSpeaker.value = speaker
    saveSettings({ speakerId: speaker.id })
  }

  return {
    selectedSpeaker,
    selectSpeaker,
  }
}
