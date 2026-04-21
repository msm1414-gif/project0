# Timebox Calendar

Google Calendar 風の 1 日タイムボクシング & カレンダーアプリ (Next.js + TypeScript + Tailwind CSS)。

## 機能

- **タイムボクシング (`/`)**: 24 時間のタイムライン上で空きセルをドラッグ → 5 分刻みで予定を作成。予定ブロックは縦方向にドラッグ移動、上下端でリサイズ可能。現在時刻には赤線。
- **カテゴリ自動色分け**: タイトルから「大学 / バイト / 遊び / その他」を推定して色を決定。明示指定も可能。
- **ToDo サイドバー**: PC (`lg:` 以上) でタイムボックスの右に常時表示、モバイルではタイムライン下に縦並び。
- **期間指定の一括登録**: 開始日〜終了日 × 選択した曜日 × 開始/終了時刻 で繰り返し予定を一括作成。後で「繰り返し全削除」も可能。
- **カレンダー (`/calendar`)**: 週ビュー / 月ビュー。各日の予定を時系列でカテゴリ色付きタイトル表示。日付クリックでその日のタイムボクシング画面へ。
- **永続化**: IndexedDB (ブラウザ内)。ログイン不要。リロードしてもデータは保持。

## 起動

```bash
npm install
npm run dev
```

`http://localhost:3000` を開く。

## ビルド / Lint

```bash
npm run build
npm run lint
```

## ディレクトリ構成

```
app/
  page.tsx              # 今日のタイムボクシング画面
  calendar/page.tsx     # 週/月カレンダー
components/
  timebox/              # グリッド、イベントブロック、現在時刻ライン、編集ダイアログ
  todo/                 # ToDo サイドバー
  bulk/                 # 一括登録ダイアログ
  calendar/             # 週/月ビュー
lib/
  types.ts              # Event / Todo / Category
  db.ts                 # IndexedDB (idb)
  store.ts              # Zustand ストア
  time.ts               # 分↔px 変換、5 分スナップ
  colors.ts             # カテゴリ色マッピング
  categorize.ts         # タイトル → カテゴリ推定
```
