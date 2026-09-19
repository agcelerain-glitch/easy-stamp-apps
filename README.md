# スタンプラリーアプリ

Vercel × Supabase で構築した **ユーザー提示型スタンプラリー PWA** です。
ユーザーが QR コードを提示し、各ポイントの管理者がスキャンすることでスタンプが付与されます。

---

## 機能概要

| 区分 | 機能 |
|------|------|
| ユーザー | ニックネームのみで匿名ログイン、進捗ホーム画面、OTP QR コード発行（1時間有効）|
| 管理者 | ポイント別パスコード認証、QR スキャン → スタンプ付与 |
| リアルタイム | Supabase Realtime でスキャン後に即時反映・スタンプアニメーション |
| PWA | ホーム画面への追加対応、プルリフレッシュ、オフラインシェルキャッシュ |

---

## 技術スタック

| 項目 | 内容 |
|------|------|
| フレームワーク | Next.js 16 (App Router / Turbopack) |
| ホスティング | Vercel |
| DB / Realtime | Supabase (PostgreSQL + RLS + Realtime) |
| 認証 | Supabase 匿名認証（ユーザー）/ JWT httpOnly Cookie（管理者）|
| QR 生成 | qrcode.react |
| QR スキャン | html5-qrcode（動的インポート）|
| PWA | 手動 Service Worker (`public/sw.js`) |
| スタイル | Tailwind CSS v4 |

---

## ページ構成

```
/                   トップ（スタンプラリーを始める / 管理者はこちら）
├── /user           ニックネーム入力（キャッシュあり → /user/home へリダイレクト）
├── /user/home      ユーザーホーム（進捗・スタンプ一覧・リロード・管理者リンク）
├── /user/stamps    スタンプボード（QR 発行・Realtime 受信・アニメーション）
├── /admin          管理者パスコード入力
├── /admin/[n]      スタンプポイント n (1〜5) のスキャン画面
└── /dev/clear      開発者用 localStorage インスペクタ・クリア
```

---

## ディレクトリ構成

```
app/
├── page.tsx                    トップ
├── layout.tsx                  共通レイアウト（PWA メタ / SW 登録）
├── globals.css                 Tailwind + カスタムキーフレーム
├── user/
│   ├── page.tsx                ニックネーム入力
│   ├── home/page.tsx           ユーザーホーム
│   └── stamps/page.tsx         スタンプボード
├── admin/
│   ├── page.tsx                管理者パスコード入力
│   └── [n]/page.tsx            QR スキャン画面
├── api/
│   ├── admin/auth/route.ts     パスコード検証 → JWT Cookie 発行
│   ├── otp/generate/route.ts   OTP 発行・再利用
│   ├── stamp/verify/route.ts   OTP 検証 → スタンプ付与 → OTP 削除
│   ├── stamps/route.ts         スタンプ一覧取得
│   └── profile/lookup/route.ts ニックネーム照合・プロフィール作成
└── dev/
    └── clear/page.tsx          開発者用キャッシュクリア

components/
├── QRModal.tsx                 QR コード表示（カウントダウン付き）
├── AdminScanner.tsx            QR スキャナー（html5-qrcode）
├── StampAnimation.tsx          判子アニメーション（2秒）
├── CompleteAnimation.tsx       コンプリート祝福アニメーション（4秒）
├── PullRefreshIndicator.tsx    プルリフレッシュ インジケーター
└── ServiceWorkerRegister.tsx   SW 登録

hooks/
└── usePullToRefresh.ts         プルリフレッシュ Hook

lib/
├── admin-session.ts            JWT 署名・検証（jose）
├── timeout.ts                  withTimeout ユーティリティ（5秒）
└── supabase/
    ├── client.ts               ブラウザクライアント
    ├── server.ts               サーバークライアント（Cookie）
    ├── service.ts              サービスロールクライアント（API Route 専用）
    └── types.ts                DB 型定義

supabase/
└── schema.sql                  テーブル・RLS・インデックス・Realtime 設定
public/
├── manifest.json               PWA マニフェスト
├── sw.js                       Service Worker
└── icons/                      PWA アイコン各種
```

---

## セットアップ

### 1. リポジトリのクローン・依存関係インストール

```bash
git clone https://github.com/agcelerain-glitch/easy-stamp-apps.git
cd easy-stamp-apps
npm install
```

### 2. 環境変数の設定

`.env.local.example` をコピーして `.env.local` を作成し、各値を埋めます。

```bash
cp .env.local.example .env.local
```

| 変数名 | 内容 |
|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key（サーバー専用） |
| `ADMIN_PASS_1` 〜 `ADMIN_PASS_5` | 各スタンプポイントのパスコード |
| `ADMIN_SESSION_SECRET` | JWT 署名シークレット（32 文字以上のランダム文字列）|

`ADMIN_SESSION_SECRET` の生成方法:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Supabase のセットアップ

Supabase ダッシュボード → **SQL エディタ** で `supabase/schema.sql` を実行します。

主な内容：
- `profiles`・`stamps`・`otp_codes` テーブルの作成
- RLS ポリシーの設定
- Realtime パブリケーションへの `stamps` テーブル追加
- （任意）pg_cron による期限切れ OTP の自動削除

### 4. ローカル開発

```bash
npm run dev
```

---

## デプロイ（Vercel）

1. Vercel ダッシュボード → **Add New Project** → GitHub リポジトリをインポート
2. **Environment Variables** に `.env.local` の全変数を登録
3. **Node.js Version** を `20.x` に設定（Settings → General）
4. デプロイ実行

> 環境変数を設定した後は必ず **Redeploy** が必要です。

---

## 動作フロー

### ユーザー側

```
アプリを開く
  ↓ キャッシュなし → /user（ニックネーム入力）
  ↓ キャッシュあり → /user/home（ホーム画面）
        ↓
  スタンプを集める → /user/stamps
        ↓ ポイントをタップ
  OTP QR コード発行（有効期限 1 時間）
        ↓ 管理者がスキャン
  Realtime でスタンプが自動付与
  + 判子アニメーション（2秒）
  + 全 5 枚でコンプリートアニメーション（4秒）
```

### 管理者側

```
/user/home のヘッダー「管理者」ボタン または /admin に直接アクセス
  ↓ 担当ポイントのパスコード入力
  ↓ API Route で検証 → JWT httpOnly Cookie を発行
/admin/[n]（スキャン画面）
  ↓ カメラでユーザーの QR コードをスキャン
  ↓ OTP 検証（ポイント一致・有効期限内・未スタンプ確認）
  ↓ stamps テーブルへ INSERT + otp_codes から DELETE
完了
```

---

## セキュリティ設計

| 項目 | 対策 |
|------|------|
| 管理者パスコード | フロントエンドに持たせず API Route で検証・環境変数管理 |
| 管理者セッション | HS256 JWT を httpOnly / SameSite=Strict Cookie に保存 |
| OTP | UUID トークン、1時間で期限切れ、スキャン後即削除 |
| DB 書き込み | 全て service_role 経由の API Route のみ（クライアントから直接書けない）|
| タイムアウト | 全 API に `withTimeout(5000ms)` を適用 |
| ブルートフォース対策 | パスコード不一致時に 500ms の遅延を挿入 |

---

## 開発者向け情報

### キャッシュクリア（ユーザー切替）

`/dev/clear` にアクセスすると localStorage の `profile_id` と `nickname` を確認・削除できます。
`/user/home` 最下部の `dev: cache` リンクからもアクセス可能です。

### OTP の定期削除

Supabase の pg_cron 拡張を有効化後、`schema.sql` 末尾のコメントアウト部分を実行すると 10 分おきに期限切れ OTP を自動削除します。

```sql
select cron.schedule(
  'delete-expired-otp',
  '*/10 * * * *',
  $$ delete from otp_codes where expires_at < now(); $$
);
```
