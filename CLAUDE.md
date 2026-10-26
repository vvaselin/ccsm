# SOMNIOVOX

認知シャッフル睡眠法の単語やセリフを、VOICEVOX の声で読み上げる PWA。
アプリ本体は frontend/（Nuxt 4、Nuxt UI、@vite-pwa/nuxt、pnpm）。

## 前提
- デプロイは Cloudflare Pages（ルートディレクトリは frontend）
- 単語・セリフの音声は R2 に置き、場所は環境変数 VITE_AUDIO_BASE_URL で指定する。環境音は frontend/public/ambient/ に置く
- 音声 URL の形（speaker_{id}/〜.wav、phrases/speaker_{id}/〜.wav）、環境変数名 VITE_AUDIO_BASE_URL、話者の ID は変えない（R2 のファイルと Cloudflare の設定に合わせてある）
- パッケージの操作は pnpm だけで行う。package-lock.json を作らない（Cloudflare Pages のビルドに影響する）
- Vue のリアクティブやライフサイクルを使うものは app/composables/、使わない処理とデータは app/lib/ に置く。lib/ は自動インポートされないので import して使う
- 話者の情報（口調・キャラ画像・クレジット）は useSpeaker の SPEAKERS、環境音の情報は lib/ambient/sounds.js の AMBIENT_SOUNDS にまとめてある。ほかの場所に書き写さない
- シートは BottomSheet.vue の中に作る。差し色は main.css のトークン（--sv-accent など）を使い、値を直接書かない
- AudioContext はアプリ全体で 1 つだけ使う（lib/audio/context.js の getCtx）
- 待ち時間には setTimeout ではなく audioWait を使う（画面オフでも間引かれないため）
- localStorage からの復元は onMounted で行う（プリレンダーと食い違わないため）
- コメントは日本語で書く。= や : の桁揃え、短い処理の 1 行書きなど、今のコードの書き方に合わせる
- docs/ui-redesign.md は完了済みの指示書。今のコードと食い違うときは、コードが正しい
