import { NextRequest, NextResponse } from "next/server";
import { loadProjectActivity } from "@/lib/supabase/hero-project-activity";

export const runtime = "nodejs";
export const maxDuration = 10;

/**
 * GET /api/project-activity/[id]?limit=5
 *
 * Liefert die letzten Logbuch-Eintraege + Status-Transitions fuer ein
 * Projekt. Benutzt von TaskCard (expanded) + Projekt-Pulse-Karte.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id || id.length > 64) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const url = new URL(req.url);
  const limitRaw = parseInt(url.searchParams.get("limit") ?? "5", 10);
  const limit = Math.min(20, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 5));

  try {
    const activity = await loadProjectActivity(id, limit);
    if (!activity) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json(activity, {
      headers: {
        // Logbuch-Aktivitaet aendert sich nicht im Sekundentakt — 60s cache OK
        "Cache-Control":
          "private, max-age=30, stale-while-revalidate=120",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown error" },
      { status: 500 },
    );
  }
}
