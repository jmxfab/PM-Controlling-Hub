import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callClaudeMessage } from "@/lib/anthropic/client";

export const runtime = "nodejs";
export const maxDuration = 30;

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

type ProjectCandidate = {
  id: string;
  project_number: string | null;
  project_name: string | null;
  customer_name: string | null;
};

/** Extrahiert Wahrscheinlich-Personen-/Firmennamen aus dem Mail-Body.
 *  Heuristik: Sequenzen aus 2+ Capitalized Worten (so wie "Katja Auffahrt"
 *  oder "Familie Müller GmbH"), plus einzelne Worte mit Umlauten die sich
 *  wie Nachnamen lesen. Wir filtern bekannte Floskeln raus.
 */
function extractCandidateNames(text: string): string[] {
  const STOP = new Set([
    "Sehr", "Geehrte", "Geehrter", "Hallo", "Liebe", "Lieber",
    "Mit", "Beste", "Freundliche", "Grüße", "Gruss",
    "Vielen", "Dank", "Danke",
    "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag",
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember",
    "Kunde", "Kundin", "Frau", "Herr", "Familie",
    "Jumax", "Elektrotechnik", "Elektro", "Anlage", "Anlagen",
    "GmbH", "AG", "OG", "KG", "eU",
    "Photovoltaik", "Waermepumpe", "Wärmepumpe", "Klima",
    "Re", "Aw", "Fwd",
    "Projekt", "Projekts", "Auftrag",
  ]);

  const candidates = new Set<string>();
  // 2-3 grosse Worte hintereinander
  const re = /\b([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+){1,2})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const phrase = m[1].trim();
    const parts = phrase.split(/\s+/);
    // Kein Teil darf Stopword sein (sonst Floskel wie "Sehr geehrte Frau")
    if (parts.some((p) => STOP.has(p))) continue;
    candidates.add(phrase);
    // Auch nur Nachname (letztes Wort) als separate Kandidate
    const last = parts[parts.length - 1];
    if (last.length >= 3 && !STOP.has(last)) candidates.add(last);
  }
  // Single Capitalized "Auffahrt" als Fallback (last words)
  const single = /\b([A-ZÄÖÜ][a-zäöüß]{3,})\b/g;
  while ((m = single.exec(text)) !== null) {
    const w = m[1];
    if (!STOP.has(w)) candidates.add(w);
  }
  return Array.from(candidates).slice(0, 30); // hartes Cap
}

async function searchCandidates(
  supabase: ReturnType<typeof supabaseAdmin>,
  terms: string[],
): Promise<ProjectCandidate[]> {
  if (terms.length === 0) return [];
  // ILIKE pro Term gegen customer_name + project_name. PG OR-Liste.
  const orClauses = terms
    .map((t) => {
      const esc = t.replace(/[%_]/g, "");
      return `customer_name.ilike.%${esc}%,project_name.ilike.%${esc}%`;
    })
    .join(",");
  const { data } = await supabase
    .from("hero_dashboard_projects")
    .select("id, project_number, project_name, customer_name")
    .or(orClauses)
    .limit(40);
  return (data ?? []) as ProjectCandidate[];
}

async function pickViaClaude(
  taskTitle: string,
  taskBody: string,
  candidates: ProjectCandidate[],
): Promise<ProjectCandidate | null> {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const list = candidates
    .slice(0, 20)
    .map(
      (c, i) =>
        `${i + 1}. #${c.project_number ?? "?"} — ${c.project_name ?? "?"} — Kunde: ${c.customer_name ?? "?"}`,
    )
    .join("\n");

  const prompt = `Du bekommst eine Mail und eine Liste moeglicher Hero-Projekte. Waehle das EINE Projekt das am besten passt, basierend auf Kundennamen oder Projektname/Nummer in der Mail.

Wenn KEINES wirklich passt: antworte mit "0".
Sonst: antworte mit der Nummer (1-${Math.min(candidates.length, 20)}) und NUR der Nummer.

MAIL TITEL: ${taskTitle.slice(0, 200)}

MAIL INHALT:
${taskBody.slice(0, 2000)}

PROJEKTE:
${list}

Antworte JETZT nur mit der Zahl:`;

  const raw = await callClaudeMessage({
    prompt,
    model: "claude-haiku-4-5-20251001",
    maxTokens: 10,
    temperature: 0,
  });
  const n = parseInt(raw.trim().replace(/\D/g, ""), 10);
  if (!Number.isFinite(n) || n < 1 || n > candidates.length) return null;
  return candidates[n - 1];
}

/**
 * POST /api/mail-tasks/[id]/match-hero-project
 *
 * Versucht eine Mail-Task automatisch auf ein Hero-Projekt zu mappen.
 * Strategie:
 *   1. Heuristik: Namen aus Title+Body extrahieren
 *   2. ILIKE-Search in hero_dashboard_projects (customer_name + project_name)
 *   3. Bei 1 Treffer: direkt setzen
 *   4. Bei 0/mehr Treffern: Claude waehlt aus Top-20 Kandidaten
 *   5. UPDATE tasks SET hero_project_id, hero_project_number, hero_project_name
 *
 * Response: { matched: boolean, project?: {...}, candidatesFound: number }
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id || id.startsWith("hero-")) {
    return NextResponse.json(
      { error: "ungueltige Task-ID (oder bereits Hero-Task)" },
      { status: 400 },
    );
  }

  const supabase = supabaseAdmin();
  const { data: task, error } = await supabase
    .from("tasks")
    .select("title, description, hero_project_id")
    .eq("id", id)
    .single();
  if (error || !task) {
    return NextResponse.json({ error: "task not found" }, { status: 404 });
  }

  if (task.hero_project_id) {
    return NextResponse.json({
      matched: true,
      alreadyLinked: true,
      project: { id: task.hero_project_id },
      candidatesFound: 0,
    });
  }

  const text = `${task.title ?? ""}\n${task.description ?? ""}`;
  const terms = extractCandidateNames(text);
  const candidates = await searchCandidates(supabase, terms);

  if (candidates.length === 0) {
    return NextResponse.json({ matched: false, candidatesFound: 0 });
  }

  const winner = await pickViaClaude(task.title ?? "", task.description ?? "", candidates);
  if (!winner) {
    return NextResponse.json({
      matched: false,
      candidatesFound: candidates.length,
    });
  }

  // Update Task mit Hero-Projekt-Verknuepfung
  await supabase
    .from("tasks")
    .update({
      hero_project_id: winner.id,
      hero_project_number: winner.project_number,
      hero_project_name: winner.project_name,
    })
    .eq("id", id);

  return NextResponse.json({
    matched: true,
    project: {
      id: winner.id,
      number: winner.project_number,
      name: winner.project_name,
      customer: winner.customer_name,
    },
    candidatesFound: candidates.length,
  });
}
