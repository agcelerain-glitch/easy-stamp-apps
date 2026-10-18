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
