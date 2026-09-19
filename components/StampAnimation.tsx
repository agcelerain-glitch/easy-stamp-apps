"use client";

import { useEffect } from "react";

interface Props {
  icon: string;
  onComplete: () => void;
}

export default function StampAnimation({ icon, onComplete }: Props) {
  useEffect(() => {
    const t = setTimeout(onComplete, 2000);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none z-20 flex items-center justify-center">
      {/* 白フラッシュ（インパクト感） */}
      <div
        className="absolute inset-0 rounded-2xl bg-white"
        style={{ animation: "stamp-flash 0.45s ease-out forwards" }}
      />

      {/* 朱肉の広がり（一波目） */}
      <div
        className="absolute w-20 h-20 rounded-full bg-red-400/50"
        style={{
          animation: "ink-ripple 1.0s ease-out 0.32s both",
          transform: "scale(0)",
          opacity: 0,
        }}
      />

      {/* 朱肉の広がり（二波目・藍色） */}
      <div
        className="absolute w-20 h-20 rounded-full bg-indigo-400/30"
        style={{
          animation: "ink-ripple-2 1.3s ease-out 0.48s both",
          transform: "scale(0)",
          opacity: 0,
        }}
      />

      {/* 判子本体（丸い赤いハンコ＋アイコン） */}
      <div
        className="flex items-center justify-center w-[72px] h-[72px] rounded-full
                   bg-red-600 shadow-2xl ring-4 ring-red-300"
        style={{
          animation: "stamp-drop 0.68s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        }}
      >
        <span className="text-[2rem] leading-none select-none">{icon}</span>
      </div>
    </div>
  );
}
