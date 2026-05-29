import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 15;

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

/**
 * GET /api/hero/reminders?projectId=<hero_project_id>&limit=N
 *
 * Liefert Hero-Termine + Erinnerungen fuer ein verknuepftes Projekt zurueck.
 * Quelle: hero_calendar_events (synced via n8n aus Hero).
 *
 * Filter:
 *  - project_match_id = projectId
 *  - is_deleted = false
 *  - sortiert: bevorstehende zuerst (event_start ASC), dann veraltete (DESC)
 *
 * Response:
 *   { reminders: [...], total: N }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = (searchParams.get("projectId") ?? "").trim();
  const limit = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10) || 10),
  );

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId required" },
      { status: 400 },
    );
  }

  try {
    const supabase = supabaseAdmin();
    const nowIso = new Date().toISOString();

    // Zwei Queries parallel: bevorstehende (event_start >= now) + reminder_at >= now
    // Veraltete erlauben wir auch, aber nach kommenden sortiert.
    const { data, error } = await supabase
      .from("hero_calendar_events")
      .select(
        "id, title, description, event_start, event_end, all_day, is_done, project_match_id, category_name, reminder_at, reminder_note, hero_modified_at",
      )
      .eq("project_match_id", projectId)
      .eq("is_deleted", false)
      .or(`event_start.gte.${nowIso},reminder_at.gte.${nowIso}`)
      .order("event_start", { ascending: true, nullsFirst: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      reminders: data ?? [],
      total: data?.length ?? 0,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
