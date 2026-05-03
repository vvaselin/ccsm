<!-- components/InfoSheet.vue -->
<script setup>
defineProps({
  show: { type: String, default: null }, // 'about' | 'credit' | null
})
defineEmits(['close'])
</script>

<template>
  <Transition name="fade">
    <div
      v-if="show"
      class="absolute inset-0 flex items-end z-50"
      style="background:rgba(10,12,15,0.3); backdrop-filter:blur(2px)"
      @click.self="$emit('close')"
    >
      <div
        class="w-full flex flex-col"
        style="background:#1a1f2a; border-top:1px solid rgba(126,184,201,0.12); border-radius:24px 24px 0 0; max-height:80dvh"
      >
        <!-- ハンドル -->
        <div style="padding:16px 24px 0; flex-shrink:0">
          <div
            class="rounded-full mx-auto"
            style="width:36px; height:3px; background:rgba(255,255,255,0.15); margin-bottom:16px"
          />
        </div>

        <!-- スクロール領域 -->
        <div style="overflow-y:auto; padding:0 24px 48px; flex:1">

          <!-- 認知シャッフル睡眠法について -->
          <template v-if="show === 'about'">
            <p class="text-xs tracking-widest uppercase" style="color:#6a7a90; margin-bottom:16px">
              認知シャッフル睡眠法とは
            </p>
            <p style="color:rgba(232,234,240,0.75); font-size:14px; line-height:1.8; margin-bottom:16px">
              眠れないとき、私たちの脳は「明日の会議」「さっきの出来事」など、意味のある思考を続けています。このアプリでは、互いに無関係な言葉を次々と思い浮かべることで、脳の思考を意図的に「シャッフル」し、眠りにつきやすい状態をつくります。
            </p>

            <p style="color:rgba(232,234,240,0.75); font-size:14px; line-height:1.8; margin-bottom:24px">
              読み上げられた言葉を頭の中でぼんやりイメージしながら、自然に眠りに落ちるのを待ってください。
            </p>

            <div style="height:1px; background:rgba(126,184,201,0.1); margin-bottom:24px" />

            <p class="text-xs tracking-widest uppercase" style="color:#6a7a90; margin-bottom:16px">
              使い方
            </p>

            <div style="display:flex; flex-direction:column; gap:12px">
              <div class="flex items-start" style="gap:12px">
                <span style="color:#7eb8c9; font-size:13px; flex-shrink:0; margin-top:1px">①</span>
                <p style="color:rgba(232,234,240,0.7); font-size:13px; line-height:1.7">声と環境音をお好みで設定してください</p>
              </div>
              <div class="flex items-start" style="gap:12px">
                <span style="color:#7eb8c9; font-size:13px; flex-shrink:0; margin-top:1px">②</span>
                <p style="color:rgba(232,234,240,0.7); font-size:13px; line-height:1.7">スリープタイマーをセットして、再生ボタンを押してください</p>
              </div>
              <div class="flex items-start" style="gap:12px">
                <span style="color:#7eb8c9; font-size:13px; flex-shrink:0; margin-top:1px">③</span>
                <p style="color:rgba(232,234,240,0.7); font-size:13px; line-height:1.7">読み上げられた言葉をぼんやり頭の中でイメージしながら、眠りに落ちるのを待ってください</p>
              </div>
            </div>
          </template>

          <!-- クレジット -->
          <template v-if="show === 'credit'">
            <p class="text-xs tracking-widest uppercase" style="color:#6a7a90; margin-bottom:16px">
              音声合成
            </p>

            <p style="color:rgba(232,234,240,0.75); font-size:13px; line-height:1.8; margin-bottom:8px">
              本アプリの音声は <a href="https://voicevox.hiroshiba.jp/" target="_blank" style="color:#7eb8c9">VOICEVOX</a> を使用して生成しています。
            </p>

            <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:24px">
              <p style="color:rgba(232,234,240,0.5); font-size:12px">VOICEVOX:九州そら</p>
              <p style="color:rgba(232,234,240,0.5); font-size:12px">VOICEVOX:ずんだもん</p>
              <p style="color:rgba(232,234,240,0.5); font-size:12px">VOICEVOX:No.7</p>
              <p style="color:rgba(232,234,240,0.5); font-size:12px">VOICEVOX:四国めたん</p>
              <p style="color:rgba(232,234,240,0.5); font-size:12px">VOICEVOX:櫻歌ミコ</p>
              <p style="color:rgba(232,234,240,0.5); font-size:12px">VOICEVOX:ナースロボ＿タイプＴ</p>
              <p style="color:rgba(232,234,240,0.5); font-size:12px">VOICEVOX:ユーレイちゃん</p>
              <p style="color:rgba(232,234,240,0.5); font-size:12px">VOICEVOX:あんこもん</p>
              <p style="color:rgba(232,234,240,0.5); font-size:12px">VOICEVOX:暁記ミタマ</p>
            </div>

            <div style="height:1px; background:rgba(126,184,201,0.1); margin-bottom:24px" />

            <p class="text-xs tracking-widest uppercase" style="color:#6a7a90; margin-bottom:16px">
              ライセンス
            </p>

            <p style="color:rgba(232,234,240,0.75); font-size:13px; line-height:1.8; margin-bottom:8px">
              各キャラクターの音声は、それぞれのキャラクターのライセンスに従って使用しています。
            </p>

            <a
              href="https://voicevox.hiroshiba.jp/term/"
              target="_blank"
              style="color:#7eb8c9; font-size:13px"
            >
              VOICEVOX 利用規約 →
            </a>
          </template>

        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from,
.fade-leave-to     { opacity: 0; }
</style>