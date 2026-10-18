import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { withTimeout, TimeoutError } from "@/lib/timeout";

const TIMEOUT_MS = 5000;

export async function POST(req: NextRequest) {
  let body: { profile_id?: string; new_nickname?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const profileId = body.profile_id?.trim();
  const newNickname = body.new_nickname?.trim();

  if (!profileId) {
    return NextResponse.json({ error: "profile_id_required" }, { status: 400 });
  }
  if (!newNickname || newNickname.length < 1 || newNickname.length > 20) {
    return NextResponse.json({ error: "invalid_nickname" }, { status: 400 });
  }

  const supabase = createServiceClient();
  try {
    const { data, error } = await withTimeout(
      supabase
        .from("profiles")
        .update({ nickname: newNickname })
        .eq("id", profileId)
        .select("id, nickname")
        .single(),
      TIMEOUT_MS
    );

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "nickname_taken" }, { status: 409 });
      }
      // 対象行なし（更新対象の profile_id が存在しない）
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
      }
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }

    return NextResponse.json({ profile_id: data.id, nickname: data.nickname });
  } catch (e) {
    if (e instanceof TimeoutError) {
      return NextResponse.json({ error: "timeout" }, { status: 504 });
    }
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
