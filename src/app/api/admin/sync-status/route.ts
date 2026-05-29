import { NextResponse } from "next/server";

import { getHeroSyncStatusDetails } from "@/lib/supabase/hero-sync-status";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET() {
  try {
    const data = await getHeroSyncStatusDetails();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
