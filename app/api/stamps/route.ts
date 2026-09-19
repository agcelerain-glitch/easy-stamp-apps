import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { withTimeout, TimeoutError } from "@/lib/timeout";

const TIMEOUT_MS = 5000;

export async function GET(req: NextRequest) {
  const profile_id = req.nextUrl.searchParams.get("profile_id");
  if (!profile_id) {
    return NextResponse.json({ error: "profile_id_required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  try {
    const { data: stamps, error } = await withTimeout(
      supabase
        .from("stamps")
        .select("stamp_point_id, stamped_at")
        .eq("profile_id", profile_id),
      TIMEOUT_MS
    );

    if (error) {
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }
    return NextResponse.json({ stamps: stamps ?? [] });
  } catch (e) {
    if (e instanceof TimeoutError) {
      return NextResponse.json({ error: "timeout" }, { status: 504 });
    }
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
