<!-- components/InfoSheet.vue -->
<script setup>
import { useSheetDrag } from '~/composables/useSheetDrag'

defineProps({
  show: { type: String, default: null }, // 'about' | 'credit' | null
})

const emit = defineEmits(['close'])

// 下スワイプで閉じる（シート全体で受ける）
const { dragY, isDragging, scrollRef, handlers: dragHandlers } = useSheetDrag(() => emit('close'))

const CREDITS = [
  '九州そら',
  'ずんだもん',
  'No.7',
  '四国めたん',
  '櫻歌ミコ',
  'ナースロボ＿タイプＴ',
  'ユーレイちゃん',
  'あんこもん',
  '暁記ミタマ',
]
</script>

<template>
  <Transition name="fade">
    <div
      v-if="show"
      class="absolute inset-0 flex items-end z-50"
      style="background:rgba(10,11,13,0.55)"
      @click.self="$emit('close')"
    >
      <div
        class="w-full flex flex-col"
        v-bind="dragHandlers"
        :style="{
          background: 'var(--sv-sheet)',
          borderTop: '1px solid rgba(126,224,184,0.22)',
          borderRadius: '28px 28px 0 0',
          boxShadow: '0 -12px 40px rgba(0,0,0,0.45)',
          maxHeight: '80dvh',
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out',
          overscrollBehavior: 'contain'
        }"
      >
        <!-- ハンドル（当たり判定はこの帯全体） -->
        <div
          class="flex items-center justify-center"
          style="height:32px; flex-shrink:0; touch-action:none"
        >
          <div style="width:36px; height:4px; border-radius:999px; background:rgba(255,255,255,0.3)" />
        </div>

        <!-- スクロール領域（min-height:0 が無いと中身がシートからはみ出す） -->
        <div
          ref="scrollRef"
          style="flex:1; min-height:0; overflow-y:auto; overscroll-behavior:contain; padding:4px 24px 48px"
        >
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
                v-for="name in CREDITS"
                :key="name"
                style="color:var(--sv-text-weak); font-size:12px"
              >
                VOICEVOX:{{ name }}
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
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from,
.fade-leave-to     { opacity: 0; }

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
