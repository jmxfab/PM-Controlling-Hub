import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callClaudeMessage } from "@/lib/anthropic/client";

export const runtime = "nodejs";
export const maxDuration = 30;

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

export interface ProjectHistoryEntry {
  id: string;
  entry_date: string | null;
  event_type: string | null;
  user_email: string | null;
  author_name: string | null;
  custom_title: string | null;
  custom_text: string | null;
  description: string | null;
}

export interface ProjectHistoryResult {
  projectId: string;
  projectNumber: string | null;
  projectName: string | null;
  entries: ProjectHistoryEntry[];
  total: number;
  /** Claude-Zusammenfassung + Handlungsempfehlung */
  analysis: {
    summary: string;
    nextStep: string;
    status: string;
  } | null;
}

/**
 * GET /api/mail-tasks/[id]/project-history
 *
 * Laedt die letzten Logbuch-Eintraege des verknuepften Hero-Projekts
 * und analysiert sie mit Claude (aehnlich wie Pulse).
 * Wird lazy geladen — nur auf Klick des Users, nicht beim Card-Load.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id fehlt" }, { status: 400 });

  const supabase = supabaseAdmin();

  // 1. Task/Hero-Notification: hero_project_id auflösen
  const isHero = id.startsWith("hero-");
  let heroProjectUuid: string | null = null;

  if (isHero) {
    const heroId = id.slice("hero-".length);
    const { data } = await supabase
      .from("hero_notifications")
      .select("target_id")
      .eq("id", heroId)
      .maybeSingle();
    heroProjectUuid = (data?.target_id as string | null) ?? null;
  } else {
    const { data } = await supabase
      .from("tasks")
      .select("hero_project_id")
      .eq("id", id)
      .maybeSingle();
    heroProjectUuid = (data?.hero_project_id as string | null) ?? null;
  }

  if (!heroProjectUuid) {
    return NextResponse.json(
      { error: "Kein Hero-Projekt verknüpft" },
      { status: 400 },
    );
  }

  // 2. Projekt-Metadaten + project_match_id
  const { data: proj } = await supabase
    .from("hero_projects")
    .select("id, project_number, project_name, project_match_id")
    .eq("id", heroProjectUuid)
    .maybeSingle();

  if (!proj) {
    return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
  }

  // 3. Logbuch-Einträge laden (letzten 30)
  const { data: rawEntries, count } = await supabase
    .from("hero_histories")
    .select(
      "id, entry_date, event_type, user_email, author_name, custom_title, custom_text",
      { count: "exact" },
    )
    .eq("project_match_id", proj.project_match_id)
    .eq("is_deleted", false)
    .order("entry_date", { ascending: false, nullsFirst: false })
    .limit(30);

  const entries: ProjectHistoryEntry[] = (rawEntries ?? []).map((e) => ({
    id: String(e.id),
    entry_date: e.entry_date ?? null,
    event_type: e.event_type ?? null,
    user_email: e.user_email ?? null,
    author_name: e.author_name ?? null,
    custom_title: e.custom_title ?? null,
    custom_text: e.custom_text
      ? (e.custom_text as string).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400)
      : null,
    description: null,
  }));

  // 4. Claude-Analyse (max 512 Tokens, schnell)
  let analysis: ProjectHistoryResult["analysis"] = null;
  if (entries.length > 0) {
    try {
      const logText = entries
        .slice(0, 15) // nur letzte 15 für den Prompt
        .map((e) => {
          const date = e.entry_date
            ? new Date(e.entry_date).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "2-digit" })
            : "?";
          const author = e.author_name ?? e.user_email ?? "?";
          const title = e.custom_title ?? e.event_type ?? "Eintrag";
          const body = e.custom_text ? ` — ${e.custom_text.slice(0, 150)}` : "";
          return `${date} [${author}] ${title}${body}`;
        })
        .join("\n");

      const prompt = `Du analysierst den Projektverlauf eines Elektrotechnik-Projekts (${proj.project_number ?? ""} ${(proj.project_name as string | null) ?? ""}).

Logbuch (neueste zuerst):
${logText}

Antworte NUR als JSON:
{
  "summary": "1-2 Sätze: Was ist aktueller Stand des Projekts?",
  "nextStep": "1 Satz: Was ist der konkrete nächste Handlungsschritt?",
  "status": "on_track" | "attention" | "blocked"
}`;

      const raw = await callClaudeMessage({
        prompt,
        model: "claude-haiku-4-5-20251001",
        maxTokens: 256,
        system: "Du bist ein präziser Projekt-Analyst. Antworte NUR als gültiges JSON.",
      });

      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      const parsed = JSON.parse(cleaned) as {
        summary?: string;
        nextStep?: string;
        status?: string;
      };
      analysis = {
        summary: (parsed.summary ?? "").slice(0, 400),
        nextStep: (parsed.nextStep ?? "").slice(0, 300),
        status: (["on_track", "attention", "blocked"].includes(parsed.status ?? ""))
          ? (parsed.status as string)
          : "on_track",
      };
    } catch {
      // Analyse-Fehler ist nicht kritisch — UI zeigt nur die Eintraege
    }
  }

  const result: ProjectHistoryResult = {
    projectId: proj.id as string,
    projectNumber: proj.project_number as string | null,
    projectName: proj.project_name as string | null,
    entries,
    total: count ?? entries.length,
    analysis,
  };

  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" },
  });
}
