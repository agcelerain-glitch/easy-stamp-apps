"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LinkQrCard from "@/components/LinkQrCard";

export default function DevConsolePage() {
  const router = useRouter();
  const [base, setBase] = useState("");

  useEffect(() => {
    const envBase = process.env.NEXT_PUBLIC_BASE_URL;
    const resolved =
      (envBase && envBase.replace(/\/$/, "")) || window.location.origin;
    setBase(resolved);
  }, []);

  async function handleLogout() {
    try {
      await fetch("/api/dev/auth", { method: "DELETE" });
    } catch {
      // 失効呼び出し失敗でも /dev へ遷移する
    }
    router.push("/dev");
  }

  return (
    <main className="flex flex-col min-h-screen bg-gray-950 text-gray-200">
      <header className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-2 font-bold text-gray-100">
          <span>🛠️</span>
          <span>開発者コンソール</span>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs text-gray-500 hover:text-gray-300 underline"
        >
          ログアウト
        </button>
      </header>

      <div className="flex-1 px-4 py-6 max-w-md mx-auto w-full space-y-4">
        {base ? (
          <>
            <LinkQrCard
              emoji="📣"
              title="新規ユーザー共有リンク"
              url={`${base}/`}
              note="新しく参加する人に共有する入口URLです。"
            />
            <LinkQrCard
              emoji="📱"
              title="トップドメインQR"
              url={`${base}/`}
              note="会場での掲示・印刷用。上と同じ入口URLのQRです。"
            />
            <LinkQrCard
              emoji="✏️"
              title="名前変更リンク"
              url={`${base}/user/rename`}
              note="ニックネームを変更したい利用者に渡すリンクです。"
            />
          </>
        ) : (
          <p className="text-sm text-gray-500">読み込み中...</p>
        )}
      </div>
    </main>
  );
}
