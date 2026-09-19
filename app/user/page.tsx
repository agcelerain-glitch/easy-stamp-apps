"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Step = "check" | "enter" | "confirm_existing" | "loading";

export default function UserPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("check");
  const [nickname, setNickname] = useState("");
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 既存セッション確認
  useEffect(() => {
    const saved = localStorage.getItem("profile_id");
    const savedNick = localStorage.getItem("nickname");
    if (saved && savedNick) {
      router.replace("/user/stamps");
    } else {
      setStep("enter");
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    const trimmed = input.trim();
    if (!trimmed) {
      setError("ニックネームを入力してください");
      return;
    }
    if (trimmed.length > 20) {
      setError("20文字以内で入力してください");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      // 既存ニックネーム確認
      const res = await fetch(
        `/api/profile/lookup?nickname=${encodeURIComponent(trimmed)}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) throw new Error("network_error");
      const data = await res.json();

      if (data.exists) {
        setNickname(trimmed);
        setStep("confirm_existing");
        // profile_id を保存
        localStorage.setItem("profile_id", data.profile_id);
        localStorage.setItem("nickname", trimmed);
      } else {
        // 新規作成
        const createRes = await fetch("/api/profile/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nickname: trimmed }),
          signal: AbortSignal.timeout(8000),
        });
        if (!createRes.ok) {
          const err = await createRes.json();
          if (err.error === "nickname_taken") {
            setError("そのニックネームはすでに使われています");
          } else {
            setError("エラーが発生しました。もう一度お試しください");
          }
          return;
        }
        const created = await createRes.json();
        localStorage.setItem("profile_id", created.profile_id);
        localStorage.setItem("nickname", trimmed);
        router.push("/user/stamps");
      }
    } catch (e) {
      if (e instanceof Error && e.name === "TimeoutError") {
        setError("接続がタイムアウトしました。もう一度お試しください");
      } else {
        setError("エラーが発生しました。もう一度お試しください");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleContinue() {
    router.push("/user/stamps");
  }

  function handleUseDifferent() {
    localStorage.removeItem("profile_id");
    localStorage.removeItem("nickname");
    setInput("");
    setStep("enter");
  }

  if (step === "check" || step === "loading") {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (step === "confirm_existing") {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen px-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <div className="text-5xl mb-4">👋</div>
            <h1 className="text-xl font-bold text-gray-800">
              おかえりなさい！
            </h1>
            <p className="mt-2 text-gray-600">
              <span className="font-semibold text-indigo-600">{nickname}</span>{" "}
              さんのスタンプを引き続き集めますか？
            </p>
          </div>
          <button
            onClick={handleContinue}
            className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow transition-colors"
          >
            続きからはじめる
          </button>
          <button
            onClick={handleUseDifferent}
            className="w-full py-3 px-6 border border-gray-300 text-gray-600 rounded-2xl hover:bg-gray-50 transition-colors"
          >
            別のニックネームを使う
          </button>
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
            ニックネームを決めよう
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            スタンプラリーに使う名前を入力してください（20文字以内）
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="ニックネーム"
            maxLength={20}
            className="w-full px-4 py-3 text-lg border-2 border-gray-200 focus:border-indigo-500 rounded-xl outline-none transition-colors"
            autoFocus
            disabled={isSubmitting}
          />
          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}
          <button
            type="submit"
            disabled={isSubmitting || !input.trim()}
            className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold rounded-2xl shadow transition-colors"
          >
            {isSubmitting ? "確認中..." : "スタートする"}
          </button>
        </form>
      </div>
    </main>
  );
}
