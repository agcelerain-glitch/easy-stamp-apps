"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import PullRefreshIndicator from "@/components/PullRefreshIndicator";

type StampData = { stamp_point_id: number; stamped_at: string };

const POINT_ICONS  = ["🗺️", "🏔️", "🌸", "⛩️", "🎊"];
const POINT_LABELS = ["ポイント①", "ポイント②", "ポイント③", "ポイント④", "ポイント⑤"];

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
    /* overscroll-none でブラウザ標準 PTR を無効化し、カスタム PTR を優先 */
    <main className="flex flex-col min-h-screen bg-gradient-to-b from-indigo-50 to-white overscroll-none">
      {/* ヘッダー */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-indigo-100 bg-white/80 backdrop-blur-sm">
        <Link href="/user/home" className="flex items-center gap-2 font-bold text-indigo-700">
          <span>🎯</span>
          <span>スタンプラリー</span>
        </Link>

        {/* リロードボタン */}
        <button
          onClick={handleReload}
          disabled={reloading || isRefreshing}
          aria-label="更新"
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium
                     text-indigo-600 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200
                     disabled:opacity-40 transition-colors"
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
      </header>

      {/* プルリフレッシュ インジケーター */}
      <PullRefreshIndicator
        progress={progress}
        isRefreshing={isRefreshing}
        isPulling={isPulling}
      />

      <div className="flex-1 px-4 py-6 max-w-sm mx-auto w-full flex flex-col gap-6">
        {/* ウェルカムセクション */}
        <div className="text-center">
          <p className="text-sm text-gray-400">ようこそ</p>
          <p className="text-2xl font-black text-indigo-700 mt-0.5">
            {nickname} さん
          </p>
        </div>

        {/* 進捗カード */}
        <div
          className={`rounded-3xl p-5 shadow-sm ${
            isComplete
              ? "bg-gradient-to-br from-yellow-400 to-orange-400"
              : "bg-white border border-indigo-100"
          }`}
        >
          {isComplete ? (
            <div className="text-center text-white">
              <p className="text-4xl mb-1">🎉</p>
              <p className="text-2xl font-black tracking-wide">コンプリート！</p>
              <p className="text-sm mt-1 text-yellow-100">全5カ所を制覇しました！</p>
            </div>
          ) : (
            <>
              <div className="flex items-end justify-between mb-3">
                <p className="text-sm text-gray-400">スタンプ収集状況</p>
                <p className="text-3xl font-black text-indigo-700 leading-none">
                  {stampCount}
                  <span className="text-base text-gray-400 ml-1">/ 5</span>
                </p>
              </div>
              <div className="w-full bg-indigo-100 rounded-full h-2.5">
                <div
                  className="bg-indigo-500 h-2.5 rounded-full transition-all duration-700"
                  style={{ width: `${(stampCount / 5) * 100}%` }}
                />
              </div>
            </>
          )}

          {/* スタンプ 5 枠ミニ表示 */}
          <div className="flex justify-between mt-4 gap-1">
            {[1, 2, 3, 4, 5].map((pid) => {
              const done = stamps.some((s) => s.stamp_point_id === pid);
              return (
                <div
                  key={pid}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-xs
                    ${done
                      ? isComplete
                        ? "bg-white/30 text-white"
                        : "bg-indigo-600 text-white"
                      : isComplete
                      ? "bg-white/20 text-yellow-100"
                      : "bg-indigo-50 text-gray-300"
                    }`}
                >
                  <span className="text-lg leading-none">{POINT_ICONS[pid - 1]}</span>
                  <span className="font-semibold">{done ? "✓" : "−"}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 未取得ポイントの一覧 */}
        {!isComplete && (
          <div className="space-y-2">
            <p className="text-xs text-gray-400 font-semibold tracking-wide">
              残りのポイント
            </p>
            {[1, 2, 3, 4, 5]
              .filter((pid) => !stamps.some((s) => s.stamp_point_id === pid))
              .map((pid) => (
                <div
                  key={pid}
                  className="flex items-center gap-3 px-4 py-2.5 bg-white border border-gray-100
                             rounded-xl text-sm text-gray-600"
                >
                  <span className="text-xl">{POINT_ICONS[pid - 1]}</span>
                  <span>{POINT_LABELS[pid - 1]}</span>
                </div>
              ))}
          </div>
        )}

        {/* スタンプを集めるボタン */}
        <Link
          href="/user/stamps"
          className="block w-full text-center py-4 px-6 bg-indigo-600 hover:bg-indigo-700
                     active:bg-indigo-800 text-white text-lg font-bold rounded-2xl shadow-md
                     transition-colors duration-150"
        >
          {isComplete ? "スタンプボードを見る" : "スタンプを集める →"}
        </Link>

        {/* ヒント */}
        <p className="text-center text-xs text-gray-300">
          下に引っ張って更新できます
        </p>
      </div>

      {/* 開発者用リンク（最下部・極小） */}
      <div className="text-center py-4">
        <Link
          href="/dev/clear"
          className="text-[10px] text-gray-200 hover:text-gray-400 transition-colors"
        >
          dev: cache
        </Link>
      </div>
    </main>
  );
}
