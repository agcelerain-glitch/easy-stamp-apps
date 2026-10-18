"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DevClearPage() {
  const router = useRouter();
  const [cacheInfo, setCacheInfo] = useState<{
    profile_id: string | null;
    nickname: string | null;
  }>({ profile_id: null, nickname: null });
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    setCacheInfo({
      profile_id: localStorage.getItem("profile_id"),
      nickname:   localStorage.getItem("nickname"),
    });
  }, []);

  function handleClear() {
    localStorage.removeItem("profile_id");
    localStorage.removeItem("nickname");
    setCacheInfo({ profile_id: null, nickname: null });
    setCleared(true);
  }

  const hasCache = !!cacheInfo.profile_id;

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-6 bg-gray-950 text-gray-200">
      <div className="w-full max-w-sm space-y-5">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest">Developer Tools</p>
          <h1 className="text-xl font-mono font-bold text-gray-100 mt-1">
            Cache Inspector
          </h1>
        </div>

        {/* キャッシュ状態 */}
        <div className="bg-gray-900 rounded-xl p-4 font-mono text-sm space-y-2 border border-gray-800">
          <p className="text-gray-500 text-xs mb-3">localStorage</p>
          <div className="flex gap-2">
            <span className="text-gray-500">profile_id</span>
            <span className={cacheInfo.profile_id ? "text-green-400" : "text-gray-600"}>
              {cacheInfo.profile_id ?? "null"}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500">nickname&nbsp;&nbsp;</span>
            <span className={cacheInfo.nickname ? "text-green-400" : "text-gray-600"}>
              {cacheInfo.nickname ?? "null"}
            </span>
          </div>
        </div>

        {cleared && (
          <p className="text-green-400 text-sm font-mono">✓ キャッシュをクリアしました</p>
        )}

        {/* クリアボタン */}
        <button
          onClick={handleClear}
          disabled={!hasCache}
          className="w-full py-3 bg-red-700 hover:bg-red-600 disabled:bg-gray-800
                     disabled:text-gray-600 text-white font-mono font-bold rounded-xl
                     transition-colors"
        >
          {hasCache ? "キャッシュをクリア" : "キャッシュなし"}
        </button>

        {/* ナビゲーション */}
        <div className="flex gap-4 text-xs font-mono">
          <button
            onClick={() => router.push("/user")}
            className="text-indigo-400 hover:text-indigo-300 underline"
          >
            → /user（ニックネーム入力）
          </button>
          <button
            onClick={() => router.push("/")}
            className="text-gray-500 hover:text-gray-300 underline"
          >
            → / （トップ）
          </button>
        </div>
      </div>
    </main>
  );
}
