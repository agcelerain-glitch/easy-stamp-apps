"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting || !passcode) return;

    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === "invalid_passcode") {
          setError("パスコードが正しくありません");
        } else {
          setError("エラーが発生しました。もう一度お試しください");
        }
        setPasscode("");
        return;
      }

      router.push(`/admin/${data.point_id}`);
    } catch (e) {
      if (e instanceof Error && e.name === "TimeoutError") {
        setError("接続がタイムアウトしました");
      } else {
        setError("エラーが発生しました。もう一度お試しください");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-6 bg-gray-50">
      <div className="w-full max-w-xs space-y-6">
        <div className="text-center">
          <div className="text-5xl mb-3">🔐</div>
          <h1 className="text-xl font-bold text-gray-700">管理者ログイン</h1>
          <p className="text-sm text-gray-400 mt-1">
            担当ポイントのパスコードを入力してください
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="パスコード"
            className="w-full px-4 py-3 text-lg border-2 border-gray-200 focus:border-gray-500 rounded-xl outline-none transition-colors"
            autoFocus
            disabled={isSubmitting}
          />
          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}
          <button
            type="submit"
            disabled={isSubmitting || !passcode}
            className="w-full py-3 px-6 bg-gray-700 hover:bg-gray-800 disabled:bg-gray-400 text-white font-bold rounded-2xl transition-colors"
          >
            {isSubmitting ? "確認中..." : "ログイン"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-300 underline">
          <a href="/">← トップへ戻る</a>
        </p>
      </div>
    </main>
  );
}
