"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import PullRefreshIndicator from "@/components/PullRefreshIndicator";
import { POINT_ICONS, POINT_LABELS, MAP_COLORS } from "@/lib/stamp-points";

type StampData = { stamp_point_id: number; stamped_at: string };

export default function UserHomePage() {
  const router = useRouter();
  const [nickname, setNickname]     = useState("");
  const [profileId, setProfileId]   = useState<string | null>(null);
  const [stamps, setStamps]         = useState<StampData[]>([]);
  const [loading, setLoading]       = useState(true);
  const [reloading, setReloading]   = useState(false);

  const fetchStamps = useCallback(async (pid: string) => {
    try {
      const res = await fetch(`/api/stamps?profile_id=${pid}`, {
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setStamps(data.stamps ?? []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const pid  = localStorage.getItem("profile_id");
    const nick = localStorage.getItem("nickname");
    if (!pid || !nick) {
      router.replace("/user");
      return;
    }
    setProfileId(pid);
    setNickname(nick);
    fetchStamps(pid).finally(() => setLoading(false));
  }, [router, fetchStamps]);

  // ── リロードボタン ──────────────────────────
  async function handleReload() {
    if (!profileId || reloading) return;
    setReloading(true);
    await fetchStamps(profileId);
    setReloading(false);
  }

  // ── プルリフレッシュ ────────────────────────
  const pullRefreshFn = useCallback(async () => {
    if (!profileId) return;
    await fetchStamps(profileId);
  }, [profileId, fetchStamps]);

  const { progress, isRefreshing, isPulling } = usePullToRefresh({
    onRefresh: pullRefreshFn,
  });

  const stampCount = stamps.length;
  const isComplete = stampCount === 5;

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

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
}
