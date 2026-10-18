# 開発者コンソール Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 管理者より上位の「開発者コンソール」を新設し、専用パスコード認証の下で「新規ユーザー共有リンク／トップドメインQR／名前変更リンク」の3ツールと、その実体となる名前変更ページ・APIを提供する。

**Architecture:** 認証は `admin-session` パターンのミラー（`DEV_PASSCODE` → `dev_token` JWT cookie）。`/admin/[n]` と同じ「サーバーコンポーネントで cookie 検証→無効なら `redirect()`」方式を、`/dev/(protected)` ルートグループの layout ガードで実現。コンソールは汎用カード `LinkQrCard` を3枚並べる薄い器。名前変更は固定URL `/user/rename`（セッション必須）＋ `profile_id` キーの `service_role` API。

**Tech Stack:** Next.js 16.3.5 (App Router / client・server components) / React 19 / Tailwind CSS v4 / jose (JWT) / qrcode.react v4 / Supabase service_role。依存追加なし。

## 検証方針（重要）

本プロジェクトにはテストランナーが無く（`package.json` のスクリプトは `dev`/`build`/`start` のみ）、UI/認証中心の変更である。各タスクの検証は **`npm run build`（型チェック＋コンパイル成功）＋ 必要に応じ手動確認**。ユニットテストは書かない。

ビルドは環境変数が必要（`dev-session.ts` と `admin-session.ts` は未設定時にモジュール読込で例外を投げる）。**全タスク共通のビルドコマンド**：

- Bash: `ADMIN_SESSION_SECRET=build-dummy DEV_SESSION_SECRET=build-dummy DEV_PASSCODE=build-dummy npm run build`
- PowerShell: `$env:ADMIN_SESSION_SECRET="build-dummy"; $env:DEV_SESSION_SECRET="build-dummy"; $env:DEV_PASSCODE="build-dummy"; npm run build`

## Global Constraints

- Node 20 互換（`engines: node >=20.0.0`）。依存追加なし（jose / qrcode.react / Supabase は既存）。
- `@supabase/supabase-js` は `^2.49.4` 固定。
- 認証は専用 `DEV_PASSCODE` ＋ 独立 cookie `dev_token`（HS256、TTL 8時間 = `60*60*8`、`httpOnly` / `secure`(本番) / `sameSite:"strict"` / `path:"/"`）。署名鍵は `DEV_SESSION_SECRET`（`ADMIN_SESSION_SECRET` とは別鍵）。
- ルート保護は `/admin/[n]` と同じサーバー cookie 検証＋`redirect()`。ミドルウェア不使用。
- 名前変更APIのキーは **`profile_id`（UUID）**。ニックネームでの変更は不可（荒らし防止）。
- 名前変更ページは **有効セッション必須**（`localStorage` の `profile_id` と `nickname`）。無ければ `/user` へ誘導。
- 共有リンク・トップQRの宛先は入口URL `/`。名前変更リンクは `/user/rename`。基点URLは `NEXT_PUBLIC_BASE_URL`（末尾スラッシュ除去）→ 未設定時 `window.location.origin`。
- ニックネーム制約は既存踏襲：`trim` 後 1〜20文字、重複は Postgres `23505` → `nickname_taken`。API は既存の `withTimeout(5000)` を使う。
- qrcode.react は `QRCodeCanvas`（PNG保存用）/`QRCodeSVG` を使用。props は `value` / `size` / `level` / `marginSize`（v4）。`includeMargin` は使わない。
- 作業ブランチ `feat/dev-console`。コミット末尾に `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。
- spec: `docs/superpowers/specs/2026-10-18-dev-console-design.md`

---

### Task 1: 開発者認証バックエンド（dev-session ＋ auth API ＋ env例）

`admin-session.ts` / `app/api/admin/auth/route.ts` をミラーした dev 用の認証基盤を作る。ログアウト用の DELETE も用意する。

**Files:**
- Create: `lib/dev-session.ts`
- Create: `app/api/dev/auth/route.ts`
- Modify: `.env.local.example`（末尾に3変数を追記）

**Interfaces:**
- Consumes: `jose`（既存依存）
- Produces:
  - `signDevToken(): Promise<string>`
  - `verifyDevToken(token: string): Promise<{ role: string } | null>`
  - `DEV_COOKIE_NAME: string`（= `"dev_token"`）、`DEV_TTL_SECONDS: number`（= `28800`）
  - API `POST /api/dev/auth`（body `{ passcode }` → cookie 発行、`{ ok: true }`）、`DELETE /api/dev/auth`（cookie 失効）

- [ ] **Step 1: `lib/dev-session.ts` を作成**

```ts
import { SignJWT, jwtVerify } from "jose";

const secret = process.env.DEV_SESSION_SECRET;
if (!secret) {
  throw new Error(
    "[dev-session] DEV_SESSION_SECRET が設定されていません。Vercel 環境変数または .env.local に設定してください。"
  );
}
const SECRET = new TextEncoder().encode(secret);
const COOKIE_NAME = "dev_token";
const TTL_SECONDS = 60 * 60 * 8; // 8時間

export async function signDevToken(): Promise<string> {
  return new SignJWT({ role: "dev" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(SECRET);
}

export async function verifyDevToken(
  token: string
): Promise<{ role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (payload.role !== "dev") return null;
    return { role: "dev" };
  } catch {
    return null;
  }
}

export { COOKIE_NAME as DEV_COOKIE_NAME, TTL_SECONDS as DEV_TTL_SECONDS };
```

- [ ] **Step 2: `app/api/dev/auth/route.ts` を作成**

```ts
import { NextRequest, NextResponse } from "next/server";
import {
  signDevToken,
  DEV_COOKIE_NAME,
  DEV_TTL_SECONDS,
} from "@/lib/dev-session";

export async function POST(req: NextRequest) {
  let body: { passcode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { passcode } = body;
  if (!passcode || typeof passcode !== "string") {
    return NextResponse.json({ error: "passcode_required" }, { status: 400 });
  }

  const expected = process.env.DEV_PASSCODE;
  if (!expected || passcode !== expected) {
    // ブルートフォースを遅らせる
    await new Promise((r) => setTimeout(r, 500));
    return NextResponse.json({ error: "invalid_passcode" }, { status: 401 });
  }

  const token = await signDevToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEV_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: DEV_TTL_SECONDS,
    path: "/",
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEV_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
  return res;
}
```

- [ ] **Step 3: `.env.local.example` の末尾に追記**

```
# 開発者コンソール
DEV_PASSCODE=change-me-strong-passcode
DEV_SESSION_SECRET=change-me-long-random-secret
NEXT_PUBLIC_BASE_URL=https://easy-stamp-apps.vercel.app
```

- [ ] **Step 4: ビルド**

Run（Bash）: `ADMIN_SESSION_SECRET=build-dummy DEV_SESSION_SECRET=build-dummy DEV_PASSCODE=build-dummy npm run build`
Expected: 成功。型エラー・未使用警告なし。`/api/dev/auth` が Route 一覧に出る。

- [ ] **Step 5: Commit**

```bash
git add lib/dev-session.ts app/api/dev/auth/route.ts .env.local.example
git commit -m "feat: add developer session auth (dev-session + /api/dev/auth)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: 開発者ログインページ ＋ 保護レイアウト ＋ /dev/clear 移動

ログインUI（公開）と、配下を一括ガードする `(protected)` レイアウトを作る。既存 `/dev/clear` を保護下へ移動（URLは不変）。

**Files:**
- Create: `app/dev/page.tsx`
- Create: `app/dev/(protected)/layout.tsx`
- Move: `app/dev/clear/page.tsx` → `app/dev/(protected)/clear/page.tsx`（内容不変）

**Interfaces:**
- Consumes（Task 1 から）: `verifyDevToken`, `DEV_COOKIE_NAME`、API `POST /api/dev/auth`
- Produces: 公開ルート `/dev`（ログイン）、保護ルートグループ `/dev/(protected)/*`

- [ ] **Step 1: `app/dev/page.tsx`（ログインUI）を作成**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DevLoginPage() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting || !passcode) return;
    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/dev/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error === "invalid_passcode"
            ? "パスコードが正しくありません"
            : "エラーが発生しました。もう一度お試しください"
        );
        setPasscode("");
        return;
      }
      router.push("/dev/console");
    } catch (e) {
      setError(
        e instanceof Error && e.name === "TimeoutError"
          ? "接続がタイムアウトしました"
          : "エラーが発生しました。もう一度お試しください"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-6 bg-gray-950 text-gray-200">
      <div className="w-full max-w-xs space-y-6">
        <div className="text-center">
          <div className="text-5xl mb-3">🛠️</div>
          <h1 className="text-xl font-bold text-gray-100">開発者ログイン</h1>
          <p className="text-sm text-gray-500 mt-1">
            開発者パスコードを入力してください
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="パスコード"
            className="w-full px-4 py-3 text-lg bg-gray-900 border-2 border-gray-800 focus:border-gray-500 rounded-xl outline-none transition-colors text-gray-100"
            autoFocus
            disabled={isSubmitting}
          />
          {error && <p className="text-sm text-red-400 text-center">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting || !passcode}
            className="w-full py-3 px-6 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white font-bold rounded-2xl transition-colors"
          >
            {isSubmitting ? "確認中..." : "ログイン"}
          </button>
        </form>
        <p className="text-center text-xs text-gray-600 underline">
          <a href="/">← トップへ戻る</a>
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: `app/dev/(protected)/layout.tsx`（サーバーガード）を作成**

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyDevToken, DEV_COOKIE_NAME } from "@/lib/dev-session";

export default async function DevProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(DEV_COOKIE_NAME)?.value;
  if (!token) redirect("/dev");

  const session = await verifyDevToken(token);
  if (!session) redirect("/dev");

  return <>{children}</>;
}
```

- [ ] **Step 3: `/dev/clear` を保護ルートグループへ移動**

Run（Bash）:
```bash
mkdir -p "app/dev/(protected)"
git mv app/dev/clear "app/dev/(protected)/clear"
```
内容は変更しない（URL は `/dev/clear` のまま。ルートグループ `(protected)` は URL に現れない）。移動後 `app/dev/clear` ディレクトリが残っていないことを確認する。

- [ ] **Step 4: ビルド**

Run（Bash）: `ADMIN_SESSION_SECRET=build-dummy DEV_SESSION_SECRET=build-dummy DEV_PASSCODE=build-dummy npm run build`
Expected: 成功。Route 一覧に `/dev` と `/dev/clear` が出る（`/dev/console` はまだ無くてよい）。

- [ ] **Step 5: 手動確認（任意）**

`npm run dev`（同じ env 付き）。Cookie 無しで `/dev/clear` にアクセス → `/dev` にリダイレクトされることを確認。`/dev` でログイン後は保護下に入れること（`/dev/console` は次タスクで追加）。dev 起動がハングする場合はビルド成功を検証ゲートとする。

- [ ] **Step 6: Commit**

```bash
git add app/dev
git commit -m "feat: add dev login page and protected route group; move /dev/clear under auth

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `LinkQrCard` 汎用カードコンポーネント

URL表示・コピー・QR表示トグル・PNG保存を担う client コンポーネント。3ツール共通で使う（DRY）。

**Files:**
- Create: `components/LinkQrCard.tsx`

**Interfaces:**
- Consumes: `qrcode.react`（`QRCodeCanvas`）
- Produces: デフォルトエクスポート `LinkQrCard`、props:
  ```ts
  interface LinkQrCardProps {
    title: string;
    emoji: string;
    url: string;
    note?: string;
  }
  ```

- [ ] **Step 1: `components/LinkQrCard.tsx` を作成**

```tsx
"use client";

import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

interface LinkQrCardProps {
  title: string;
  emoji: string;
  url: string;
  note?: string;
}

export default function LinkQrCard({ title, emoji, url, note }: LinkQrCardProps) {
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const qrWrapRef = useRef<HTMLDivElement>(null);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard 不可環境は無視（ユーザーは表示URLを手動選択できる）
    }
  }

  function handleDownloadPng() {
    const canvas = qrWrapRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `qr-${title}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xl">{emoji}</span>
        <h2 className="font-bold text-gray-100">{title}</h2>
      </div>
      {note && <p className="text-xs text-gray-500">{note}</p>}

      <p className="font-mono text-sm text-indigo-300 break-all bg-gray-950 rounded-lg px-3 py-2 border border-gray-800">
        {url}
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleCopy}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-700 hover:bg-gray-600 text-white transition-colors"
        >
          {copied ? "コピーしました ✓" : "コピー"}
        </button>
        <button
          onClick={() => setShowQr((v) => !v)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-700 hover:bg-gray-600 text-white transition-colors"
        >
          {showQr ? "QRを隠す" : "QRを表示"}
        </button>
        {showQr && (
          <button
            onClick={handleDownloadPng}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-700 hover:bg-indigo-600 text-white transition-colors"
          >
            PNG保存
          </button>
        )}
      </div>

      {showQr && (
        <div ref={qrWrapRef} className="flex justify-center bg-white rounded-xl p-4">
          <QRCodeCanvas value={url} size={200} level="M" marginSize={4} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: ビルド**

Run（Bash）: `ADMIN_SESSION_SECRET=build-dummy DEV_SESSION_SECRET=build-dummy DEV_PASSCODE=build-dummy npm run build`
Expected: 成功。`QRCodeCanvas` / `marginSize` の型エラーが出ないこと（出た場合は qrcode.react v4 の型に合わせ、`marginSize` を削除し白余白の `p-4` を維持）。

- [ ] **Step 3: Commit**

```bash
git add components/LinkQrCard.tsx
git commit -m "feat: add LinkQrCard component (url copy + QR + PNG download)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: コンソール本体 `/dev/console`

`LinkQrCard` を3枚並べるハブ。基点URLを解決し、3つの宛先URLを組み立てる。実ログアウト（cookie 失効）付き。

**Files:**
- Create: `app/dev/(protected)/console/page.tsx`

**Interfaces:**
- Consumes（Task 3 から）: `LinkQrCard`（props `{ title, emoji, url, note? }`）。（Task 1 から）API `DELETE /api/dev/auth`。
- Produces: URL `/dev/console`（保護下）

- [ ] **Step 1: `app/dev/(protected)/console/page.tsx` を作成**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LinkQrCard from "@/components/LinkQrCard";

export default function DevConsolePage() {
  const router = useRouter();
  const [base, setBase] = useState("");

  useEffect(() => {
    const envBase = process.env.NEXT_PUBLIC_BASE_URL;
    const resolved =
      (envBase && envBase.replace(/\/$/, "")) || window.location.origin;
    setBase(resolved);
  }, []);

  async function handleLogout() {
    try {
      await fetch("/api/dev/auth", { method: "DELETE" });
    } catch {
      // 失効呼び出し失敗でも /dev へ遷移する
    }
    router.push("/dev");
  }

  return (
    <main className="flex flex-col min-h-screen bg-gray-950 text-gray-200">
      <header className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-2 font-bold text-gray-100">
          <span>🛠️</span>
          <span>開発者コンソール</span>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs text-gray-500 hover:text-gray-300 underline"
        >
          ログアウト
        </button>
      </header>

      <div className="flex-1 px-4 py-6 max-w-md mx-auto w-full space-y-4">
        {base ? (
          <>
            <LinkQrCard
              emoji="📣"
              title="新規ユーザー共有リンク"
              url={`${base}/`}
              note="新しく参加する人に共有する入口URLです。"
            />
            <LinkQrCard
              emoji="📱"
              title="トップドメインQR"
              url={`${base}/`}
              note="会場での掲示・印刷用。上と同じ入口URLのQRです。"
            />
            <LinkQrCard
              emoji="✏️"
              title="名前変更リンク"
              url={`${base}/user/rename`}
              note="ニックネームを変更したい利用者に渡すリンクです。"
            />
          </>
        ) : (
          <p className="text-sm text-gray-500">読み込み中...</p>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: ビルド**

Run（Bash）: `ADMIN_SESSION_SECRET=build-dummy DEV_SESSION_SECRET=build-dummy DEV_PASSCODE=build-dummy npm run build`
Expected: 成功。Route 一覧に `/dev/console` が出る。

- [ ] **Step 3: 手動確認（任意）**

`npm run dev`（env 付き）。`/dev` でログイン → `/dev/console` に3カード表示。URLが `window.location.origin`（env 未設定時）で `.../`・`.../`・`.../user/rename` になること、コピー・QR表示・PNG保存・ログアウト（→ `/dev` へ、以後 `/dev/console` 直アクセスで `/dev` に戻る）を確認。ハング時はビルド成功を検証ゲートとする。

- [ ] **Step 4: Commit**

```bash
git add "app/dev/(protected)/console/page.tsx"
git commit -m "feat: add developer console hub with share link, top QR, rename link

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: 名前変更API `POST /api/profile/rename`

`profile_id` をキーに `profiles.nickname` を更新する `service_role` API。既存 `profile/lookup` と同じ作法（`withTimeout`・エラー形）。

**Files:**
- Create: `app/api/profile/rename/route.ts`

**Interfaces:**
- Consumes: `@/lib/supabase/service`（`createServiceClient`）、`@/lib/timeout`（`withTimeout`, `TimeoutError`）
- Produces: `POST /api/profile/rename`（body `{ profile_id: string; new_nickname: string }` → `{ profile_id, nickname }` / エラー）

- [ ] **Step 1: `app/api/profile/rename/route.ts` を作成**

```ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { withTimeout, TimeoutError } from "@/lib/timeout";

const TIMEOUT_MS = 5000;

export async function POST(req: NextRequest) {
  let body: { profile_id?: string; new_nickname?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const profileId = body.profile_id?.trim();
  const newNickname = body.new_nickname?.trim();

  if (!profileId) {
    return NextResponse.json({ error: "profile_id_required" }, { status: 400 });
  }
  if (!newNickname || newNickname.length < 1 || newNickname.length > 20) {
    return NextResponse.json({ error: "invalid_nickname" }, { status: 400 });
  }

  const supabase = createServiceClient();
  try {
    const { data, error } = await withTimeout(
      supabase
        .from("profiles")
        .update({ nickname: newNickname })
        .eq("id", profileId)
        .select("id, nickname")
        .single(),
      TIMEOUT_MS
    );

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "nickname_taken" }, { status: 409 });
      }
      // 対象行なし（更新対象の profile_id が存在しない）
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
      }
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }

    return NextResponse.json({ profile_id: data.id, nickname: data.nickname });
  } catch (e) {
    if (e instanceof TimeoutError) {
      return NextResponse.json({ error: "timeout" }, { status: 504 });
    }
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: ビルド**

Run（Bash）: `ADMIN_SESSION_SECRET=build-dummy DEV_SESSION_SECRET=build-dummy DEV_PASSCODE=build-dummy npm run build`
Expected: 成功。Route 一覧に `/api/profile/rename` が出る。`.update(...).eq(...).select(...).single()` の型が通ること。

- [ ] **Step 3: 手動確認（任意、DB接続時）**

実 Supabase 接続環境でのみ。既存 profile の `id` に対し
`curl -X POST .../api/profile/rename -H "Content-Type: application/json" -d '{"profile_id":"<uuid>","new_nickname":"新名"}'` → `{ profile_id, nickname:"新名" }`。重複名で `409 nickname_taken`、存在しない id で `404 profile_not_found`。DB未接続時はビルド成功を検証ゲートとする。

- [ ] **Step 4: Commit**

```bash
git add app/api/profile/rename/route.ts
git commit -m "feat: add profile rename API (service_role, keyed by profile_id)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: 名前変更ページ `/user/rename`

有効セッション（`localStorage` の `profile_id`＋`nickname`）必須。現ニックネーム表示→新ニックネーム入力→`/api/profile/rename` 呼び出し→成功で localStorage 更新しホームへ。

**Files:**
- Create: `app/user/rename/page.tsx`

**Interfaces:**
- Consumes（Task 5 から）: `POST /api/profile/rename`（body `{ profile_id, new_nickname }` → `{ profile_id, nickname }`）
- Produces: URL `/user/rename`

- [ ] **Step 1: `app/user/rename/page.tsx` を作成**

```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Phase = "check" | "ready" | "no_session";

export default function RenamePage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("check");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [current, setCurrent] = useState("");
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const pid = localStorage.getItem("profile_id");
    const nick = localStorage.getItem("nickname");
    if (!pid || !nick) {
      setPhase("no_session");
      return;
    }
    setProfileId(pid);
    setCurrent(nick);
    setInput(nick);
    setPhase("ready");
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting || !profileId) return;
    const trimmed = input.trim();
    if (!trimmed) {
      setError("ニックネームを入力してください");
      return;
    }
    if (trimmed.length > 20) {
      setError("20文字以内で入力してください");
      return;
    }
    if (trimmed === current) {
      setError("現在のニックネームと同じです");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/profile/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: profileId, new_nickname: trimmed }),
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "nickname_taken")
          setError("そのニックネームはすでに使われています");
        else if (data.error === "profile_not_found")
          setError("セッションが無効です。トップからやり直してください");
        else if (data.error === "timeout")
          setError("接続がタイムアウトしました");
        else setError("エラーが発生しました。もう一度お試しください");
        return;
      }
      localStorage.setItem("nickname", data.nickname);
      router.push("/user/home");
    } catch (e) {
      setError(
        e instanceof Error && e.name === "TimeoutError"
          ? "接続がタイムアウトしました"
          : "エラーが発生しました。もう一度お試しください"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (phase === "check") {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (phase === "no_session") {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen px-6">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="text-5xl">🔑</div>
          <h1 className="text-xl font-bold text-gray-800">
            セッションがありません
          </h1>
          <p className="text-sm text-gray-500">
            名前を変更するには、まずトップからニックネームで入り直してください。
          </p>
          <Link
            href="/user"
            className="block w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-colors"
          >
            ニックネーム入力へ
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="text-5xl mb-4">✏️</div>
          <h1 className="text-2xl font-bold text-gray-800">
            ニックネームを変更
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            現在：<span className="font-semibold text-indigo-600">{current}</span>
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="新しいニックネーム"
            maxLength={20}
            className="w-full px-4 py-3 text-lg border-2 border-gray-200 focus:border-indigo-500 rounded-xl outline-none transition-colors"
            autoFocus
            disabled={isSubmitting}
          />
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting || !input.trim()}
            className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold rounded-2xl shadow transition-colors"
          >
            {isSubmitting ? "変更中..." : "変更する"}
          </button>
          <Link
            href="/user/home"
            className="block text-center text-xs text-gray-400 underline"
          >
            ← ホームへ戻る
          </Link>
        </form>
      </div>
    </main>
  );
}
```

> 備考: このページは機能優先で既存の indigo 系UIに合わせる。`feat/dev-console` は RPG マップ（emerald テーマ）マージ前の master 起点のため、統合後にホーム等と並ぶとやや色調が異なるが、本計画のスコープ外（必要なら将来テーマ統一）。

- [ ] **Step 2: ビルド**

Run（Bash）: `ADMIN_SESSION_SECRET=build-dummy DEV_SESSION_SECRET=build-dummy DEV_PASSCODE=build-dummy npm run build`
Expected: 成功。Route 一覧に `/user/rename` が出る。未使用警告なし。

- [ ] **Step 3: 手動確認（任意）**

`npm run dev`（env 付き）。(a) localStorage を空にして `/user/rename` → 「セッションがありません」＋`/user` 導線。(b) `/user` でニックネーム登録後 `/user/rename` → 現在名表示、新名で送信→ホームへ、`localStorage.nickname` 更新。(c) 既存の別名を入れると「すでに使われています」。ハング時はビルド成功を検証ゲートとする。

- [ ] **Step 4: Commit**

```bash
git add app/user/rename/page.tsx
git commit -m "feat: add user-facing nickname rename page

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review（計画作成者による確認済み）

- **Spec coverage**:
  - 認証（専用パスコード＋独立cookie）→ Task 1。ログイン/保護/`/dev/clear`移動 → Task 2。
  - 共有リンク・トップQR → Task 3（カード）＋ Task 4（配置）。
  - 名前変更リンク表示 → Task 4。名前変更ページ → Task 6。改名API（profile_idキー）→ Task 5。
  - `NEXT_PUBLIC_BASE_URL` 解決 → Task 4。env 例追記 → Task 1。運用アドバイスは spec に記載済み（実装不要）。
- **Placeholder scan**: TBD/TODO なし。全コードブロックは実コード。
- **Type consistency**: `LinkQrCardProps`（Task3）を Task4 がそのまま使用。`signDevToken`/`verifyDevToken`/`DEV_COOKIE_NAME`/`DEV_TTL_SECONDS`（Task1）を Task2/4 が使用。改名API契約 `{ profile_id, new_nickname } → { profile_id, nickname }`（Task5）を Task6 が一致利用。cookie属性は Global Constraints と各所で一致。
- **既知のスコープ外**: 名前変更ページの配色は indigo（RPGテーマ非適用）。ブランチ基点の都合で統合後に色調差が出るが本計画対象外。
