# 積立貯筋口座（Chikutate Chokin）

運動を「身体への投資」と捉え、身体資産（BPT / Body Point）を積み立てていくトレーニング記録PWAです。
バックエンド不要・ビルド不要の素のHTML/CSS/JavaScriptで作られており、GitHub Pagesにそのままアップロードして公開できます。

## 特徴

- 心肺・筋力・筋持久力の3種の「身体資産」を、運動記録から独自係数(BPT)で算出
- 運動しない期間が続くと緩やかに資産が減価する「デトレーニング」モデル
- 同日に運動しすぎても効果が比例し続けない「逓減モデル」
- シーズン制（記録をリセットせず、過去シーズンを保存して比較できる）
- 習慣スコア（0〜100）を身体資産と切り離して管理
- 科学的知見／アプリ独自定義／ゲームバランスの3層を明示した「科学的根拠ページ」
- オフラインでも動作するPWA（データは端末のlocalStorageに保存）

## ディレクトリ構成

```
.
├── index.html              # アプリシェル
├── manifest.json           # PWAマニフェスト
├── service-worker.js       # オフラインキャッシュ
├── icons/                  # アプリアイコン
├── css/
│   └── style.css           # デザインシステム（通帳/台帳モチーフ）
└── js/
    ├── data/                # データモデル & 永続化層
    │   ├── config.js        # 係数設定（SCIENCE / APP DEFINITION / GAME BALANCE の3層）
    │   ├── exercises.js      # 種目マスタ（METs近似値など）
    │   ├── models.js         # User / Season / Asset / WorkoutRecord 等のファクトリ
    │   └── storage.js        # localStorageリポジトリ
    ├── engine/               # 計算エンジン（UIから独立）
    │   ├── cardioCalculator.js
    │   ├── strengthCalculator.js
    │   ├── enduranceCalculator.js
    │   ├── decayCalculator.js
    │   ├── habitCalculator.js
    │   ├── bptCalculator.js   # 上記を統括するオーケストレーター
    │   └── seasonManager.js   # シーズンのライフサイクル管理・減価の一括適用
    ├── ui/                   # 画面ごとのレンダリング関数
    │   ├── format.js / chart.js  # 共通ユーティリティ
    │   ├── home.js            # ① ホーム
    │   ├── record.js          # ② 運動記録
    │   ├── result.js          # ③ 積立結果（オーバーレイ）
    │   ├── portfolio.js       # ④ ポートフォリオ
    │   ├── history.js         # ⑤ 資産推移
    │   ├── seasons.js         # シーズン成績一覧
    │   ├── science.js         # 科学的根拠・計算方法ページ
    │   ├── more.js            # 「その他」メニュー
    │   └── router.js          # 画面切り替え
    └── app.js                 # エントリーポイント（初期化・減価適用・SW登録）
```

## 設計方針（開発指示書との対応）

- **計算式は後から変更可能**（33章①）: すべての係数・閾値は `js/data/config.js` に集約し、
  UIやロジックへの直書きを避けています。
- **3層構造の明示**（38章）: `config.js` と `js/ui/science.js` の両方で、
  `[SCIENCE]` `[APP DEFINITION]` `[GAME BALANCE]` のコメント/タグを用いて
  「科学的に確認できる事実」と「アプリ独自のモデル」を区別しています。
- **計算エンジンの独立**（28章）: `js/engine/` はDOMやUIに一切依存せず、
  Node.js上でも単体テスト可能な形にしています（下記「動作確認」参照）。
- **過去データを壊さない**（33章②）: シーズンを終了しても過去のWorkoutRecord・
  AssetHistoryはlocalStorageに保持され続けます。
- **オフライン対応**（33章⑤）: `service-worker.js` がアプリシェルをキャッシュし、
  データそのものはlocalStorageに保存されるため、通信状況に左右されず基本機能が使えます。

## 動作確認（Phase 1 サンプル計算テスト）

開発指示書34章の指示に従い、UI実装前にNode.js上でサンプルデータによる計算テストを行いました
（ウォーキング30分・ランニング30分・レッグプレス・スクワット等の複数ケース、逓減モデル、
減価モデル、シーズン開始/終了、習慣スコアの一連のフローを検証済み）。

## ローカルで試す

ビルド不要です。ルートディレクトリで簡易サーバーを起動するだけで動作します。

```bash
# Python がある場合
python3 -m http.server 8080

# Node.js がある場合
npx serve .
```

ブラウザで `http://localhost:8080` を開いてください。
（`file://` で直接開くと、Service WorkerやCSSの一部が正しく動作しない場合があります）

## GitHub Pagesへのデプロイ手順

1. GitHubで新しいリポジトリを作成する（例: `chikutate-chokin`）
2. このフォルダの中身一式をリポジトリ直下にアップロードする
   ```bash
   git init
   git add .
   git commit -m "Initial commit: 積立貯筋口座"
   git branch -M main
   git remote add origin https://github.com/<あなたのユーザー名>/chikutate-chokin.git
   git push -u origin main
   ```
3. GitHubリポジトリの **Settings → Pages** を開く
4. **Source** を `Deploy from a branch` にし、Branch を `main` / `/(root)` に設定して保存
5. しばらくすると `https://<あなたのユーザー名>.github.io/chikutate-chokin/` で公開されます
6. スマートフォンでそのURLを開き、共有メニューから「ホーム画面に追加」するとPWAとしてインストールできます

## 今後の拡張候補（指示書32章「初期段階では不要」を参照）

SNS連携・他ユーザーランキング・課金・広告・Apple Health/Google Fit連携・AIコーチ・
より複雑なゲーミフィケーションは、意図的にMVP範囲外としています。
まずは「身体資産を確認する→運動する→資産が変化する」という基本ループの体験を
磨くことを優先してください。

## 免責事項

BPT（Body Point）は本アプリ独自の身体資産指数であり、実際の筋肉量・VO₂max・消費カロリー等を
直接測定した値ではありません。医学的診断・治療・予後予測などの目的には使用しないでください。
詳細はアプリ内「科学的根拠・計算方法」ページをご覧ください。
