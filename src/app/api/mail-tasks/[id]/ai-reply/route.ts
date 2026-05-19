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
};

function buildEmailReplyPrompt(
  task: TaskCtx,
  hint: string,
  tone: "kurz" | "freundlich" | "foermlich",
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
Inhalt:
${(task.description ?? "").slice(0, 2000)}

${hint ? `Stichworte vom User (UNBEDINGT einbauen):\n${hint}\n` : ""}
Schreib jetzt die Antwort:`;
}

function buildHeroLogPrompt(task: TaskCtx, hint: string): string {
  return `Du bist Assistent fuer Domenic Wagenleitner (Geschaeftsfuehrer Jumax Elektrotechnik GmbH).
Du formulierst eine INTERNE NOTIZ die als Kommentar in den Hero-Projekt-Logbuch-Verlauf eingetragen wird.

STIL:
- KEINE Anrede ('Hallo X'), KEINE Grussformel ('Viele Gruesse').
- Sehr knapp: 1-3 Saetze. Pure Fakten / Statement / Naechster Schritt.
- Schreibe wie ein Eintrag im internen Projekt-Verlauf — sachlich, kurz.
- Wenn ein Termin/Wert/Name aus dem Kontext klar ist: uebernehme ihn 1:1.
- Wenn unklar: Platzhalter wie [TBC], NIE erfinden.
- Plain-Text, kein Markdown.

Hero-Aufgabe — Kontext:
Titel: ${task.title}
Inhalt:
${(task.description ?? "").slice(0, 2000)}

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
      {
        error:
          "Anthropic-Auth fehlt (ANTHROPIC_OAUTH_TOKEN oder ANTHROPIC_API_KEY in Vercel setzen)",
      },
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

  // Task aus DB laden — wir brauchen title + description (= Mail-Inhalt) fuer den Kontext
  const supabase = supabaseAdmin();
  const { data: task, error } = await supabase
    .from("tasks")
    .select("title, description, mail_category")
    .eq("id", id)
    .single();
  if (error || !task) {
    return NextResponse.json({ error: "task not found" }, { status: 404 });
  }

  const prompt =
    mode === "hero_log"
      ? buildHeroLogPrompt(task, hint)
      : buildEmailReplyPrompt(task, hint, tone);

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
    // Optional: Draft als note speichern damit man die History sieht
    try {
      await supabase
        .from("task_notes")
        .insert({ task_id: id, body: draft, kind: "ai-draft" });
    } catch {
      // silent — Draft ist primary, History ist nice-to-have
    }
    return NextResponse.json({ draft, route: activeAnthropicRoute() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `Anthropic call failed: ${msg}` },
      { status: 502 },
    );
  }
}
