import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { heroGraphQL } from "@/lib/hero/hero-client";

export const runtime = "nodejs";
export const maxDuration = 30;

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

/**
 * POST /api/mail-tasks/[id]/hero-log
 *
 * Schreibt einen Eintrag direkt ins Hero-Logbuch des verknüpften Projekts.
 * Voraussetzung: Task hat hero_project_id gesetzt.
 *
 * Body: { text: string, title?: string }
 * Response: { ok: true, heroEntryId: number, created: string }
 *
 * Hero's project_match_id ist ein Integer — wir loesen die Task's
 * hero_project_id (UUID in unserer DB = hero_projects.id) zu deren
 * project_match_id auf. Falls die ID schon ein Integer (target_id) ist,
 * benutzen wir die direkt.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id fehlt" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    text?: string;
    title?: string;
  };
  const text = (body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "text leer" }, { status: 400 });
  }
  const title = (body.title ?? "").trim().slice(0, 200) || "Notiz";

  // Task laden — hero_project_id muss da sein
  const supabase = supabaseAdmin();
  const isHero = id.startsWith("hero-");
  let heroProjectUuid: string | null = null;

  if (isHero) {
    // Hero-Comment selbst — target_id zeigt aufs Projekt
    const heroId = id.slice("hero-".length);
    const { data: note } = await supabase
      .from("hero_notifications")
      .select("target_id")
      .eq("id", heroId)
      .maybeSingle();
    heroProjectUuid = (note?.target_id as string | null) ?? null;
  } else {
    const { data: task } = await supabase
      .from("tasks")
      .select("hero_project_id")
      .eq("id", id)
      .maybeSingle();
    heroProjectUuid = (task?.hero_project_id as string | null) ?? null;
  }

  if (!heroProjectUuid) {
    return NextResponse.json(
      {
        error:
          "Task ist nicht mit einem Hero-Projekt verknuepft. Erst Hero-Match laufen lassen.",
      },
      { status: 400 },
    );
  }

  // hero_project_id (UUID in unserer Spiegel-DB) -> integer project_match_id in Hero
  const { data: proj } = await supabase
    .from("hero_projects")
    .select("project_match_id")
    .eq("id", heroProjectUuid)
    .maybeSingle();
  const pmid =
    typeof proj?.project_match_id === "number"
      ? proj.project_match_id
      : null;

  if (!pmid) {
    return NextResponse.json(
      {
        error:
          "Konnte project_match_id (Hero-Integer-ID) nicht aufloesen. Hero-Sync laufen lassen?",
      },
      { status: 500 },
    );
  }

  try {
    const result = await heroGraphQL<{
      add_logbook_entry: { id: number; created: string } | null;
    }>(
      `mutation AddLog($pmid: Int!, $title: String!, $text: String!) {
        add_logbook_entry(
          target_project_match_id: $pmid
          custom_title: $title
          custom_text: $text
        ) { id created }
      }`,
      {
        pmid,
        title,
        text: text.slice(0, 4000),
      },
    );
    const entry = result.add_logbook_entry;
    if (!entry) {
      return NextResponse.json(
        {
          error:
            "Hero hat keine Eintrag-ID zurueckgegeben — moeglicherweise fehlt API-Schreibberechtigung.",
        },
        { status: 502 },
      );
    }
    return NextResponse.json({
      ok: true,
      heroEntryId: entry.id,
      created: entry.created,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Hero-Logbuch-Eintrag fehlgeschlagen",
      },
      { status: 502 },
    );
  }
}
