# SOMNIOVOX

認知シャッフル睡眠法の単語やセリフを、VOICEVOX の声で読み上げる PWA。
アプリ本体は frontend/（Nuxt 4、Nuxt UI、@vite-pwa/nuxt、pnpm）。

## 前提
- デプロイは Cloudflare Pages（ルートディレクトリは frontend）
- 単語・セリフの音声は R2 に置き、場所は環境変数 VITE_AUDIO_BASE_URL で指定する。環境音は frontend/public/ambient/ に置く
- パッケージの操作は pnpm だけで行う。package-lock.json を作らない（Cloudflare Pages のビルドに影響する）
- AudioContext はアプリ全体で 1 つだけ使う（useAudioEngine の getCtx）
- 待ち時間には setTimeout ではなく audioWait を使う（画面オフでも間引かれないため）
- localStorage からの復元は onMounted で行う（プリレンダーと食い違わないため）
- コメントは日本語で書く。= や : の桁揃え、短い処理の 1 行書きなど、今のコードの書き方に合わせる
- docs/ui-redesign.md は完了済みの指示書。今のコードと食い違うときは、コードが正しい

## 整理中のルール（整理が終わったら消す）
- 作業は frontend/ の中だけで行う。ルートの Python 側は触らない
- 動作と見た目を変えない。不具合を見つけたら、直さずに報告する
- 新しいパッケージは入れない
- 音声処理（useAudioEngine / useAudioPlayer / useAmbientSound）は、ファイルの移動と分割だけにする。数値・ノードをつなぐ順番・待ち方は変えない
- 音声 URL の形（speaker_{id}/〜.wav、phrases/speaker_{id}/〜.wav）、環境変数名 VITE_AUDIO_BASE_URL、話者の ID は変えない（R2 のファイルと Cloudflare の設定に合わせてある）
- nuxt.config.ts のビルドと PWA の設定は、指示したところ以外は触らない
- コメントは消さずに、コードと一緒に移す
- 1 ステップ終わるごとに pnpm lint と pnpm build を通し、そこで止まる