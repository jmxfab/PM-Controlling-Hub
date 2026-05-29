import { NextResponse } from "next/server";
import { loadMailTaskCounts } from "@/lib/supabase/mail-tasks-queries";

export const runtime = "nodejs";
export const maxDuration = 10;

/**
 * GET /api/mail-tasks/counts
 * Liefert aktuelle Counts fuer alle Tabs (Mein Tag / Kritisch / Aufgaben / ...).
 * Client pollt diesen Endpoint alle 60s + bei Tab-Focus.
 */
export async function GET() {
  try {
    const counts = await loadMailTaskCounts();
    return NextResponse.json(counts, {
      headers: {
        // Sehr kurz cachen — Counts sind das was sich am haeufigsten aendert
        "Cache-Control":
          "private, max-age=10, stale-while-revalidate=30",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
