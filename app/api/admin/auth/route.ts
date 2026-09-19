import { NextRequest, NextResponse } from "next/server";
import { signAdminToken, ADMIN_COOKIE_NAME } from "@/lib/admin-session";

const PASSCODES: Record<number, string | undefined> = {
  1: process.env.ADMIN_PASS_1,
  2: process.env.ADMIN_PASS_2,
  3: process.env.ADMIN_PASS_3,
  4: process.env.ADMIN_PASS_4,
  5: process.env.ADMIN_PASS_5,
};

export async function POST(req: NextRequest) {
  let body: { passcode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { passcode } = body;
  if (!passcode || typeof passcode !== "string") {
    return NextResponse.json({ error: "passcode_required" }, { status: 400 });
  }

  // パスコードを全ポイント分チェック（タイミング攻撃対策: 必ず全件比較）
  let matchedPoint: number | null = null;
  for (const [pointStr, stored] of Object.entries(PASSCODES)) {
    if (stored && stored === passcode) {
      matchedPoint = parseInt(pointStr, 10);
      break;
    }
  }

  if (!matchedPoint) {
    // 一定時間待機してブルートフォースを遅らせる
    await new Promise((r) => setTimeout(r, 500));
    return NextResponse.json({ error: "invalid_passcode" }, { status: 401 });
  }

  const token = await signAdminToken(matchedPoint);
  const res = NextResponse.json({ point_id: matchedPoint });
  res.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 8,
    path: "/",
  });
  return res;
}
