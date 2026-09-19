import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { withTimeout, TimeoutError } from "@/lib/timeout";

const OTP_TTL_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 5000;

export async function POST(req: NextRequest) {
  let body: { profile_id?: string; stamp_point_id?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { profile_id, stamp_point_id } = body;
  if (
    !profile_id ||
    typeof profile_id !== "string" ||
    !stamp_point_id ||
    stamp_point_id < 1 ||
    stamp_point_id > 5
  ) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  try {
    // すでにスタンプ取得済みか確認
    const { data: existing } = await withTimeout(
      supabase
        .from("stamps")
        .select("id")
        .eq("profile_id", profile_id)
        .eq("stamp_point_id", stamp_point_id)
        .maybeSingle(),
      TIMEOUT_MS
    );
    if (existing) {
      return NextResponse.json({ error: "already_stamped" }, { status: 409 });
    }

    // 期限切れ OTP を削除
    await withTimeout(
      supabase
        .from("otp_codes")
        .delete()
        .eq("profile_id", profile_id)
        .eq("stamp_point_id", stamp_point_id)
        .lt("expires_at", now),
      TIMEOUT_MS
    );

    // 既存の有効 OTP があれば再利用
    const { data: existing_otp } = await withTimeout(
      supabase
        .from("otp_codes")
        .select("id, expires_at")
        .eq("profile_id", profile_id)
        .eq("stamp_point_id", stamp_point_id)
        .gt("expires_at", now)
        .maybeSingle(),
      TIMEOUT_MS
    );
    if (existing_otp) {
      return NextResponse.json({
        token: existing_otp.id,
        expires_at: existing_otp.expires_at,
      });
    }

    // 新規 OTP 発行
    const expires_at = new Date(Date.now() + OTP_TTL_MS).toISOString();
    const { data: otp, error } = await withTimeout(
      supabase
        .from("otp_codes")
        .insert({ profile_id, stamp_point_id, expires_at })
        .select("id")
        .single(),
      TIMEOUT_MS
    );

    if (error || !otp) {
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }

    return NextResponse.json({ token: otp.id, expires_at });
  } catch (e) {
    if (e instanceof TimeoutError) {
      return NextResponse.json({ error: "timeout" }, { status: 504 });
    }
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
