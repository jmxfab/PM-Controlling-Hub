import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 30;

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

/**
 * POST /api/admin/sync-hero-reminders
 *
 * Extrahiert Hero-Erinnerungen aus hero_histories und schreibt sie in
 * project_reminders. Quelle: Hero schreibt beim Erinnerungs-Setzen eine
 * History-Zeile "Erinnerungsdatum wurde auf den DD.MM.YY gesetzt".
 *
 * Idempotent — wenn fuer ein Hero-Projekt schon ein Reminder existiert,
 * wird er nicht ueberschrieben (ausser via ?update=1).
 *
 * Sinnvoll als n8n-Schedule-Trigger (z.B. alle 10 Min) zu callen.
 *
 * Query:
 *   ?update=1  — bestehende Reminders mit neuem Datum ueberschreiben (UPSERT)
 *
 * Response: { inserted: N, updated: N, total_history_hits: N }
 */
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const update = searchParams.get("update") === "1";

  try {
    const supabase = supabaseAdmin();

    // Extrahiere die neuesten Erinnerungs-Datumswerte pro Hero-Projekt aus hero_histories
    const { data: parsedData, error: parseError } = await supabase.rpc(
      "exec_sync_hero_reminders",
      {},
    );

    // Fallback wenn RPC nicht existiert — direkte Query
    if (parseError && parseError.code === "42883") {
      // Function does not exist — fallback to raw SQL via execute
      return await fallbackInsert(supabase, update);
    }

    if (parseError) {
      return NextResponse.json({ error: parseError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      result: parsedData,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

async function fallbackInsert(
  supabase: ReturnType<typeof supabaseAdmin>,
  update: boolean,
) {
  // Da Supabase JS-Client keine Raw-SQL erlaubt, machen wir das via mehrere
  // gezielte Queries:
  // 1. Hole alle History-Eintraege mit "Erinnerungsdatum"
  // 2. Pro Project: nimm den neuesten Eintrag
  // 3. Parse das Datum
  // 4. Upsert in project_reminders

  const { data: histories, error: hError } = await supabase
    .from("hero_histories")
    .select("project_match_id, entry_date, custom_text, raw")
    .ilike("custom_text", "%Erinnerungsdatum wurde auf den%")
    .order("entry_date", { ascending: false });

  if (hError) {
    return NextResponse.json({ error: hError.message }, { status: 500 });
  }

  // Map: project_match_id -> latest entry
  const latest = new Map<string, { date: Date; entry_date: string; email: string | null }>();
  const dateRe = /Erinnerungsdatum wurde auf den (\d{2}\.\d{2}\.\d{2,4})/;
  for (const h of histories ?? []) {
    if (!h.project_match_id) continue;
    if (latest.has(h.project_match_id)) continue;
    const match = (h.custom_text ?? "").match(dateRe);
    if (!match) continue;
    const dateStr = match[1];
    const parts = dateStr.split(".");
    const year = parts[2].length === 2 ? "20" + parts[2] : parts[2];
    const isoDate = `${year}-${parts[1]}-${parts[0]}T00:00:00Z`;
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) continue;
    const userEmail = (h.raw as Record<string, unknown> | null)?.["user"];
    const email =
      userEmail && typeof userEmail === "object"
        ? ((userEmail as Record<string, unknown>).email as string | undefined) ?? null
        : null;
    latest.set(h.project_match_id, {
      date: d,
      entry_date: h.entry_date ?? new Date().toISOString(),
      email,
    });
  }

  // Hole Project-Metadaten
  const projectIds = Array.from(latest.keys());
  const { data: projects } = await supabase
    .from("hero_dashboard_projects")
    .select("id, project_number, project_name")
    .in("id", projectIds);
  const projectMap = new Map(
    (projects ?? []).map((p) => [
      p.id as string,
      {
        number: p.project_number as string | null,
        name: p.project_name as string | null,
      },
    ]),
  );

  // Hole existierende Reminders
  const { data: existing } = await supabase
    .from("project_reminders")
    .select("id, hero_project_id, remind_at")
    .in("hero_project_id", projectIds);
  const existingMap = new Map(
    (existing ?? []).map((e) => [e.hero_project_id as string, e]),
  );

  let inserted = 0;
  let updated = 0;
  for (const [projectId, info] of latest) {
    const existsEntry = existingMap.get(projectId);
    const meta = projectMap.get(projectId);

    if (existsEntry) {
      if (update) {
        const { error: upErr } = await supabase
          .from("project_reminders")
          .update({
            remind_at: info.date.toISOString(),
            hero_project_number: meta?.number ?? null,
            hero_project_name: meta?.name ?? null,
          })
          .eq("id", (existsEntry as { id: string }).id);
        if (!upErr) updated += 1;
      }
      continue;
    }

    const { error: insErr } = await supabase.from("project_reminders").insert({
      hero_project_id: projectId,
      hero_project_number: meta?.number ?? null,
      hero_project_name: meta?.name ?? null,
      title: `Hero-Erinnerung${meta?.number ? " " + meta.number : ""}`,
      remind_at: info.date.toISOString(),
      created_by_email: info.email,
      created_at: info.entry_date,
    });
    if (!insErr) inserted += 1;
  }

  return NextResponse.json({
    ok: true,
    inserted,
    updated,
    total_history_hits: latest.size,
  });
}
