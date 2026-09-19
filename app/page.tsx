import Link from "next/link";

export default function TopPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-6 bg-gradient-to-b from-indigo-50 to-white">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        {/* アイコン */}
        <div className="text-7xl select-none">🎯</div>

        {/* タイトル */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-indigo-700 tracking-wide">
            スタンプラリー
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            5カ所を巡ってスタンプを集めよう
          </p>
        </div>

        {/* ユーザー向けボタン */}
        <Link
          href="/user"
          className="w-full text-center py-4 px-6 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-lg font-bold rounded-2xl shadow-lg transition-colors duration-150"
        >
          スタンプラリーを始める
        </Link>

        {/* 管理者向けリンク */}
        <Link
          href="/admin"
          className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors duration-150"
        >
          管理者の方はこちら
        </Link>
      </div>
    </main>
  );
}
