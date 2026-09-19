"use client";

interface Props {
  progress: number;      // 0〜1
  isRefreshing: boolean;
  isPulling: boolean;
}

export default function PullRefreshIndicator({ progress, isRefreshing, isPulling }: Props) {
  if (!isPulling && !isRefreshing) return null;

  const isReady    = progress >= 0.85;
  const arrowDeg   = progress * 180; // 下向き→上向きに回転
  const indicatorH = isRefreshing ? 44 : Math.round(progress * 44);

  return (
    <div
      className="flex items-center justify-center overflow-hidden"
      style={{
        height: indicatorH,
        transition: isRefreshing ? "none" : "height 0.05s linear",
      }}
    >
      {isRefreshing ? (
        /* スピナー */
        <div className="flex items-center gap-2 text-indigo-500">
          <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium">更新中...</span>
        </div>
      ) : (
        /* 引っ張り矢印 */
        <div
          className={`flex items-center gap-1.5 transition-colors duration-150 ${
            isReady ? "text-indigo-500" : "text-gray-300"
          }`}
          style={{ transform: `rotate(${arrowDeg}deg)` }}
        >
          <svg
            width="20" height="20" viewBox="0 0 20 20"
            fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M10 3v11M5 9l5 5 5-5" />
          </svg>
        </div>
      )}
    </div>
  );
}
