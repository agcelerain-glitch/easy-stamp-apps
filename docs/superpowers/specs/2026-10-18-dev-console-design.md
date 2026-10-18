# 開発者コンソール デザイン設計書

- **日付**: 2026-10-18
- **対象**: 開発者向けコンソール（独自ログイン＋初期3ツール＋将来拡張）
- **ブランチ**: `feat/dev-console`（`master` 起点、RPG冒険マップとは独立）

## 背景・目的

管理者（各ポイント担当）より上位の「開発者」が、運用に必要なリンク・QR・設定を1か所で扱える**開発者コンソール**を新設する。将来的に設定変更ツールを足していけるハブとして設計する。初期ツールは3つ：

1. 新規ユーザー共有リンク
2. トップドメインのQR表示
3. 名前変更リンク（＋その実体となる名前変更ページ・API）

既存アプリの軽量・堅牢方針、匿名ユーザー（ニックネーム＋`profile_id`）・`service_role` API の設計を踏襲する。

## 確定した方針（ヒアリング結果）

| 項目 | 決定 |
|------|------|
| 認証 | 専用 `DEV_PASSCODE` ＋ 独立 `dev_token` cookie（`admin-session` パターン流用） |
| ルート保護 | `/admin/[n]` と同じ「サーバーコンポーネントで cookie 検証 → 無効なら `redirect()`」。ミドルウェア不使用 |
| 名前変更 | 汎用セルフ変更ページ（固定URL）。コンソールはそのURLを表示/コピーするだけ |
| 共有リンク/QR | プレーンな固定URL（本番ドメイン）。追跡パラメータなし。宛先はトップ `/` |
| 共有/QRの基点URL | `NEXT_PUBLIC_BASE_URL`（未設定時 `window.location.origin` フォールバック） |

## アーキテクチャ

### 認証（admin-session のミラー）

- **`lib/dev-session.ts`**（新規）: `signDevToken()` / `verifyDevToken()` / `DEV_COOKIE_NAME`。
  - cookie 名 `dev_token`、HS256、TTL 8時間、`httpOnly` / `secure`(本番) / `sameSite: "strict"` / `path: "/"`。
  - 署名鍵は環境変数 `DEV_SESSION_SECRET`（admin とは別鍵）。未設定なら起動時に明示エラー（admin-session と同じ作法）。
  - ペイロードは最小（例 `{ role: "dev" }`）。ポイント概念は持たない。
- **`app/api/dev/auth/route.ts`**（新規）: POST `{ passcode }` → `process.env.DEV_PASSCODE` と照合。
  - 不一致時は 500ms 待機（ブルートフォース遅延）＋ `401 invalid_passcode`。
  - 一致で `dev_token` cookie を発行し `{ ok: true }` を返す。

### ルート保護（ルートグループ）

- `app/dev/page.tsx`（**公開**）: 開発者ログインUI（admin ログインのミラー、🛠️）。成功後 `/dev/console` へ。
- `app/dev/(protected)/layout.tsx`（新規）: 配下を一括ガード。`cookies()` で `dev_token` を取得→`verifyDevToken`→無効なら `redirect("/dev")`。
- `app/dev/(protected)/console/page.tsx` → URL `/dev/console`: コンソール本体。
- **`/dev/clear` を保護下へ移動**: 既存 `app/dev/clear/page.tsx` を `app/dev/(protected)/clear/page.tsx` へ移動。URLは `/dev/clear` のまま（ルートグループは不可視）。現状**無認証で開いている問題を解消**する。

### コンソール本体 `/dev/console`

3ツールをカード表示する「ハブ」。将来ツールはカード追加で拡張。

```
🛠️ 開発者コンソール                         ログアウト
┌──────────────────────────────────┐
│ 📣 新規ユーザー共有リンク                   │
│   https://<本番>/                         │  [コピー] [QRを表示]
├──────────────────────────────────┤
│ 📱 トップドメインQR（印刷/掲示用）           │
│   （上と同じ入口URL）                       │  [QR] [PNG保存]
├──────────────────────────────────┤
│ ✏️ 名前変更リンク                          │
│   https://<本番>/user/rename              │  [コピー] [QRを表示]
└──────────────────────────────────┘
```

- **ツール1（共有リンク）＋ツール2（トップQR）**: 同じ入口URL（`/`）。URL表示＋コピー、QR（既存 `qrcode.react`）、PNG保存。
- **ツール3（名前変更リンク）**: `/user/rename` のURL表示＋コピー＋QR。
- UI は client コンポーネントに分離（下記）。

### コンポーネント分割

- **`components/LinkQrCard.tsx`**（新規・client）: props `{ title: string; emoji: string; url: string; note?: string }`。URL表示・コピーボタン・QR表示トグル・PNG保存を担う汎用カード。3ツールすべてこれで表現（DRY）。
  - ベースURLは呼び出し側で解決（`NEXT_PUBLIC_BASE_URL ?? window.location.origin`）、完全URLを props で受け取る。
- コンソールページはこのカードを3枚並べるだけの薄い器。

### 名前変更フロー（唯一の作り込み）

- **`app/user/rename/page.tsx`**（新規・client）:
  - **有効セッション必須**: `localStorage` の `profile_id` と `nickname` が無ければ「`/user` から復元してください」と案内し、`/user` へのリンクを出す。
  - 現ニックネーム表示 → 新ニックネーム入力（`trim`、1〜20文字、既存 `/user` と同じバリデーション）→ 送信。
  - 成功時 `localStorage.nickname` を更新し `/user/home` へ。重複時は「そのニックネームはすでに使われています」。
- **`app/api/profile/rename/route.ts`**（新規）: POST `{ profile_id: string; new_nickname: string }`。
  - `service_role` で `profiles` を `update({ nickname }).eq("id", profile_id)`。
  - 長さ検証（1〜20）、重複 Postgres `23505` → `409 nickname_taken`、`withTimeout(5000)`、既存ルートと同じエラー形。
  - **キーは `profile_id`（UUID）**。ニックネームではなく UUID 保持＝本人セッションの証明とし、他人の改名（荒らし）を防ぐ。

## データフロー

1. 開発者が `/dev` でパスコード入力 → `/api/dev/auth` が `DEV_PASSCODE` 照合 → `dev_token` cookie 発行 → `/dev/console`。
2. `/dev/(protected)/*` は layout がサーバーで cookie 検証。無効なら `/dev` へ。
3. コンソールは `NEXT_PUBLIC_BASE_URL` から各URLを組み立て、`LinkQrCard` で表示。
4. 利用者が `/user/rename` を自端末で開く → `profile_id` を添えて `/api/profile/rename` → DB更新 → localStorage 更新。

## セキュリティ・運用

### セキュリティ
- `DEV_SESSION_SECRET`・`DEV_PASSCODE` は Vercel 環境変数（git に置かない）。`ADMIN_*` とは別物。
- dev権限は管理者より上位。cookie は `httpOnly`/`secure`/`strict`。TTL 8h（必要なら短縮可）。
- 名前変更APIは `profile_id` キーで本人性を担保（既存の匿名＋`service_role` API の方針と一貫）。公開APIだが UUID 不明には操作不可。
- `/dev/clear` を認証下へ移すことで、現状の無認証キャッシュ操作を塞ぐ。

### 運用アドバイス
1. **QR印刷前に `NEXT_PUBLIC_BASE_URL` を本番ドメインに設定**。未設定だとプレビューURL等を指すQRを刷る事故が起きる。
2. `DEV_PASSCODE` / `DEV_SESSION_SECRET` を Vercel の Production/Preview 両環境に設定してからデプロイ（未設定だとビルド/起動でエラー）。
3. **改名で旧ニックネームは再利用可能**（unique制約で解放）。ただしスタンプ履歴は `profile_id` 紐付けのため**引き継がれる**（名前だけ変わる）。
4. 共有リンク・トップQRは同一の入口 `/`。印刷物とデジタル共有で同じURLを使える。

## ファイル構成

| ファイル | 役割 |
|---------|------|
| `lib/dev-session.ts` | dev JWT 署名・検証（admin-session ミラー） |
| `app/api/dev/auth/route.ts` | パスコード照合・`dev_token` 発行 |
| `app/dev/page.tsx` | dev ログインUI（公開） |
| `app/dev/(protected)/layout.tsx` | 配下の一括サーバーガード |
| `app/dev/(protected)/console/page.tsx` | コンソール本体（3カード） |
| `app/dev/(protected)/clear/page.tsx` | 既存 `/dev/clear` を保護下へ移動 |
| `components/LinkQrCard.tsx` | URL/コピー/QR/PNG の汎用カード（client） |
| `app/user/rename/page.tsx` | 名前変更ページ（セッション必須） |
| `app/api/profile/rename/route.ts` | 改名API（`service_role`、profile_idキー） |

## スコープ外（YAGNI）

- トークン付き per-user リンク／スキャン集計・流入分析／監査ログ／レート制限。
- コンソール内でのユーザー直接編集（ヘルプデスク代行）。
- 管理者ログインとの統合（今回は独立運用）。
- 新機能のRPGテーマ適用（dev画面は機能優先の簡素UIでよい）。

## 未決・実装時に確定する細部

- dev ログイン/コンソールの配色トーン（機能優先。admin と同系のダーク/グレーで可）。
- QRの既定サイズ・PNG保存のファイル名。
- `DEV_SESSION_SECRET` を admin と共有鍵にするか別鍵にするか（本設計は別鍵を既定とする）。
