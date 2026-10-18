"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import QRModal from "@/components/QRModal";
import CompleteAnimation from "@/components/CompleteAnimation";
import AdventureMap from "@/components/AdventureMap";
import { MAP_COLORS } from "@/lib/stamp-points";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import PullRefreshIndicator from "@/components/PullRefreshIndicator";

type StampData = { stamp_point_id: number; stamped_at: string };

export default function StampsPage() {
  const router = useRouter();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [nickname, setNickname]   = useState<string>("");
  const [stamps, setStamps]       = useState<StampData[]>([]);
  const [loading, setLoading]     = useState(true);

  const [qrModal, setQrModal] = useState<{
    pointId: number; token: string; expiresAt: string;
  } | null>(null);
  const [generatingPoint, setGeneratingPoint] = useState<number | null>(null);
  const [genError, setGenError] = useState("");
  const [reloading, setReloading] = useState(false);

  // アニメーション状態
  const [animatingPoints, setAnimatingPoints] = useState<Set<number>>(new Set());
  const [showComplete, setShowComplete] = useState(false);

  // 多重発火防止
  const stampedRef = useRef<Set<number>>(new Set());

  // ────────────────────────────────────────────
  // スタンプ取得（初回）
  // ────────────────────────────────────────────
  const loadStamps = useCallback(async (pid: string) => {
    try {
      const res = await fetch(`/api/stamps?profile_id=${pid}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return;
      const data = await res.json();
      const list: StampData[] = data.stamps ?? [];
      setStamps(list);
      list.forEach((s) => stampedRef.current.add(s.stamp_point_id));
    } catch {}
  }, []);

  // ────────────────────────────────────────────
  // Realtime で新スタンプを受け取ったときの処理
  // ────────────────────────────────────────────
  const handleNewStamp = useCallback((newStamp: StampData) => {
    const pointId = newStamp.stamp_point_id;

    // 多重発火ガード
    if (stampedRef.current.has(pointId)) return;
    stampedRef.current.add(pointId);

    setStamps((prev) => {
      const updated = [...prev, newStamp];

      // QRモーダルを閉じる
      setQrModal(null);

      // 個別スタンプアニメーション開始
      setAnimatingPoints((pts) => {
        const next = new Set(pts);
        next.add(pointId);
        return next;
      });

      // コンプリートは個別アニメーションが終わる直前に起動
      if (updated.length === 5) {
        setTimeout(() => setShowComplete(true), 1800);
      }

      return updated;
    });
  }, []);

  // ────────────────────────────────────────────
  // セッション確認 + 初回スタンプ取得 + Realtime 購読
  // ────────────────────────────────────────────
  useEffect(() => {
    const pid  = localStorage.getItem("profile_id");
    const nick = localStorage.getItem("nickname");
    if (!pid || !nick) {
      router.replace("/user");
      return;
    }
    setProfileId(pid);
    setNickname(nick);

    loadStamps(pid).finally(() => setLoading(false));

    // Supabase Realtime 購読
    const supabase = createClient();
    const channel = supabase
      .channel(`stamps:${pid}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "stamps",
          filter: `profile_id=eq.${pid}`,
        },
        (payload) => {
          handleNewStamp(payload.new as StampData);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router, loadStamps, handleNewStamp]);

  // ── プルリフレッシュ ────────────────────────
  const pullRefreshFn = useCallback(async () => {
    if (!profileId) return;
    await loadStamps(profileId);
  }, [profileId, loadStamps]);

  const { progress, isRefreshing, isPulling } = usePullToRefresh({
    onRefresh: pullRefreshFn,
  });

  // ────────────────────────────────────────────
  // QR コード発行
  // ────────────────────────────────────────────
  const isStamped = (pointId: number) =>
    stamps.some((s) => s.stamp_point_id === pointId);

  async function handleStampTap(pointId: number) {
    if (!profileId) return;
    if (isStamped(pointId)) return;
    if (generatingPoint) return;

    setGenError("");
    setGeneratingPoint(pointId);
    try {
      const res = await fetch("/api/otp/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: profileId, stamp_point_id: pointId }),
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "already_stamped") await loadStamps(profileId);
        else if (data.error === "timeout") setGenError("接続がタイムアウトしました");
        else setGenError("QRコードの生成に失敗しました");
        return;
      }
      setQrModal({ pointId, token: data.token, expiresAt: data.expires_at });
    } catch (e) {
      setGenError(
        e instanceof Error && e.name === "TimeoutError"
          ? "接続がタイムアウトしました"
          : "QRコードの生成に失敗しました"
      );
    } finally {
      setGeneratingPoint(null);
    }
  }

  function handleQrClose() {
    setQrModal(null);
    if (profileId) loadStamps(profileId);
  }

  async function handleReload() {
    if (!profileId || reloading) return;
    setReloading(true);
    await loadStamps(profileId);
    setReloading(false);
  }

  const stampCount = stamps.length;

  // ────────────────────────────────────────────
  // ローディング
  // ────────────────────────────────────────────
  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

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
}
