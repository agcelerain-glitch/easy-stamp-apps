"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import QRModal from "@/components/QRModal";
import StampAnimation from "@/components/StampAnimation";
import CompleteAnimation from "@/components/CompleteAnimation";

type StampData = { stamp_point_id: number; stamped_at: string };

const POINT_LABELS = ["ポイント①", "ポイント②", "ポイント③", "ポイント④", "ポイント⑤"];
const POINT_ICONS  = ["🗺️", "🏔️", "🌸", "⛩️", "🎊"];

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

  function handleLogout() {
    localStorage.removeItem("profile_id");
    localStorage.removeItem("nickname");
    router.push("/");
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
    <main className="flex flex-col min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      {/* ヘッダー */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-indigo-100 bg-white/80 backdrop-blur-sm">
        <Link href="/user/home" className="flex items-center gap-2 font-bold text-indigo-700">
          <span>🎯</span>
          <span>スタンプラリー</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{nickname}</span>
          <button
            onClick={handleLogout}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            終了
          </button>
        </div>
      </header>

      <div className="flex-1 px-4 py-6 max-w-sm mx-auto w-full">
        {/* 進捗 */}
        <div className="text-center mb-6">
          {stampCount === 5 && !showComplete ? (
            <div className="py-3 px-4 bg-yellow-100 rounded-2xl">
              <p className="text-2xl font-bold text-yellow-700">🎉 コンプリート！</p>
              <p className="text-sm text-yellow-600 mt-1">全5カ所を制覇しました！</p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-500">スタンプ収集状況</p>
              <p className="text-3xl font-bold text-indigo-700">
                {stampCount} <span className="text-lg text-gray-400">/ 5</span>
              </p>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-indigo-500 h-2 rounded-full transition-all duration-700"
                  style={{ width: `${(stampCount / 5) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {genError && (
          <p className="mb-4 text-sm text-center text-red-500">{genError}</p>
        )}

        {/* スタンプグリッド */}
        <div className="grid grid-cols-1 gap-3">
          {[1, 2, 3, 4, 5].map((pointId) => {
            const stamped    = isStamped(pointId);
            const generating = generatingPoint === pointId;
            const isAnim     = animatingPoints.has(pointId);

            return (
              <button
                key={pointId}
                onClick={() => handleStampTap(pointId)}
                disabled={stamped || !!generatingPoint}
                className={`
                  relative flex items-center gap-4 w-full p-4 rounded-2xl border-2
                  transition-all duration-300
                  ${
                    stamped
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "bg-white border-gray-200 hover:border-indigo-400 active:bg-indigo-50"
                  }
                `}
              >
                <div className="text-3xl">{POINT_ICONS[pointId - 1]}</div>
                <div className="flex-1 text-left">
                  <p className={`font-bold ${stamped ? "text-white" : "text-gray-800"}`}>
                    {POINT_LABELS[pointId - 1]}
                  </p>
                  <p className={`text-xs ${stamped ? "text-indigo-200" : "text-gray-400"}`}>
                    {stamped
                      ? "スタンプ済み ✓"
                      : generating
                      ? "QRコード生成中..."
                      : "タップしてQRコードを表示"}
                  </p>
                </div>
                {stamped && !isAnim && <div className="text-2xl">✅</div>}
                {generating && (
                  <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                )}

                {/* 個別スタンプアニメーション */}
                {isAnim && (
                  <StampAnimation
                    icon={POINT_ICONS[pointId - 1]}
                    onComplete={() =>
                      setAnimatingPoints((pts) => {
                        const next = new Set(pts);
                        next.delete(pointId);
                        return next;
                      })
                    }
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

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
