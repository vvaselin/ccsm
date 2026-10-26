# SOMNIOVOX（フロントエンド）

認知シャッフル睡眠法の単語やセリフを、VOICEVOX の声で読み上げる PWA。
Nuxt 4・Nuxt UI・@vite-pwa/nuxt で作り、Cloudflare Pages に置いている（ルートディレクトリは `frontend`）。

- **シャッフル**：無関係な単語を 8〜13 秒の間をあけて読み上げ、ときどき声をかけるセリフを挟む
- **おはなし**：朗読モード（土台だけで、まだ再生の中身は無い）
- 環境音（雨・焚き火・川・ピンクノイズ・ブラウンノイズ・宇宙）を重ねて鳴らせる
- スリープタイマー、声の距離（耳元・そば・すこし離れて）、ロック画面・通知のコントロール、画面オフでの再生

## 動かす

パッケージの操作は pnpm だけで行う（`package-lock.json` を作ると Cloudflare Pages のビルドに影響する）。

```bash
pnpm install
```

`.env` に、単語・セリフの音声を置いた場所（R2 の公開 URL）を書く。

```
VITE_AUDIO_BASE_URL=https://<R2の公開URL>
```

```bash
pnpm dev
```

```bash
pnpm lint
```

```bash
pnpm build
```

## 音声ファイル

単語・セリフの音声は R2 に置き、`VITE_AUDIO_BASE_URL` の下を次の形で読む。R2 のファイルに合わせてあるので、この形と話者の ID は変えない。

- 単語：`speaker_{話者ID}/{単語}.wav`
- セリフ：`phrases/speaker_{話者ID}/{セリフ}.wav`

単語の一覧は `public/vocab.json`、セリフは `public/phrases.json`。環境音は `public/ambient/` に置く。

## 構成

```
app/
  app.vue                 画面（ヘッダー・単語・操作・シート）
  components/
    BottomSheet.vue       シートの共通の外枠（暗幕・ハンドル・下スワイプで閉じる）
    SettingsSheet.vue     声・声の距離・環境音
    SleepTimerSheet.vue   スリープタイマー
    InfoSheet.vue         使い方・クレジット
    PlayerControls.vue, ProgressBar.vue, VoiceWaveform.vue, DustLayer.vue
  composables/            Vue のリアクティブやライフサイクルを使うもの（自動インポートされる）
    usePlayback.js        再生の制御（モードの切り替え、環境音・バックグラウンド再生・MediaSession の開始と停止）
    useWordLoop.js        シャッフル：単語とセリフの読み上げループ
    useStoryLoop.js       おはなし（土台）
    useAudioPlayer.js     単語・セリフ音声の再生と進捗
    useAmbientSound.js    環境音の ON/OFF・音量・保存
    useSpeaker.js         話者の一覧（SPEAKERS）と選択
    useMode.js, useVoiceDistance.js, useSleepTimer.js, useSheetDrag.js, useWordPicker.js
  lib/                    Vue に依存しない処理とデータ（自動インポートされないので import して使う）
    audio/
      context.js          AudioContext（アプリで 1 つ）・master・audioWait
      voiceBus.js         声のバス（距離感・残響・波形用の Analyser）
      background.js       keepalive の <audio> による画面オフでの再生
      mediaSession.js     ロック画面・通知のコントロール
    ambient/
      sounds.js           環境音の一覧（nuxt.config.ts のアイコン一覧もここから作る）
      fileLoop.js         ファイル音源のクロスフェードでのループ
      synth.js            ノイズと宇宙の合成
      schedule.js         音声クロックでの先読み予約
    settings.js           設定の保存（localStorage）
  assets/css/main.css     デザイントークン（--sv-*）と共通クラス
public/                   環境音・キャラ画像・アイコン・keepalive.mp3・vocab.json・phrases.json
docs/                     UI の指示書（完了済み）とモック
```

## クレジット

音声は [VOICEVOX](https://voicevox.hiroshiba.jp/) で生成している。各キャラクターの音声は、それぞれのキャラクターのライセンスに従って使う。
