import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  callClaudeMessage,
  hasAnthropicCreds,
  activeAnthropicRoute,
} from "@/lib/anthropic/client";

export const runtime = "nodejs";
export const maxDuration = 30;

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

type TaskCtx = {
  title: string;
  description: string | null;
  mail_category: string | null;
  hero_project_id?: string | null;
  hero_project_number?: string | null;
  hero_project_name?: string | null;
};

type HeroHistoryEntry = {
  entry_date: string | null;
  custom_title: string | null;
  custom_text: string | null;
  description: string | null;
  author_name: string | null;
  event_type: string | null;
};

/** Letzte N Logbuch-Eintraege fuer ein Hero-Projekt laden + als Plain-Text
 *  formatieren, damit die KI den Stand des Projekts kennt bevor sie antwortet. */
function formatHeroHistory(entries: HeroHistoryEntry[]): string {
  if (entries.length === 0) return "";
  const lines = entries.map((h) => {
    const rawText = [h.custom_title, h.custom_text, h.description]
      .filter((s): s is string => Boolean(s))
      .join(" — ");
    const clean = rawText
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 400);
    const date = h.entry_date ? h.entry_date.slice(0, 10) : "?";
    const author = h.author_name ? ` [${h.author_name}]` : "";
    const evt = h.event_type ? ` (${h.event_type})` : "";
    return `- ${date}${author}${evt}: ${clean || "—"}`;
  });
  return lines.join("\n");
}

async function loadHeroHistory(
  supabase: ReturnType<typeof supabaseAdmin>,
  heroProjectId: string,
  limit = 8,
): Promise<HeroHistoryEntry[]> {
  const { data } = await supabase
    .from("hero_histories")
    .select(
      "entry_date, custom_title, custom_text, description, author_name, event_type",
    )
    .eq("project_match_id", heroProjectId)
    .eq("is_deleted", false)
    .order("entry_date", { ascending: false, nullsFirst: false })
    .limit(limit);
  return (data ?? []) as HeroHistoryEntry[];
}

function buildEmailReplyPrompt(
  task: TaskCtx,
  hint: string,
  tone: "kurz" | "freundlich" | "foermlich",
  heroHistoryFormatted: string,
): string {
  const toneInstruction =
    tone === "kurz"
      ? "Stil: kurz und sachlich, 2-3 Saetze, kein Smalltalk."
      : tone === "foermlich"
        ? "Stil: foermlich-professionell, 'Sehr geehrter Herr / Sehr geehrte Frau ...', vollstaendige Saetze."
        : "Stil: freundlich-direkt, du-Anrede wenn vorher du-Anrede da war, sonst Sie. 4-6 Saetze.";
  return `Du bist Assistent fuer Domenic Wagenleitner (Geschaeftsfuehrer Jumax Elektrotechnik GmbH — Photovoltaik, Waermepumpen, Klima, Gebaeudetechnik in Oesterreich).
Du schreibst einen Antwort-Entwurf auf eine Mail-Aufgabe. Beziehe dich DIREKT auf den Email-Inhalt unten — keine generische Antwort.

${toneInstruction}

WICHTIG:
- KEINE erfundenen Fakten (Termine, Zahlen, Personen). Wenn etwas unklar ist, schreibe Platzhalter wie [Termin TBC] oder [Betrag pruefen].
- Antwort beginnt direkt mit Anrede (Hallo / Sehr geehrte ...), endet mit "Viele Gruesse, Domenic" (oder formell: "Mit freundlichen Gruessen, Domenic Wagenleitner").
- Reines Plain-Text, keine Code-Blocks, kein Markdown.
- Frag konkret nach was unklar ist, oder bestaetige was passt.

Mail-Aufgabe — Kontext:
Titel: ${task.title}
Klassifikation: ${task.mail_category ?? "unbekannt"}
${task.hero_project_number ? `Hero-Projekt: ${task.hero_project_number}${task.hero_project_name ? ` (${task.hero_project_name})` : ""}` : ""}
Inhalt:
${(task.description ?? "").slice(0, 2000)}

${heroHistoryFormatted ? `LETZTE LOGBUCH-EINTRAEGE im Hero-Projekt (chronologisch absteigend) — NUTZE diese als Kontext, beziehe dich darauf wenn relevant, aber wiederhole sie nicht 1:1:\n${heroHistoryFormatted}\n` : ""}
${hint ? `Stichworte vom User (UNBEDINGT einbauen):\n${hint}\n` : ""}
Schreib jetzt die Antwort:`;
}

function buildHeroLogPrompt(
  task: TaskCtx,
  hint: string,
  heroHistoryFormatted: string,
): string {
  // Bei Info-Kategorie (z.B. Hero-Benachrichtigung): noch kuerzere Anweisung
  const isInfo = task.mail_category === "info";
  return `Du bist Assistent fuer Domenic Wagenleitner (Geschaeftsfuehrer Jumax Elektrotechnik GmbH).
Du formulierst eine INTERNE NOTIZ die als Kommentar in den Hero-Projekt-Logbuch-Verlauf eingetragen wird.

STIL:
- KEINE Anrede ('Hallo X'), KEINE Grussformel ('Viele Gruesse').
- ${isInfo ? "MAXIMAL 1 Satz. Fasse nur zusammen was passiert ist — kein Aufsatz, keine Erklaerung." : "Sehr knapp: 1-3 Saetze. Pure Fakten / Statement / Naechster Schritt."}
- Schreibe wie ein Eintrag im internen Projekt-Verlauf — sachlich, kurz.
- Wenn ein Termin/Wert/Name aus dem Kontext klar ist: uebernehme ihn 1:1.
- Wenn unklar: Platzhalter wie [TBC], NIE erfinden.
- Plain-Text, kein Markdown.

Hero-Aufgabe — Kontext:
Titel: ${task.title}
${task.hero_project_number ? `Hero-Projekt: ${task.hero_project_number}${task.hero_project_name ? ` (${task.hero_project_name})` : ""}` : ""}
Inhalt:
${(task.description ?? "").slice(0, 2000)}

${heroHistoryFormatted ? `BISHERIGE LOGBUCH-EINTRAEGE des Projekts (chronologisch absteigend) — KEINE Wiederholung dieser Inhalte, nur Bezug nehmen wenn naturgemaess noetig (z.B. "wie am 12.05. besprochen"):\n${heroHistoryFormatted}\n` : ""}
${hint ? `Stichworte vom User (UNBEDINGT einbauen):\n${hint}\n` : ""}
Schreib jetzt die interne Logbuch-Notiz:`;
}

/**
 * POST /api/mail-tasks/[id]/ai-reply
 *
 * Generiert einen Antwort-Vorschlag fuer die Mail-Aufgabe via Claude Haiku.
 * Input: optionale 'hint' (Stichworte des Users), 'tone' (kurz/freundlich/foermlich)
 * Output: { draft: string }  — ready zum Editieren im Composer.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  if (!hasAnthropicCreds()) {
    return NextResponse.json(
      { error: "AI-Route nicht verfuegbar (n8n-Webhook + Anthropic-Fallback beide fehlen)" },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    hint?: string;
    tone?: "kurz" | "freundlich" | "foermlich";
    mode?: "email" | "hero_log";
  };
  const hint = (body.hint ?? "").trim().slice(0, 1000);
  const tone = body.tone ?? "freundlich";
  const mode = body.mode === "hero_log" ? "hero_log" : "email";

  // Task laden — unterschiedlich je nach Source:
  //  - Mail-Task (normale UUID): aus tasks-Tabelle
  //  - Hero-Task (Praefix 'hero-'): aus hero_notifications, dann hero_projects
  //    fuer Project-Namen + hero_histories fuer Logbuch-Kontext
  const supabase = supabaseAdmin();
  const isHero = id.startsWith("hero-");
  let task: TaskCtx | null = null;

  if (isHero) {
    const heroId = id.slice("hero-".length);
    const { data: note, error: nErr } = await supabase
      .from("hero_notifications")
      .select("title, body, target_id")
      .eq("id", heroId)
      .single();
    if (nErr || !note) {
      return NextResponse.json(
        { error: "hero notification not found" },
        { status: 404 },
      );
    }
    let projectNumber: string | null = null;
    let projectName: string | null = null;
    if (note.target_id) {
      const { data: proj } = await supabase
        .from("hero_projects")
        .select("project_number, project_name")
        .eq("id", note.target_id)
        .single();
      projectNumber = (proj?.project_number as string | null) ?? null;
      projectName = (proj?.project_name as string | null) ?? null;
    }
    task = {
      title: note.title ?? "(ohne Titel)",
      description: note.body ?? null,
      mail_category: "aufgabe",
      hero_project_id: note.target_id ?? null,
      hero_project_number: projectNumber,
      hero_project_name: projectName,
    };
  } else {
    const { data: row } = await supabase
      .from("tasks")
      .select(
        "title, description, mail_category, hero_project_id, hero_project_number, hero_project_name",
      )
      .eq("id", id)
      .maybeSingle();
    if (row) {
      task = row as TaskCtx;
    } else {
      // Fallback: vielleicht ist die ID doch eine hero_notification ohne
      // 'hero-' Praefix (z.B. wenn der Client den Praefix verloren hat).
      const { data: noteRow } = await supabase
        .from("hero_notifications")
        .select("title, body, target_id")
        .eq("id", id)
        .maybeSingle();
      if (noteRow) {
        let projectNumber: string | null = null;
        let projectName: string | null = null;
        if (noteRow.target_id) {
          const { data: proj } = await supabase
            .from("hero_projects")
            .select("project_number, project_name")
            .eq("id", noteRow.target_id)
            .maybeSingle();
          projectNumber = (proj?.project_number as string | null) ?? null;
          projectName = (proj?.project_name as string | null) ?? null;
        }
        task = {
          title: noteRow.title ?? "(ohne Titel)",
          description: noteRow.body ?? null,
          mail_category: "aufgabe",
          hero_project_id: noteRow.target_id ?? null,
          hero_project_number: projectNumber,
          hero_project_name: projectName,
        };
      } else {
        return NextResponse.json(
          {
            error: `Task mit ID ${id.slice(0, 36)} nicht gefunden — vermutlich zwischendurch geloescht oder in eine andere Kategorie verschoben. Seite neu laden.`,
          },
          { status: 404 },
        );
      }
    }
  }

  // Letzte 8 Logbuch-Eintraege laden — nur wenn Task an Hero-Projekt haengt.
  // Wir wollen, dass die KI weiss was zuletzt im Projekt-Verlauf stand,
  // damit sie kontextbezogen antworten kann statt generisch.
  const heroHistory =
    task.hero_project_id != null
      ? await loadHeroHistory(supabase, task.hero_project_id, 8)
      : [];
  const heroHistoryFormatted = formatHeroHistory(heroHistory);

  const prompt =
    mode === "hero_log"
      ? buildHeroLogPrompt(task, hint, heroHistoryFormatted)
      : buildEmailReplyPrompt(task, hint, tone, heroHistoryFormatted);

  try {
    const draft = await callClaudeMessage({
      prompt,
      model: "claude-haiku-4-5-20251001",
      maxTokens: 600,
    });
    if (!draft) {
      return NextResponse.json(
        { error: "Leerer Entwurf zurueckgekommen" },
        { status: 502 },
      );
    }
    // Optional: Draft als note speichern damit man die History sieht.
    // Nur fuer echte Mail-Tasks (Hero-IDs sind synthetisch + waeren FK-Verstoss).
    if (!isHero) {
      try {
        await supabase
          .from("task_notes")
          .insert({ task_id: id, body: draft, kind: "ai-draft" });
      } catch {
        // silent — Draft ist primary, History ist nice-to-have
      }
    }
    return NextResponse.json({
      draft,
      route: activeAnthropicRoute(),
      heroHistoryCount: heroHistory.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `Anthropic call failed: ${msg}` },
      { status: 502 },
    );
  }
}
