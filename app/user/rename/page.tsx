"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Phase = "check" | "ready" | "no_session";

export default function RenamePage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("check");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [current, setCurrent] = useState("");
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const pid = localStorage.getItem("profile_id");
    const nick = localStorage.getItem("nickname");
    if (!pid || !nick) {
      setPhase("no_session");
      return;
    }
    setProfileId(pid);
    setCurrent(nick);
    setInput(nick);
    setPhase("ready");
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting || !profileId) return;
    const trimmed = input.trim();
    if (!trimmed) {
      setError("ニックネームを入力してください");
      return;
    }
    if (trimmed.length > 20) {
      setError("20文字以内で入力してください");
      return;
    }
    if (trimmed === current) {
      setError("現在のニックネームと同じです");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/profile/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: profileId, new_nickname: trimmed }),
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "nickname_taken")
          setError("そのニックネームはすでに使われています");
        else if (data.error === "profile_not_found")
          setError("セッションが無効です。トップからやり直してください");
        else if (data.error === "timeout")
          setError("接続がタイムアウトしました");
        else setError("エラーが発生しました。もう一度お試しください");
        return;
      }
      localStorage.setItem("nickname", data.nickname);
      router.push("/user/home");
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

  if (phase === "check") {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (phase === "no_session") {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen px-6">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="text-5xl">🔑</div>
          <h1 className="text-xl font-bold text-gray-800">
            セッションがありません
          </h1>
          <p className="text-sm text-gray-500">
            名前を変更するには、まずトップからニックネームで入り直してください。
          </p>
          <Link
            href="/user"
            className="block w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-colors"
          >
            ニックネーム入力へ
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="text-5xl mb-4">✏️</div>
          <h1 className="text-2xl font-bold text-gray-800">
            ニックネームを変更
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            現在：<span className="font-semibold text-indigo-600">{current}</span>
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="新しいニックネーム"
            maxLength={20}
            className="w-full px-4 py-3 text-lg border-2 border-gray-200 focus:border-indigo-500 rounded-xl outline-none transition-colors"
            autoFocus
            disabled={isSubmitting}
          />
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting || !input.trim()}
            className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold rounded-2xl shadow transition-colors"
          >
            {isSubmitting ? "変更中..." : "変更する"}
          </button>
          <Link
            href="/user/home"
            className="block text-center text-xs text-gray-400 underline"
          >
            ← ホームへ戻る
          </Link>
        </form>
      </div>
    </main>
  );
}
