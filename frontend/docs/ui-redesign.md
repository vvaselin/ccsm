完了済み
# SOMNIOVOX UI 再設計 — 実装指示

対象は `frontend/`（Nuxt 4）。見た目の正解は `docs/ui-mock/` の 4 つの HTML（390×844 の静的モック）。寸法・色・余白はモックの inline style をそのまま正とする。迷ったらモックを開いて比べること。

| モック | 内容 |
|---|---|
| `home-shuffle.html` | ホーム（シャッフルモード・再生中・タイマー動作中） |
| `home-story.html` | ホーム（おはなしモード・再生中） |
| `settings-sheet.html` | 設定シート |
| `tokens.html` | 色・文字・部品寸法の一覧 |

## 前提（配置済みのファイル）

- `public/characters/nurse_robo.webp` — ナースロボの腰から上を切り出し・縮小したもの（862×1483、約 180 KB）
- `public/ambient/fire.mp3` — 焚き火（ループ素材、−23 LUFS、モノラル）
- `public/ambient/river.mp3` — 川のせせらぎ（同上）
- `app/components/DustLayer.vue` — 光の粒のパーティクル（完成品。中身は変えない）

## 作業の順番

1. デザイントークンとフォント
2. ホーム画面のレイヤー構成（背景・キャラ・パーティクル・スクリム）
3. ホーム画面の UI（ヘッダー・モード切替・単語/波形・操作）
4. 設定シート（声・声の距離・環境音）
5. 音声側：声の距離、環境音の追加、波形用の Analyser
6. おはなしモードの土台
7. 後片付け

各段階でビルドが通る状態にしてコミットを分けること。

---

## 1. デザイントークンとフォント

`app/assets/css/main.css` に CSS 変数として定義し、コンポーネントからはこれを使う。旧配色（紺 `#0d0f18`、青 `#7eb8c9`、紫 `#2d1b4e` など）は全て置き換える。

```css
:root {
  --sv-ground-1: #3a3e45;   /* 背景グラデーション中心 */
  --sv-ground-2: #24272c;
  --sv-ground-3: #17191c;
  --sv-sheet:    #24272c;   /* シート面 */
  --sv-accent:   #7ee0b8;   /* 差し色。使う場所を限定する（下記） */
  --sv-text-strong: #ffffff;
  --sv-text:        #f2f3f5;
  --sv-text-sub:    #d7dadf;
  --sv-text-weak:   #a9aeb6;
  --sv-on-image:    #e3e5e9;  /* イラスト上の補助文字 */
  --sv-surface:      rgba(255,255,255,0.10);  /* 非選択の面 */
  --sv-surface-line: rgba(255,255,255,0.16);
  --sv-accent-surface: rgba(126,224,184,0.22);
  --sv-accent-line:    rgba(126,224,184,0.75);
  --sv-float-bg:     rgba(24,26,30,0.62);     /* イラスト上のボタン面 */
  --sv-float-shadow: 0 6px 18px rgba(0,0,0,0.45);
  --sv-text-shadow:  0 1px 2px rgba(0,0,0,0.7), 0 2px 14px rgba(0,0,0,0.6);
}
```

差し色 `--sv-accent` を使うのは次だけ：再生ボタンの輪郭、選択中のセグメント・タイル・話者・距離・チップ、進捗バーの進んだ部分、動作中のタイマーボタンと残り時間、波形の中央部分。それ以外は無彩色。

フォント：本文は Zen Kaku Gothic New（400/500）、単語・セリフは Shippori Mincho（400）。Google Fonts を `nuxt.config.ts` の `app.head.link` で読み込み、`workbox.runtimeCaching` に `fonts.googleapis.com`（StaleWhileRevalidate）と `fonts.gstatic.com`（CacheFirst、1 年）を追加してオフラインでも表示されるようにする。

## 2. ホーム画面のレイヤー構成

`app.vue` のメインコンテナ（`max-width:390px` の `relative` な要素）の中を、下から次の順に重ねる。

1. **背景**：`radial-gradient(120% 70% at 50% 45%, var(--sv-ground-1) 0%, var(--sv-ground-2) 55%, var(--sv-ground-3) 100%)`。旧 `.bg-animated-layer`（紫・青の波アニメーション）は削除
2. **キャラクター**：`/characters/nurse_robo.webp`。表示条件は今と同じ（`selectedSpeaker.id === 50` のとき、フェード付き）。配置はコンテナ幅を基準に決める：
   - `position:absolute; width:110.5%; left:-4.9%; top:116px; height:auto; max-width:none`
   - `object-fit` は使わない。目の位置が端末で変わらないようにするため。縦に長い端末では下に余白が増えるだけでよい
   - 旧キャラ上の全面グラデーション（`rgba(13,15,24,…)`）は削除
3. **パーティクル**：`<DustLayer />`。キャラの直後に置く（キャラの前面、スクリムと UI の後ろ）。props はデフォルトのまま
4. **スクリム**（文字と操作の下だけ暗くする。顔の部分は暗くしない）
   - 上：`top:0; height:230px; linear-gradient(rgba(14,15,17,0.72), rgba(14,15,17,0))`
   - 下：`bottom:0; height:240px; linear-gradient(rgba(14,15,17,0), rgba(14,15,17,0.78))`
5. **UI**（3 章）
6. **シート類**

DustLayer は `visibilitychange` で自分で止まる。設定シート表示中も動いていてよい。

## 3. ホーム画面の UI

レイアウトは flex の縦積みをやめ、モックと同じく絶対配置で上・下に固定する（中央はキャラのために空ける）。

**ヘッダー**（高さ 56px）
- 左：`SOMNIOVOX` 12px / 500 / 字間 0.22em ＋ `v0.9` 11px。「（仮）」は外す
- 右：44×44 のアイコンボタン 2 つ。`i-lucide-circle-help` → `showInfoSheet = 'about'`、`i-lucide-info` → `'credit'`。`aria-label` は「使い方」「クレジット」
- 文字・アイコンとも `--sv-on-image` ＋ 影

**モード切替**（top 64px、中央）
- セグメント 2 つ：「シャッフル」「おはなし」。外枠は `--sv-float-bg` ＋ `backdrop-filter: blur(10px)` ＋ `--sv-float-shadow`、角丸 999、内側 32px 高
- 選択中は `--sv-accent-surface` 面＋ `--sv-accent` 文字、非選択は `--sv-on-image`
- `aria-pressed` を付ける
- 状態は `mode: 'shuffle' | 'story'` として `useSettings` に保存
- **再生中に切り替えたら、いったん停止してから切り替える**

**シャッフルモードの表示**（top 118px、中央）
- 上の行：`phaseLabel`。`pause` のときの文言を「思い浮かべて...」から「**イメージして…**」に変更（`useWordLoop.js`）。12px / 字間 0.18em / `--sv-on-image` ＋ 影
- 単語：Shippori Mincho 52px / 行高 1.1 / 字間 0.14em / 白 / `--sv-text-shadow`
- セリフ（`phase === 'phrase'`）：同じ位置に Shippori Mincho 21px / 行高 1.75 / 字間 0.06em。このとき上の行は空にする（今と同じ）
- 既存のフェードのトランジションは残す

**おはなしモードの表示**（top 122px、高さ 64px）
- セリフも話者名も出さない。代わりに `VoiceWaveform.vue`（新規）を置く
- 44 本の縦棒、幅 3px、間隔 3px、角丸 2px。中央 16 本は `--sv-accent`、他は白 85%。全体に `drop-shadow(0 2px 10px rgba(0,0,0,0.5))`
- 棒の高さは 5 章の Analyser から取る（周波数ビンを 44 本に間引き、左右対称に並べる）。停止中は全て 4px の平らな線
- 30fps に間引き、タブ非表示で止める。`prefers-reduced-motion` のときは高さを固定

**進捗バー**（top 684px、左右 32px）
- 高さ 2px、地は白 28%、進んだ部分は `--sv-accent`、影 `0 1px 3px rgba(0,0,0,0.5)`
- シャッフルでは今と同じ単語ごとの進捗。おはなしでは朗読全体の進み具合（6 章）

**操作**（bottom 40px、中央揃え、間隔 32px）
- 左：設定 60×60、アイコン `i-lucide-sliders-horizontal` 26px
- 中央：再生/停止 88×88、輪郭 2px `--sv-accent`、面 `rgba(24,26,30,0.7)` ＋ blur ＋ 影 `0 8px 24px rgba(0,0,0,0.5)`。中のアイコンは塗りの SVG で、再生の三角 38px、停止の角丸四角 34px（モックの SVG をそのまま使う）
- 右：タイマー 60×60、アイコン `i-lucide-timer` 26px。動作中は輪郭と色が `--sv-accent` になり、ボタンの下に残り時間（11px、等幅数字）
- 左右は `--sv-float-bg` ＋ blur ＋ `--sv-float-shadow`、線は白 28%
- **ボタンの下の日本語ラベルは付けない**。`aria-label` だけ付ける
- `PlayerControls.vue` と `ProgressBar.vue` をこの仕様で作り直す

## 4. 設定シート

`SettingsSheet.vue` を `settings-sheet.html` に合わせて作り直す。シート面 `--sv-sheet`、上辺に `box-shadow: 0 -12px 40px rgba(0,0,0,0.45)`、角丸 28。背面の暗転は `rgba(10,11,13,0.55)`。

**シートの高さとスクロール**

- シートの高さは `max-height: 72dvh` のまま。環境音を多く ON にして中身が増えても、シートは伸びず中身がスクロールする
- スクロール領域に **`min-height:0`** を足す（今の `overflow-y:auto; overscroll-behavior:contain; flex:1` に加えて）。縦 flex の子は既定で中身より小さくならないため、これが無いと中身がシートからはみ出してスクロールしない
- スワイプで閉じる動作は既存の `useSheetDrag` のまま変えない

セクション見出しは 11px / 500 / 字間 0.2em / `--sv-text-weak`。セクション間 28px。

**声**
- 3 列グリッド、ボタンは `min-height: 48px`（高さ固定にしない）、余白 7px 10px、名前 12px ＋ スタイル名 10px
- `useSpeaker.js` の名前を正式名称に変更：`50` を「**ナースロボ＿タイプＴ**」、`105` を「**ユーレイちゃん**」
- 長い名前は 2 行に折り返す。ボタンに `word-break: keep-all` を付け、表示時に `name.replace('＿', '＿\u200B')` で「＿」の後ろにだけ折り返し位置を作る（「ナースロボ＿ / タイプＴ」になる）。同じ行のボタンはグリッドの既定どおり高さが揃う

**声の距離**（新規）
- 3 択：「耳元」「そば」「すこし離れて」。高さ 68px のタイル、アイコン＋ラベル。アイコンはモックの SVG（耳と弧の数）をそのまま使う
- 説明文は付けない
- 状態は `voiceDistance: 'ear' | 'near' | 'far'`（初期値 `'ear'`）として保存。中身は 5 章

**環境音**
- 3 列×2 段のタイル（高さ 64px）。並び順：雨、焚き火、川、ピンク、ブラウン、バイノーラル
- アイコン（lucide）：`cloud-rain` / `flame` / `waves` / `audio-waveform` / `activity` / `headphones`。ラベルは「雨」「焚き火」「川」「ピンク」「ブラウン」「バイノーラル」
- タップで ON/OFF。ON のタイルは `--sv-accent` の面と線になり、**下辺の 2px の線の長さで音量を示す**（`width: volume / MAX_VOLUME * 100%`）
- タイルの下に、**ON の音だけ**細いスライダーを並べる（ラベル 56px 幅＋スライダー）。雨はその行の右端に「静か / 普通 / 強い」のチップ（高さ 28px、角丸 8）
- 旧来の縦リスト（ボタン 116px＋スライダー）は削除

## 5. 音声側

### 5-1. 声のバスと声の距離（`useAudioEngine.js` / `useAudioPlayer.js`）

声（単語・セリフ）を環境音と分けたバスに通す。

```
source → panner → voiceIn ─┬─ lowpass ─┬─────────────→ voiceOut → master
                           │           └─ convolver ─ wetGain ┘
                           └─ analyser（波形用、出力はどこにも繋がない）
```

- `useAudioEngine.js` に `getVoiceBus()` を追加し、`{ input, analyser, setDistance(d) }` を返す。初回呼び出し時に作る
- 残響のインパルス応答はファイルを使わず、コードで生成する（ステレオ、長さ 1.6 秒、白色ノイズに指数減衰 `exp(-t * 3.5)`）
- `setDistance` は値を 0.4 秒かけて滑らかに変える（`setTargetAtTime`）
- 距離ごとの値。**音量（ゲイン）は変えない**：

| 距離 | lowpass | パンの振り幅 | wetGain |
|---|---|---|---|
| 耳元 `ear` | 3500 Hz | ±0.8 | 0 |
| そば `near` | 8000 Hz | ±0.5 | 0.12 |
| すこし離れて `far` | 18000 Hz | ±0.2 | 0.3 |

- `useAudioPlayer.js` の `PAN_STRENGTH` 固定値をやめ、距離に応じた振り幅を使う。出力先を `getMaster()` から `getVoiceBus().input` に変える
- セリフ（`playPhrase`）は今と同じく中央（パン 0）

### 5-2. 環境音の追加（`useAmbientSound.js`）

- `AMBIENT_SOUNDS` に追加：
  ```js
  { id: 'fire',  label: '焚き火', icon: 'i-lucide-flame', kind: 'file', level: 0.18, src: '/ambient/fire.mp3' },
  { id: 'river', label: '川',     icon: 'i-lucide-waves', kind: 'file', level: 0.18, src: '/ambient/river.mp3' },
  ```
- 並び順は 4 章のタイル順に合わせる。既存の項目の `icon` も lucide のクラス名に置き換える（`'~'` などは廃止）
- `_startOne` は今 `sound.variants` 前提なので、`variants` が無いときは `sound.src` と `gain: 1` を使うようにする
- `LOOP_TRIM_SEC` は `0` にする（ループ素材の継ぎ目に穴を開けないため。mp3 の先頭・末尾の無音はデコーダーが除去する）
- `level` の値は耳で合わせる前提の仮値

### 5-3. PWA

- `nuxt.config.ts` の `globPatterns` に `'characters/*.webp'` を追加
- `runtimeCaching` のキャラ画像のパターン `/\/(TT|.*character.*)\.png$/` は webp に当たっていないので削除（プリキャッシュに移るため不要）

## 6. おはなしモードの土台

再生の中身（長尺セリフ・朗読のデータ形式と再生ループ）は**今回は作らない**。今回は切り替えて表示が変わるところまで。

- `useStoryLoop.js` を新規に作り、`useWordLoop` と同じ形の公開 API（`isPlaying`, `progress`, `start()`, `stop()`）を持つスタブにする。中身は `// TODO: 朗読の再生` とし、`start()` は何もしない
- `app.vue` の `toggle` / `start` / `stop` は `mode` によって `useWordLoop` と `useStoryLoop` を呼び分ける。環境音・タイマー・MediaSession・バックグラウンド再生の仕組みは両モード共通
- おはなしモードで再生ボタンを押したときは、スタブが何もしないので再生状態にならなくてよい
- 波形は 5-1 の Analyser に繋いであるので、将来朗読の音声を `getVoiceBus().input` に流せばそのまま動く

## 7. 後片付け

- `public/TT.webp`（4 MB）を削除し、参照を `/characters/nurse_robo.webp` に置き換える
- 使わなくなったコンポーネント・CSS を削除：`.bg-animated-layer` と `@keyframes wave`、`AppLogo.vue`、`TemplateMenu.vue`（使われていなければ）
- `app/pages/index.vue` に残っている Nuxt UI スターターの内容を削除
- `useWordLoop.js` のコメントで GCS になっている箇所を R2 に

## 確認項目

- [ ] 390×844 と 375×667（短い端末）で、単語・ボタンがキャラの顔に重ならない
- [ ] イラスト上のボタンと文字が、明るい服の上でも読める
- [ ] シャッフル ⇄ おはなし の切り替えで表示が変わり、再生中なら止まる
- [ ] 声の距離を変えると聞こえ方が変わり、音量感はほぼ変わらない
- [ ] 焚き火・川が鳴り、タイルの下線とスライダーが連動する
- [ ] 環境音を全部 ON にしても設定シートの高さは変わらず、中身がスクロールする
- [ ] 設定（モード・声・距離・環境音）がリロード後も残る
- [ ] 画面オフ中のバックグラウンド再生と通知欄の表示が、変更前と同じく動く
- [ ] 光の粒がキャラの前・文字の後ろで舞い、他のアプリに切り替えると止まる
- [ ] `pnpm build` と `pnpm lint` が通る
