import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/admin-session";
import { withTimeout, TimeoutError } from "@/lib/timeout";

const TIMEOUT_MS = 5000;

export async function POST(req: NextRequest) {
  const adminToken = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!adminToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const session = await verifyAdminToken(adminToken);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { token } = body;
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "token_required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  try {
    const { data: otp } = await withTimeout(
      supabase
        .from("otp_codes")
        .select("id, profile_id, stamp_point_id, expires_at")
        .eq("id", token)
        .maybeSingle(),
      TIMEOUT_MS
    );

    if (!otp) {
      return NextResponse.json({ error: "invalid_token" }, { status: 404 });
    }

    if (otp.stamp_point_id !== session.point_id) {
      return NextResponse.json(
        {
          error: "wrong_point",
          message: `このQRコードはポイント${otp.stamp_point_id}用です`,
        },
        { status: 400 }
      );
    }

    if (new Date(otp.expires_at) < new Date()) {
      await withTimeout(
        supabase.from("otp_codes").delete().eq("id", token),
        TIMEOUT_MS
      );
      return NextResponse.json({ error: "expired" }, { status: 410 });
    }

    const { data: existingStamp } = await withTimeout(
      supabase
        .from("stamps")
        .select("id")
        .eq("profile_id", otp.profile_id)
        .eq("stamp_point_id", otp.stamp_point_id)
        .maybeSingle(),
      TIMEOUT_MS
    );

    if (existingStamp) {
      await withTimeout(
        supabase.from("otp_codes").delete().eq("id", token),
        TIMEOUT_MS
      );
      return NextResponse.json({ error: "already_stamped" }, { status: 409 });
    }

    const { error: stampError } = await withTimeout(
      supabase
        .from("stamps")
        .insert({ profile_id: otp.profile_id, stamp_point_id: otp.stamp_point_id }),
      TIMEOUT_MS
    );

    if (stampError) {
      return NextResponse.json({ error: "stamp_failed" }, { status: 500 });
    }

    await withTimeout(
      supabase.from("otp_codes").delete().eq("id", token),
      TIMEOUT_MS
    );

    return NextResponse.json({ success: true, stamp_point_id: otp.stamp_point_id });
  } catch (e) {
    if (e instanceof TimeoutError) {
      return NextResponse.json({ error: "timeout" }, { status: 504 });
    }
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
