import { NextRequest, NextResponse } from "next/server";
import {
  signDevToken,
  DEV_COOKIE_NAME,
  DEV_TTL_SECONDS,
} from "@/lib/dev-session";

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

  const expected = process.env.DEV_PASSCODE;
  if (!expected || passcode !== expected) {
    // ブルートフォースを遅らせる
    await new Promise((r) => setTimeout(r, 500));
    return NextResponse.json({ error: "invalid_passcode" }, { status: 401 });
  }

  const token = await signDevToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEV_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: DEV_TTL_SECONDS,
    path: "/",
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEV_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
  return res;
}
