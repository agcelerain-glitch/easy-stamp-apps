import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { withTimeout, TimeoutError } from "@/lib/timeout";

const TIMEOUT_MS = 5000;

export async function GET(req: NextRequest) {
  const nickname = req.nextUrl.searchParams.get("nickname");
  if (!nickname || nickname.trim().length === 0) {
    return NextResponse.json({ error: "nickname_required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  try {
    const { data: profile } = await withTimeout(
      supabase
        .from("profiles")
        .select("id, nickname, created_at")
        .eq("nickname", nickname.trim())
        .maybeSingle(),
      TIMEOUT_MS
    );

    if (!profile) {
      return NextResponse.json({ exists: false });
    }
    return NextResponse.json({ exists: true, profile_id: profile.id });
  } catch (e) {
    if (e instanceof TimeoutError) {
      return NextResponse.json({ error: "timeout" }, { status: 504 });
    }
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { nickname?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const nickname = body.nickname?.trim();
  if (!nickname || nickname.length < 1 || nickname.length > 20) {
    return NextResponse.json({ error: "invalid_nickname" }, { status: 400 });
  }

  const supabase = createServiceClient();
  try {
    const { data: profile, error } = await withTimeout(
      supabase.from("profiles").insert({ nickname }).select("id").single(),
      TIMEOUT_MS
    );

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "nickname_taken" }, { status: 409 });
      }
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }

    return NextResponse.json({ profile_id: profile.id }, { status: 201 });
  } catch (e) {
    if (e instanceof TimeoutError) {
      return NextResponse.json({ error: "timeout" }, { status: 504 });
    }
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
