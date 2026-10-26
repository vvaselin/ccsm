<!-- components/InfoSheet.vue -->
<script setup>
import { SPEAKERS } from '~/composables/useSpeaker'

defineProps({
  show: { type: String, default: null }, // 'about' | 'credit' | null
})

defineEmits(['close'])
</script>

<template>
  <BottomSheet
    :show="!!show"
    max-height="80dvh"
    @close="$emit('close')"
  >
    <div style="padding:4px 24px 48px">
      <!-- 認知シャッフル睡眠法について -->
      <template v-if="show === 'about'">
        <h2
          class="section-title"
          style="margin-bottom:16px"
        >
          認知シャッフル睡眠法とは
        </h2>
        <p
          class="body-text"
          style="margin-bottom:16px"
        >
          眠れないとき、私たちの脳は「明日の会議」「さっきの出来事」など、意味のある思考を続けています。このアプリでは、互いに無関係な言葉を次々と思い浮かべることで、脳の思考を意図的に「シャッフル」し、眠りにつきやすい状態をつくります。
        </p>

        <p
          class="body-text"
          style="margin-bottom:24px"
        >
          読み上げられた言葉を頭の中でぼんやりイメージしながら、自然に眠りに落ちるのを待ってください。
        </p>

        <div class="divider" />

        <h2
          class="section-title"
          style="margin-bottom:16px"
        >
          使い方
        </h2>

        <div style="display:flex; flex-direction:column; gap:12px">
          <div
            class="flex items-start"
            style="gap:12px"
          >
            <span class="step-number">①</span>
            <p
              class="body-text"
              style="font-size:13px"
            >声と環境音をお好みで設定してください</p>
          </div>
          <div
            class="flex items-start"
            style="gap:12px"
          >
            <span class="step-number">②</span>
            <p
              class="body-text"
              style="font-size:13px"
            >スリープタイマーをセットして、再生ボタンを押してください</p>
          </div>
          <div
            class="flex items-start"
            style="gap:12px"
          >
            <span class="step-number">③</span>
            <p
              class="body-text"
              style="font-size:13px"
            >読み上げられた言葉をぼんやり頭の中でイメージしながら、眠りに落ちるのを待ってください</p>
          </div>
        </div>
      </template>

      <!-- クレジット -->
      <template v-if="show === 'credit'">
        <h2
          class="section-title"
          style="margin-bottom:16px"
        >
          音声合成
        </h2>

        <p
          class="body-text"
          style="font-size:13px; margin-bottom:8px"
        >
          本アプリの音声は <a
            href="https://voicevox.hiroshiba.jp/"
            target="_blank"
            class="link"
          >VOICEVOX</a> を使用して生成しています。
        </p>

        <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:24px">
          <p
            v-for="speaker in SPEAKERS"
            :key="speaker.id"
            style="color:var(--sv-text-weak); font-size:12px"
          >
            VOICEVOX:{{ speaker.name }}
          </p>
        </div>

        <div class="divider" />

        <h2
          class="section-title"
          style="margin-bottom:16px"
        >
          ライセンス
        </h2>

        <p
          class="body-text"
          style="font-size:13px; margin-bottom:8px"
        >
          各キャラクターの音声は、それぞれのキャラクターのライセンスに従って使用しています。
        </p>

        <a
          href="https://voicevox.hiroshiba.jp/term/"
          target="_blank"
          class="link"
          style="font-size:13px"
        >
          VOICEVOX 利用規約 →
        </a>
      </template>
    </div>
  </BottomSheet>
</template>

<style scoped>
.section-title {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.2em;
  color: var(--sv-text-weak);
}

.body-text {
  color: var(--sv-text-sub);
  font-size: 14px;
  line-height: 1.8;
}

.step-number {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--sv-text-weak);
  font-size: 13px;
}

.divider {
  height: 1px;
  margin-bottom: 24px;
  background: var(--sv-surface);
}

.link {
  color: var(--sv-text-strong);
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
