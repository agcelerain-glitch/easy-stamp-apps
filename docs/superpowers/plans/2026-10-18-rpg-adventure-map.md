# RPG冒険マップ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スタンプラリーの5スタンプ表示を、エメラルド配色のRPG冒険マップ（縦ジグザグの道・ノード状態・次の目的地強調）へ刷新し、ホームを調和させる。

**Architecture:** 表示専用の新コンポーネント `AdventureMap` にマップ描画（CSS地形＋SVGの道＋状態別ノード）を分離する。`app/user/stamps/page.tsx` のロジック（Realtime購読・QR生成・プルリフレッシュ・多重発火ガード）は現状維持で表示層のみ差し替え、固定ヘッダー／下部HUDを再構成する。ホームは新配色とミニ地図へ調和させる。

**Tech Stack:** Next.js 16.3.5 (App Router, client components) / React 19 / Tailwind CSS v4 / SVG + CSS keyframes。重いライブラリ追加なし。

## 検証方針（重要）

本プロジェクトにはテストランナーが無く（`package.json` のスクリプトは `dev`/`build`/`start` のみ）、今回は純粋なビジュアルデザイン変更である。したがって各タスクの検証は **`npm run build`（型チェック＋コンパイル成功）＋ `npm run dev` での目視確認** とする。ユニットテストは書かない（基盤が無く、成果物がビジュアルであるため）。

## Global Constraints

- Node 20 互換を維持（`engines: node >=20.0.0`）。
- `@supabase/supabase-js` は `^2.49.4`（2.49系）固定。依存追加は行わない（SVG＋CSSのみで実装）。
- 既存の `"use client"`／Realtime購読／QRモーダル／プルリフレッシュ／多重発火ガードの挙動を壊さない。
- 配色は「エメラルド・クエスト」パレット（spec参照）に統一。進行はハードロック無しの自由順、全ポイント常時タップ可能。
- 作業ブランチ `feat/rpg-adventure-map`。コミット末尾に `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。
- **AGENTS.md準拠**: コード着手前に `node_modules/next/dist/docs/` の関連ガイド（App Router / client component / CSS）を確認し、Next 16 固有の差異が無いか確かめる。
- spec: `docs/superpowers/specs/2026-10-18-rpg-adventure-map-design.md`

---

### Task 1: 共有定数モジュール `lib/stamp-points.ts`

ポイントのラベル／アイコン、マップ配色、ノード座標、「次の目的地」判定を1ファイルに集約する。現状 `home` と `stamps` に重複している `POINT_LABELS`/`POINT_ICONS` をここへ寄せてDRY化する。

**Files:**
- Create: `lib/stamp-points.ts`

**Interfaces:**
- Consumes: なし
- Produces:
  - `TOTAL_POINTS: number`（= 5）
  - `POINT_IDS: readonly [1,2,3,4,5]`
  - `POINT_LABELS: string[]` / `POINT_ICONS: string[]`
  - `NODE_POSITIONS: { x: number; y: number }[]`（％座標・5要素）
  - `MAP_COLORS: { bgTop; bgBottom; land; sea; road; roadFaint; goal; nodeDone: string }`
  - `nextRecommendedPoint(stampedIds: number[]): number | null`

- [ ] **Step 1: Preflight（AGENTS.md準拠のドキュメント確認）**

Run（client component / CSS に関する差異が無いか確認）:
```bash
ls node_modules/next/dist/docs/ && sed -n '1,40p' node_modules/next/dist/docs/*client* 2>/dev/null | head -60
```
Expected: ガイド一覧が表示される。致命的な差異が無ければ次へ。

- [ ] **Step 2: `lib/stamp-points.ts` を作成**

```ts
export const TOTAL_POINTS = 5;
export const POINT_IDS = [1, 2, 3, 4, 5] as const;

export const POINT_LABELS = [
  "ポイント①",
  "ポイント②",
  "ポイント③",
  "ポイント④",
  "ポイント⑤",
];

export const POINT_ICONS = ["🗺️", "🏔️", "🌸", "⛩️", "🎊"];

// RPG冒険マップ上のノード配置（コンテナ幅・高さに対する％）。上→下で冒険が進む。
export const NODE_POSITIONS = [
  { x: 30, y: 8 },
  { x: 68, y: 27 },
  { x: 28, y: 50 },
  { x: 70, y: 72 },
  { x: 40, y: 92 },
];

// エメラルド・クエスト パレット（SVG stroke や背景グラデで使用）
export const MAP_COLORS = {
  bgTop: "#0f3d3e",
  bgBottom: "#14532d",
  land: "#2f8f5b",
  sea: "#0e7490",
  road: "#facc15",
  roadFaint: "rgba(250, 204, 21, 0.25)",
  goal: "#fde047",
  nodeDone: "#10b981",
};

/** 未取得のうち最小番号を「次の目的地」として返す。全取得なら null。 */
export function nextRecommendedPoint(stampedIds: number[]): number | null {
  const done = new Set(stampedIds);
  for (const id of POINT_IDS) {
    if (!done.has(id)) return id;
  }
  return null;
}
```

- [ ] **Step 3: 型チェック・ビルド**

Run: `npm run build`
Expected: 成功（`lib/stamp-points.ts` はまだ未使用だが型エラー無し）。

- [ ] **Step 4: ロジックの妥当性を確認（目視）**

`nextRecommendedPoint([]) === 1`、`nextRecommendedPoint([1,2]) === 3`、`nextRecommendedPoint([1,2,3,4,5]) === null` を頭の中で辿って確認。

- [ ] **Step 5: Commit**

```bash
git add lib/stamp-points.ts
git commit -m "feat: add shared stamp-point constants and next-destination helper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: CSSキーフレーム追加（`app/globals.css`）

「次の目的地」の脈動と達成ノードの発光のキーフレームを追加する。道の点灯はSVGのインライン transition で行うため keyframe 不要。

**Files:**
- Modify: `app/globals.css`（ファイル末尾に追記）

**Interfaces:**
- Consumes: なし
- Produces: CSSアニメーション名 `beacon-pulse`、`node-glow`

- [ ] **Step 1: `app/globals.css` の末尾に追記**

```css
/* ─── RPG冒険マップ ─── */

/* 次の目的地：金のビーコンが脈動 */
@keyframes beacon-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(250, 204, 21, 0.7), 0 0 18px 4px rgba(250, 204, 21, 0.35);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(250, 204, 21, 0), 0 0 26px 8px rgba(250, 204, 21, 0.5);
  }
}

/* 制覇済みノード：エメラルドの発光 */
@keyframes node-glow {
  0%, 100% { box-shadow: 0 0 14px 2px rgba(16, 185, 129, 0.55); }
  50%      { box-shadow: 0 0 22px 6px rgba(16, 185, 129, 0.8); }
}
```

- [ ] **Step 2: ビルド**

Run: `npm run build`
Expected: 成功（CSSコンパイル通過）。

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: add beacon-pulse and node-glow keyframes for adventure map

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `AdventureMap` コンポーネント作成

地形背景・SVGの蛇行する道・状態別ノード・「次の目的地」ハイライト・装飾を描画する表示専用コンポーネント。データ取得やQR生成は持たない。

**Files:**
- Create: `components/AdventureMap.tsx`

**Interfaces:**
- Consumes（Task 1 から）: `POINT_IDS`, `POINT_LABELS`, `POINT_ICONS`, `NODE_POSITIONS`, `MAP_COLORS`, `TOTAL_POINTS`, `nextRecommendedPoint`。既存 `components/StampAnimation.tsx`（`{ icon: string; onComplete: () => void }`）。
- Produces（Task 4 が利用）: デフォルトエクスポート `AdventureMap`、props:
  ```ts
  interface AdventureMapProps {
    stampedIds: number[];
    animatingPoints: Set<number>;
    generatingPoint: number | null;
    onTapPoint: (pointId: number) => void;
    onAnimationComplete: (pointId: number) => void;
  }
  ```

- [ ] **Step 1: `components/AdventureMap.tsx` を作成**

```tsx
"use client";

import StampAnimation from "@/components/StampAnimation";
import {
  POINT_IDS,
  POINT_LABELS,
  POINT_ICONS,
  NODE_POSITIONS,
  MAP_COLORS,
  TOTAL_POINTS,
  nextRecommendedPoint,
} from "@/lib/stamp-points";

interface AdventureMapProps {
  stampedIds: number[];
  animatingPoints: Set<number>;
  generatingPoint: number | null;
  onTapPoint: (pointId: number) => void;
  onAnimationComplete: (pointId: number) => void;
}

// ノード座標（viewBox 0..100）を通る滑らかなS字パスを生成
function buildRoutePath(): string {
  const pts = NODE_POSITIONS;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const midY = (prev.y + cur.y) / 2;
    d += ` C ${prev.x} ${midY}, ${cur.x} ${midY}, ${cur.x} ${cur.y}`;
  }
  return d;
}

const ROUTE_D = buildRoutePath();

export default function AdventureMap({
  stampedIds,
  animatingPoints,
  generatingPoint,
  onTapPoint,
  onAnimationComplete,
}: AdventureMapProps) {
  const stampedSet = new Set(stampedIds);
  const nextPoint = nextRecommendedPoint(stampedIds);
  // 道の点灯：集めたスタンプ数に比例して金の実線を延ばす
  const revealed = stampedIds.length / (TOTAL_POINTS - 1);
  const roadOffset = Math.max(0, 1 - revealed);

  return (
    <div
      className="relative w-full h-[640px] rounded-3xl overflow-hidden border border-emerald-800/50"
      style={{
        background: `linear-gradient(to bottom, ${MAP_COLORS.bgTop}, ${MAP_COLORS.bgBottom})`,
      }}
    >
      {/* 地形の装飾ブロブ（海・陸） */}
      <div
        className="absolute -left-10 top-24 w-48 h-48 rounded-full blur-2xl opacity-40"
        style={{ background: MAP_COLORS.sea }}
      />
      <div
        className="absolute -right-12 top-1/2 w-56 h-56 rounded-full blur-2xl opacity-30"
        style={{ background: MAP_COLORS.land }}
      />

      {/* 装飾絵文字 */}
      <span className="absolute left-6 top-[40%] text-2xl opacity-70 pointer-events-none select-none">🌲</span>
      <span className="absolute right-8 top-[60%] text-2xl opacity-70 pointer-events-none select-none">🌊</span>
      <span className="absolute left-10 top-[82%] text-2xl opacity-60 pointer-events-none select-none">⛰️</span>

      {/* 道（SVG） */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {/* 未踏区間（点線・半透明） */}
        <path
          d={ROUTE_D}
          fill="none"
          stroke={MAP_COLORS.roadFaint}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeDasharray="0.6 2.2"
          vectorEffect="non-scaling-stroke"
        />
        {/* 達成区間（金・実線、進捗で延びる） */}
        <path
          d={ROUTE_D}
          fill="none"
          stroke={MAP_COLORS.road}
          strokeWidth={2.8}
          strokeLinecap="round"
          pathLength={1}
          style={{
            strokeDasharray: 1,
            strokeDashoffset: roadOffset,
            transition: "stroke-dashoffset 0.9s ease",
          }}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* ノード */}
      {POINT_IDS.map((pointId, idx) => {
        const pos = NODE_POSITIONS[idx];
        const stamped = stampedSet.has(pointId);
        const isNext = pointId === nextPoint;
        const generating = generatingPoint === pointId;
        const isAnim = animatingPoints.has(pointId);
        const isGoal = pointId === TOTAL_POINTS;

        return (
          <div
            key={pointId}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            <button
              onClick={() => onTapPoint(pointId)}
              disabled={stamped || !!generatingPoint}
              aria-label={`${POINT_LABELS[idx]}${stamped ? "（制覇済み）" : ""}`}
              className={`
                relative flex items-center justify-center w-16 h-16 rounded-full
                border-2 transition-transform active:scale-95
                ${
                  stamped
                    ? "bg-emerald-700 border-emerald-300 text-white"
                    : isNext
                    ? "bg-emerald-900/80 border-yellow-300 text-white"
                    : "bg-emerald-950/70 border-emerald-700/60 text-emerald-200"
                }
              `}
              style={
                stamped
                  ? { animation: "node-glow 2.4s ease-in-out infinite" }
                  : isNext
                  ? { animation: "beacon-pulse 1.6s ease-in-out infinite" }
                  : undefined
              }
            >
              <span className="text-2xl leading-none select-none">
                {isGoal && !stamped ? "🎁" : POINT_ICONS[idx]}
              </span>

              {/* 番号バッジ */}
              <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-black/40 text-[10px] font-bold flex items-center justify-center">
                {pointId}
              </span>

              {/* 状態バッジ */}
              {stamped ? (
                <span className="absolute -bottom-1 -right-1 text-sm">✓</span>
              ) : isNext ? (
                <span className="absolute -bottom-1 -right-1 text-sm">❗</span>
              ) : (
                <span className="absolute -bottom-1 -right-1 text-xs text-emerald-300/70">？</span>
              )}

              {/* QR生成中スピナー */}
              {generating && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30">
                  <div className="w-5 h-5 border-2 border-yellow-300 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {/* 取得アニメーション（既存の判子演出を流用） */}
              {isAnim && (
                <StampAnimation
                  icon={POINT_ICONS[idx]}
                  onComplete={() => onAnimationComplete(pointId)}
                />
              )}
            </button>

            {/* ラベル */}
            <span
              className={`mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                stamped
                  ? "bg-emerald-600/80 text-white"
                  : isNext
                  ? "bg-yellow-400 text-emerald-950"
                  : "bg-black/30 text-emerald-100"
              }`}
            >
              {isGoal ? "GOAL" : stamped ? "制覇" : isNext ? "次はここ！" : "未踏の地"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: ビルド（型・コンパイル確認）**

Run: `npm run build`
Expected: 成功。`AdventureMap` の型エラー無し（props・import整合）。

- [ ] **Step 3: Commit**

```bash
git add components/AdventureMap.tsx
git commit -m "feat: add AdventureMap component (RPG map svg route + node states)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: スタンプ画面に統合＋固定ヘッダー／下部HUD（`app/user/stamps/page.tsx`）

既存ロジックは維持し、表示層（進捗ブロック＋スタンプグリッド）を `AdventureMap` に差し替える。sticky スリムヘッダーと fixed ボトムHUD（進捗＋更新＋ホーム）を追加する。

**Files:**
- Modify: `app/user/stamps/page.tsx`

**Interfaces:**
- Consumes（Task 3 から）: `AdventureMap`（props は Task 3 定義）。（Task 1 から）`MAP_COLORS`。
- Produces: なし（画面の最終形）

- [ ] **Step 1: import を調整**

既存の import 群に以下を追加：
```tsx
import AdventureMap from "@/components/AdventureMap";
import { MAP_COLORS } from "@/lib/stamp-points";
```
ファイル冒頭にあるローカル定数 `POINT_LABELS` / `POINT_ICONS`（15〜16行目付近）を**削除**する（グリッド撤去により未使用になるため）。`StampAnimation` の直接 import も不要になるため削除する（`AdventureMap` 内部で使用）。

- [ ] **Step 2: 手動リロード用の状態とハンドラを追加**

`const [genError, setGenError] = useState("");` の近く（state宣言群）に追加：
```tsx
  const [reloading, setReloading] = useState(false);
```
`handleQrClose` 関数の直後に追加：
```tsx
  async function handleReload() {
    if (!profileId || reloading) return;
    setReloading(true);
    await loadStamps(profileId);
    setReloading(false);
  }
```

- [ ] **Step 3: `return (...)` を全面置換**

ローディング分岐（`if (loading) { ... }`）はそのまま残し、その後ろの `return (` 以降を以下へ置き換える：

```tsx
  return (
    <main
      className="relative flex flex-col min-h-screen overscroll-none text-white"
      style={{
        background: `linear-gradient(to bottom, ${MAP_COLORS.bgTop}, ${MAP_COLORS.bgBottom})`,
      }}
    >
      {/* sticky スリムヘッダー */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 h-11 bg-emerald-950/70 backdrop-blur-sm border-b border-emerald-800/50">
        <Link href="/user/home" className="flex items-center gap-1.5 font-bold text-yellow-300 text-sm">
          <span>🗺️</span>
          <span>スタンプの冒険</span>
        </Link>
        <span className="text-xs text-emerald-200/80">{nickname}</span>
      </header>

      {/* プルリフレッシュ インジケーター */}
      <PullRefreshIndicator
        progress={progress}
        isRefreshing={isRefreshing}
        isPulling={isPulling}
      />

      {/* マップ本体（下部HUD分の余白 pb-24） */}
      <div className="flex-1 px-4 pt-4 pb-24 max-w-sm mx-auto w-full">
        {genError && (
          <p className="mb-3 text-sm text-center text-red-300">{genError}</p>
        )}

        <AdventureMap
          stampedIds={stamps.map((s) => s.stamp_point_id)}
          animatingPoints={animatingPoints}
          generatingPoint={generatingPoint}
          onTapPoint={handleStampTap}
          onAnimationComplete={(pointId) =>
            setAnimatingPoints((pts) => {
              const next = new Set(pts);
              next.delete(pointId);
              return next;
            })
          }
        />
      </div>

      {/* fixed ボトムHUD */}
      <nav
        className="fixed bottom-0 inset-x-0 z-30 bg-emerald-950/85 backdrop-blur-sm border-t border-emerald-800/60"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="max-w-sm mx-auto w-full flex items-center justify-between gap-3 px-4 py-2.5">
          {/* 進捗 */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-yellow-300">🏴 {stampCount}/5 制覇</p>
            <div className="mt-1 w-full bg-emerald-800/60 rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full transition-all duration-700"
                style={{ width: `${(stampCount / 5) * 100}%`, background: MAP_COLORS.road }}
              />
            </div>
          </div>

          {/* 更新 */}
          <button
            onClick={handleReload}
            disabled={reloading || isRefreshing}
            aria-label="更新"
            className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-emerald-950 bg-yellow-300 active:bg-yellow-400 disabled:opacity-40 transition-colors"
          >
            <svg
              width="13" height="13" viewBox="0 0 20 20"
              fill="none" stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round"
              className={reloading || isRefreshing ? "animate-spin" : ""}
            >
              <path d="M4 4a8 8 0 1 1 0 12" />
              <path d="M4 8V4H0" />
            </svg>
            更新
          </button>

          {/* ホーム */}
          <Link
            href="/user/home"
            aria-label="ホーム"
            className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-emerald-100 bg-emerald-800/70 active:bg-emerald-700 transition-colors"
          >
            🏠 ホーム
          </Link>
        </div>
      </nav>

      {/* QR モーダル */}
      {qrModal && (
        <QRModal
          pointId={qrModal.pointId}
          token={qrModal.token}
          expiresAt={qrModal.expiresAt}
          onClose={handleQrClose}
        />
      )}

      {/* コンプリートアニメーション */}
      {showComplete && (
        <CompleteAnimation onComplete={() => setShowComplete(false)} />
      )}
    </main>
  );
```

> 備考: 旧「進捗ブロック（stampCount===5 のバナー＋進捗バー）」と「スタンプグリッド」は撤去。コンプリートは従来どおり `CompleteAnimation` が発火し、下部HUDが 5/5 を表示する。spec の下部HUD右側は「更新／管理者」としていたが、管理者ログインはホームに存在するため、ユーザーの回遊性を優先し本画面では「更新／ホーム」とする（実装者判断の明示）。

- [ ] **Step 4: ビルド**

Run: `npm run build`
Expected: 成功。未使用 import 警告が出た場合は該当 import を削除して解消。

- [ ] **Step 5: 目視確認（dev）**

Run: `npm run dev` → ブラウザ（スマホ幅・DevTools device toolbar）で `/user/stamps` を開く。ローカルストレージに `profile_id` と `nickname` が無い場合は `/user` から先にニックネーム登録。
確認項目:
1. エメラルド配色のマップが表示され、5ノードがジグザグ配置され道でつながっている。
2. 未取得の最小番号ノードが金色に脈動し「次はここ！」ラベルが出る。
3. ノードをタップ→QRモーダルが開く（既存挙動）。
4. 上部ヘッダーが sticky、下部HUDが fixed でスクロールしても追従。進捗バーが現在値を表示。
5. 「更新」でスピナー→再取得、「ホーム」で `/user/home` へ遷移。

- [ ] **Step 6: Commit**

```bash
git add app/user/stamps/page.tsx
git commit -m "feat: render stamps page as RPG adventure map with fixed header/HUD

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: ホーム画面の調和（`app/user/home/page.tsx`）

新配色へ寄せ、ミニ5枠を「ミニ地図」（横一列ノード＋点線）に、CTAを「冒険に出る 🗺️」に変更する。ロジック（取得・PTR・リロード）は変更しない。

**Files:**
- Modify: `app/user/home/page.tsx`

**Interfaces:**
- Consumes（Task 1 から）: `POINT_ICONS`, `POINT_LABELS`, `MAP_COLORS`
- Produces: なし

- [ ] **Step 1: import を調整**

冒頭のローカル定数 `POINT_ICONS` / `POINT_LABELS`（11〜12行目付近）を**削除**し、import を追加：
```tsx
import { POINT_ICONS, POINT_LABELS, MAP_COLORS } from "@/lib/stamp-points";
```

- [ ] **Step 2: `return (...)`（ローディング分岐の後）を全面置換**

```tsx
  return (
    <main
      className="flex flex-col min-h-screen overscroll-none text-white"
      style={{
        background: `linear-gradient(to bottom, ${MAP_COLORS.bgTop}, ${MAP_COLORS.bgBottom})`,
      }}
    >
      {/* ヘッダー */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-emerald-800/50 bg-emerald-950/60 backdrop-blur-sm">
        <Link href="/user/home" className="flex items-center gap-2 font-bold text-yellow-300">
          <span>🗺️</span>
          <span>スタンプの冒険</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReload}
            disabled={reloading || isRefreshing}
            aria-label="更新"
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-emerald-950 bg-yellow-300 active:bg-yellow-400 disabled:opacity-40 transition-colors"
          >
            <svg
              width="14" height="14" viewBox="0 0 20 20"
              fill="none" stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round"
              className={reloading || isRefreshing ? "animate-spin" : ""}
            >
              <path d="M4 4a8 8 0 1 1 0 12" />
              <path d="M4 8V4H0" />
            </svg>
            {reloading || isRefreshing ? "更新中" : "更新"}
          </button>

          <Link
            href="/admin"
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-emerald-200/70 bg-emerald-900/60 active:bg-emerald-800 transition-colors"
            aria-label="管理者ログイン"
          >
            <svg
              width="13" height="13" viewBox="0 0 20 20"
              fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
            >
              <rect x="3" y="9" width="14" height="10" rx="2" />
              <path d="M7 9V6a3 3 0 0 1 6 0v3" />
            </svg>
            管理者
          </Link>
        </div>
      </header>

      {/* プルリフレッシュ インジケーター */}
      <PullRefreshIndicator
        progress={progress}
        isRefreshing={isRefreshing}
        isPulling={isPulling}
      />

      <div className="flex-1 px-4 py-6 max-w-sm mx-auto w-full flex flex-col gap-6">
        {/* ウェルカム */}
        <div className="text-center">
          <p className="text-sm text-emerald-200/70">ようこそ、冒険者</p>
          <p className="text-2xl font-black text-yellow-300 mt-0.5">{nickname} さん</p>
        </div>

        {/* 進捗カード */}
        <div
          className={`rounded-3xl p-5 shadow-lg ${
            isComplete
              ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-emerald-950"
              : "bg-emerald-900/60 border border-emerald-700/50"
          }`}
        >
          {isComplete ? (
            <div className="text-center">
              <p className="text-4xl mb-1">🏆</p>
              <p className="text-2xl font-black tracking-wide">クエストクリア！</p>
              <p className="text-sm mt-1">全5カ所を制覇しました！</p>
            </div>
          ) : (
            <>
              <div className="flex items-end justify-between mb-3">
                <p className="text-sm text-emerald-200/70">冒険の進捗</p>
                <p className="text-3xl font-black text-yellow-300 leading-none">
                  {stampCount}
                  <span className="text-base text-emerald-200/60 ml-1">/ 5</span>
                </p>
              </div>
              <div className="w-full bg-emerald-800/60 rounded-full h-2.5">
                <div
                  className="h-2.5 rounded-full transition-all duration-700"
                  style={{ width: `${(stampCount / 5) * 100}%`, background: MAP_COLORS.road }}
                />
              </div>
            </>
          )}

          {/* ミニ地図（横一列ノード＋点線） */}
          <div className="relative flex justify-between items-center mt-4">
            <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-emerald-600/50" />
            {[1, 2, 3, 4, 5].map((pid) => {
              const done = stamps.some((s) => s.stamp_point_id === pid);
              return (
                <div
                  key={pid}
                  className={`relative z-10 flex items-center justify-center w-9 h-9 rounded-full border-2 text-sm ${
                    done
                      ? "bg-emerald-500 border-emerald-200 text-white"
                      : "bg-emerald-950/80 border-emerald-700 text-emerald-300/70"
                  }`}
                >
                  {done ? "✓" : POINT_ICONS[pid - 1]}
                </div>
              );
            })}
          </div>
        </div>

        {/* 未踏の地（残りのポイント） */}
        {!isComplete && (
          <div className="space-y-2">
            <p className="text-xs text-emerald-200/60 font-semibold tracking-wide">
              未踏の地
            </p>
            {[1, 2, 3, 4, 5]
              .filter((pid) => !stamps.some((s) => s.stamp_point_id === pid))
              .map((pid) => (
                <div
                  key={pid}
                  className="flex items-center gap-3 px-4 py-2.5 bg-emerald-900/40 border border-emerald-700/40 rounded-xl text-sm text-emerald-100"
                >
                  <span className="text-xl">{POINT_ICONS[pid - 1]}</span>
                  <span>{POINT_LABELS[pid - 1]}</span>
                </div>
              ))}
          </div>
        )}

        {/* CTA */}
        <Link
          href="/user/stamps"
          className="block w-full text-center py-4 px-6 bg-yellow-300 active:bg-yellow-400 text-emerald-950 text-lg font-black rounded-2xl shadow-md transition-colors duration-150"
        >
          {isComplete ? "冒険の地図を見る 🗺️" : "冒険に出る 🗺️"}
        </Link>

        <p className="text-center text-xs text-emerald-200/40">
          下に引っ張って更新できます
        </p>
      </div>

      {/* 開発者用リンク */}
      <div className="text-center py-4">
        <Link
          href="/dev/clear"
          className="text-[10px] text-emerald-200/20 hover:text-emerald-200/40 transition-colors"
        >
          dev: cache
        </Link>
      </div>
    </main>
  );
```

- [ ] **Step 3: ビルド**

Run: `npm run build`
Expected: 成功。未使用 import 警告が出たら解消。

- [ ] **Step 4: 目視確認（dev）**

`/user/home` を開く。確認項目:
1. エメラルド背景＋金アクセントの配色になっている。
2. 進捗カード内のミニ地図（横一列ノード＋点線）が取得状況を反映。
3. CTA が「冒険に出る 🗺️」（コンプリート時「冒険の地図を見る 🗺️」）。
4. 更新・管理者ボタンが動作し、配色が調和している。
5. スタンプ画面との配色・世界観が統一されている。

- [ ] **Step 5: Commit**

```bash
git add app/user/home/page.tsx
git commit -m "feat: harmonize home page with emerald adventure theme and mini-map

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: 全体フロー目視検証と仕上げ

**Files:**
- （コード変更なし。問題があれば該当タスクのファイルを微調整）

- [ ] **Step 1: 本番ビルド**

Run: `npm run build`
Expected: 成功（警告ゼロが望ましい）。

- [ ] **Step 2: 全体フローの目視確認（dev）**

Run: `npm run dev`、スマホ幅で実施。
1. `/user` → ニックネーム登録 → `/user/home`（新テーマ）。
2. 「冒険に出る 🗺️」→ `/user/stamps`（マップ表示）。
3. 「次はここ！」ノードをタップ→QR表示。可能なら管理者スキャンまで通し、取得時の判子アニメ＋ノード発光＋道の点灯を確認。
4. 5個取得でコンプリート演出（紙吹雪）が発火し、下部HUD/ホームが 5/5・クエストクリア表示になる。
5. sticky ヘッダー / fixed 下部HUD がスクロール追従し、セーフエリアでホームバーに被らない。
6. プルリフレッシュが両画面で動作。

- [ ] **Step 3: 仕上げ（必要時のみ）**

ノード座標 `NODE_POSITIONS`・コンテナ高さ `h-[640px]`・装飾位置は目視で調整可（`lib/stamp-points.ts` / `AdventureMap.tsx`）。調整したら再度ビルド＋目視。

- [ ] **Step 4: 最終コミット（調整した場合のみ）**

```bash
git add -A
git commit -m "polish: tune adventure map node layout and spacing

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review（計画作成者による確認済み）

- **Spec coverage**: 方向性/描画/配色/進行/範囲/固定ヘッダーの各決定 → Task 1〜5 に対応。道の点灯=Task3、次の目的地強調=Task1(helper)+Task3、ホーム調和=Task5、固定HUD=Task4。
- **Placeholder scan**: TBD/TODO 無し。全コードブロックは実コードを記載。
- **Type consistency**: `AdventureMapProps`（Task3定義）を Task4 がそのまま使用。`nextRecommendedPoint`/`MAP_COLORS`/`POINT_*` の名称が Task1 定義と Task3/4/5 の利用で一致。
- **既知の実装者判断**: 下部HUD右は spec の「管理者」ではなく「更新／ホーム」（管理者はホームに存在、回遊性優先）。spec からの意図的逸脱として明記。
