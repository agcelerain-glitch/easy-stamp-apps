"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DevLoginPage() {
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
      const res = await fetch("/api/dev/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error === "invalid_passcode"
            ? "パスコードが正しくありません"
            : "エラーが発生しました。もう一度お試しください"
        );
        setPasscode("");
        return;
      }
      router.push("/dev/console");
    } catch (e) {
      setError(
        e instanceof Error && e.name === "TimeoutError"
          ? "接続がタイムアウトしました"
          : "エラーが発生しました。もう一度お試しください"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-6 bg-gray-950 text-gray-200">
      <div className="w-full max-w-xs space-y-6">
        <div className="text-center">
          <div className="text-5xl mb-3">🛠️</div>
          <h1 className="text-xl font-bold text-gray-100">開発者ログイン</h1>
          <p className="text-sm text-gray-500 mt-1">
            開発者パスコードを入力してください
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="パスコード"
            className="w-full px-4 py-3 text-lg bg-gray-900 border-2 border-gray-800 focus:border-gray-500 rounded-xl outline-none transition-colors text-gray-100"
            autoFocus
            disabled={isSubmitting}
          />
          {error && <p className="text-sm text-red-400 text-center">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting || !passcode}
            className="w-full py-3 px-6 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white font-bold rounded-2xl transition-colors"
          >
            {isSubmitting ? "確認中..." : "ログイン"}
          </button>
        </form>
        <p className="text-center text-xs text-gray-600 underline">
          <a href="/">← トップへ戻る</a>
        </p>
      </div>
    </main>
  );
}
