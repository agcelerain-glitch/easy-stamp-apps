import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/admin-session";
import AdminScanner from "@/components/AdminScanner";

interface Props {
  params: Promise<{ n: string }>;
}

export default async function AdminPointPage({ params }: Props) {
  const { n } = await params;
  const pointId = parseInt(n, 10);

  if (isNaN(pointId) || pointId < 1 || pointId > 5) {
    redirect("/admin");
  }

  // サーバーサイドで管理者セッション検証
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) redirect("/admin");

  const session = await verifyAdminToken(token);
  if (!session || session.point_id !== pointId) redirect("/admin");

  const POINT_LABELS = ["ポイント①", "ポイント②", "ポイント③", "ポイント④", "ポイント⑤"];

  return (
    <main className="flex flex-col min-h-screen bg-gray-900 text-white">
      <header className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div>
          <p className="text-xs text-gray-400">管理者モード</p>
          <p className="font-bold text-white">
            {POINT_LABELS[pointId - 1]} スキャン画面
          </p>
        </div>
        <a
          href="/admin"
          className="text-xs text-gray-400 hover:text-white underline transition-colors"
        >
          ログアウト
        </a>
      </header>
      <AdminScanner pointId={pointId} />
    </main>
  );
}
