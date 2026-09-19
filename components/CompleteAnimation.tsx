"use client";

import { useEffect, useMemo } from "react";

interface Props {
  onComplete: () => void;
}

const COLORS = [
  "#fbbf24", "#f87171", "#34d399", "#60a5fa",
  "#a78bfa", "#f472b6", "#fb923c", "#22d3ee",
  "#a3e635", "#e879f9", "#fde047", "#86efac",
];

interface ConfettiPiece {
  id: number;
  left: number;
  color: string;
  w: number;
  h: number;
  delay: number;
  duration: number;
  rotate: number;
  isCircle: boolean;
}

const STAR_POSITIONS = [
  { top: "18%",  left: "12%" },
  { top: "14%",  right: "14%" },
  { top: "42%",  left: "6%" },
  { top: "42%",  right: "6%" },
  { bottom: "28%", left: "14%" },
  { bottom: "24%", right: "12%" },
  { top: "22%",  left: "38%" },
  { top: "22%",  right: "38%" },
];
const STAR_ICONS = ["⭐", "✨", "🌟", "💫", "✨", "🌟", "⭐", "💫"];

export default function CompleteAnimation({ onComplete }: Props) {
  // コンポーネントマウント時に一度だけ生成
  const pieces = useMemo<ConfettiPiece[]>(
    () =>
      Array.from({ length: 55 }, (_, i) => ({
        id: i,
        left: (i * 1.85) % 100,
        color: COLORS[i % COLORS.length],
        w: 7 + (i % 9),
        h: 10 + (i % 14),
        delay: (i * 0.037) % 2.2,
        duration: 2.6 + (i % 7) * 0.22,
        rotate: (i * 37) % 360,
        isCircle: i % 3 === 0,
      })),
    []
  );

  useEffect(() => {
    const t = setTimeout(onComplete, 4000);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      style={{ animation: "complete-overlay 4s ease-in-out forwards" }}
    >
      {/* 暗いベール */}
      <div className="absolute inset-0 bg-black/72" />

      {/* 紙吹雪 */}
      {pieces.map((p) => (
        <div
          key={p.id}
          className="absolute top-0"
          style={{
            left: `${p.left}%`,
            width: p.isCircle ? p.w : p.w,
            height: p.isCircle ? p.w : p.h,
            backgroundColor: p.color,
            borderRadius: p.isCircle ? "50%" : "2px",
            transform: `rotate(${p.rotate}deg)`,
            animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s both`,
          }}
        />
      ))}

      {/* スパークル */}
      {STAR_POSITIONS.map((pos, i) => (
        <div
          key={i}
          className="absolute text-2xl select-none"
          style={{
            ...pos,
            animation: `sparkle-pop 0.9s ease-out ${0.55 + i * 0.18}s both`,
          }}
        >
          {STAR_ICONS[i]}
        </div>
      ))}

      {/* メインテキスト */}
      <div
        className="relative z-10 text-center px-6"
        style={{
          animation: "complete-text 0.82s cubic-bezier(0.34, 1.56, 0.64, 1) 0.28s both",
        }}
      >
        <div className="flex justify-center gap-2 text-5xl mb-2 select-none">
          🎊<span>🎉</span>🎊
        </div>
        <p className="text-4xl font-black text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] tracking-widest">
          コンプリート！
        </p>
        <p
          className="text-lg font-bold text-yellow-200 mt-3 drop-shadow"
          style={{ animation: "fade-up 0.55s ease-out 1.15s both", opacity: 0 }}
        >
          全5カ所を制覇しました！
        </p>
        <p
          className="text-sm text-white/70 mt-1"
          style={{ animation: "fade-up 0.5s ease-out 1.5s both", opacity: 0 }}
        >
          おめでとうございます 🏅
        </p>
      </div>
    </div>
  );
}
