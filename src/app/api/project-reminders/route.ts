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
 * GET /api/project-reminders
 *
 * Liefert User-Erinnerungen zu Hero-Projekten zurueck.
 *
 * Query:
 *   ?scope=active   — nur aktive (nicht dismissed)
 *   ?scope=overdue  — nur faellig + nicht dismissed (remind_at <= NOW)
 *   ?scope=all      — auch dismissed
 *   ?projectId=X    — nur Erinnerungen fuer ein bestimmtes Hero-Projekt
 *
 * Response: { reminders: [...], total: N }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") ?? "active";
  const projectId = searchParams.get("projectId");

  try {
    const supabase = supabaseAdmin();
    let query = supabase
      .from("project_reminders")
      .select(
        "id, hero_project_id, hero_project_number, hero_project_name, title, note, remind_at, dismissed_at, snoozed_count, created_at, created_by_email",
      )
      .order("remind_at", { ascending: true });

    if (scope === "active") {
      query = query.is("dismissed_at", null);
    } else if (scope === "overdue") {
      query = query
        .is("dismissed_at", null)
        .lte("remind_at", new Date().toISOString());
    }
    if (projectId) query = query.eq("hero_project_id", projectId);

    const { data, error } = await query.limit(200);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(
      { reminders: data ?? [], total: data?.length ?? 0 },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

/**
 * POST /api/project-reminders
 *
 * Legt eine neue Erinnerung an.
 *
 * Body: {
 *   hero_project_id: string (required)
 *   hero_project_number?: string
 *   hero_project_name?: string
 *   title: string (required)
 *   note?: string
 *   remind_at: ISO datetime (required)
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      hero_project_id?: string;
      hero_project_number?: string;
      hero_project_name?: string;
      title?: string;
      note?: string;
      remind_at?: string;
      created_by_email?: string;
    };
    if (!body.hero_project_id || !body.title || !body.remind_at) {
      return NextResponse.json(
        { error: "hero_project_id, title, remind_at sind Pflicht" },
        { status: 400 },
      );
    }
    const remindAt = new Date(body.remind_at);
    if (Number.isNaN(remindAt.getTime())) {
      return NextResponse.json(
        { error: "remind_at ist kein gueltiges Datum" },
        { status: 400 },
      );
    }

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("project_reminders")
      .insert({
        hero_project_id: body.hero_project_id.trim(),
        hero_project_number: body.hero_project_number?.trim() ?? null,
        hero_project_name: body.hero_project_name?.trim() ?? null,
        title: body.title.trim().slice(0, 200),
        note: body.note?.slice(0, 4000) ?? null,
        remind_at: remindAt.toISOString(),
        created_by_email: body.created_by_email?.trim() ?? null,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
