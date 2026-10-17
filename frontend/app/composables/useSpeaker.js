// composables/useSpeaker.js
// スピーカー選択の管理（選択は localStorage に保存）

import { ref, onMounted } from 'vue'
import { loadSettings, saveSettings } from '~/composables/useSettings'

export const SPEAKERS = [
  { id: 19,  name: '九州そら',   style: 'ささやき' },
  { id: 22,  name: 'ずんだもん', style: 'ささやき' },
  { id: 31,  name: 'No.7',       style: '読み聞かせ' },
  { id: 36,  name: '四国めたん', style: 'ささやき' },
  { id: 45,  name: '櫻歌ミコ',   style: 'ロリ' },
  { id: 50,  name: 'ナースロボ', style: '内緒話' },
  { id: 105, name: 'ユーレイ',   style: 'ささやき' },
  { id: 117, name: 'あんこもん', style: 'ささやき' },
  { id: 125, name: '暁記ミタマ', style: 'ささやき' },
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
