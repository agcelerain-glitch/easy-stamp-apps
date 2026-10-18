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
