import { NextRequest, NextResponse } from "next/server";
import { callClaudeMessage } from "@/lib/anthropic/client";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/speech/transcribe-and-extract
 *
 * Multipart body:
 *   - file: audio/webm | audio/mp4 | audio/wav (vom Browser MediaRecorder)
 *
 * Pipeline:
 *   1. Audio -> OpenAI Whisper API (Transkript in Deutsch)
 *   2. Transkript -> Claude (extrahiert strukturierte Tasks als JSON)
 *
 * Response: { transcript, tasks: [{title, description, priority, due_date, mail_category}] }
 *
 * Env-Vars:
 *   OPENAI_API_KEY (Pflicht fuer Whisper)
 *   Anthropic Auth ueber callClaudeMessage (n8n / OAuth / API-Key Routing)
 */
export async function POST(req: NextRequest) {
  try {
    // Aether (OpenAI-compat, guenstiger) bevorzugt, OpenAI als Fallback
    const aetherKey = process.env.AETHER_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const { baseUrl, apiKey } = aetherKey
      ? { baseUrl: "https://api.aetherapi.dev/v1", apiKey: aetherKey }
      : openaiKey
        ? { baseUrl: "https://api.openai.com/v1", apiKey: openaiKey }
        : { baseUrl: "", apiKey: "" };
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Weder AETHER_API_KEY noch OPENAI_API_KEY in Vercel gesetzt — Speech-to-Text braucht Whisper-Zugriff.",
        },
        { status: 503 },
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "file (audio) fehlt" }, { status: 400 });
    }
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Audio > 25 MB (Whisper-Limit)" },
        { status: 400 },
      );
    }

    // === Schritt 1: Whisper (via Aether oder OpenAI) ===
    const whisperForm = new FormData();
    whisperForm.append("file", file);
    whisperForm.append("model", "whisper-1");
    whisperForm.append("language", "de");
    whisperForm.append("response_format", "json");

    const whisperRes = await fetch(`${baseUrl}/audio/transcriptions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: whisperForm,
        signal: AbortSignal.timeout(50_000),
      },
    );

    if (!whisperRes.ok) {
      const body = await whisperRes.text().catch(() => "");
      return NextResponse.json(
        { error: `Whisper-Fehler ${whisperRes.status}: ${body.slice(0, 200)}` },
        { status: 502 },
      );
    }

    const whisperJson = (await whisperRes.json()) as { text?: string };
    const transcript = (whisperJson.text ?? "").trim();
    if (!transcript) {
      return NextResponse.json(
        { transcript: "", tasks: [], note: "Leeres Transkript" },
        { status: 200 },
      );
    }

    // === Schritt 2: Claude extrahiert Tasks ===
    const today = new Date().toISOString().slice(0, 10);
    const prompt = `Du bist Domenic Wagenleitner's Assistent (Jumax Elektrotechnik). Aus diesem gesprochenen Notizen-Transkript extrahierst du EINE oder mehrere Aufgaben.

Heute ist ${today}.

REGEL:
- Pro klar abgegrenzter Handlung EINE Task
- "morgen", "naechste Woche", "Freitag" etc. in absolutes ISO-Datum konvertieren (YYYY-MM-DD).
  Beispiele:
    "morgen" -> ${new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
    "Freitag" -> naechster Freitag ab heute
    "in 2 Tagen" -> entsprechend
- Priorität ableiten:
    "dringend" / "sofort" / "asap" -> urgent
    "wichtig" / "bald" -> high
    keine zeitliche Signalisierung -> medium
- mail_category passend zuordnen: "aufgabe" (Standard), "kritisch" (Notfall), "rechnung" (Geld-Thema), "info" (FYI)

OUTPUT-FORMAT — REINES JSON-ARRAY, KEIN WRAPPER, KEINE ERKLAERUNG, KEIN MARKDOWN:
[
  {
    "title": "Kurzer praegnanter Titel (max 80 Zeichen, Imperativ wenn moeglich)",
    "description": "Optional 1-2 Saetze mehr Kontext aus dem Transkript",
    "priority": "urgent" | "high" | "medium" | "low",
    "due_date": "YYYY-MM-DD" oder null,
    "mail_category": "aufgabe" | "kritisch" | "rechnung" | "info"
  }
]

TRANSKRIPT:
"""
${transcript.slice(0, 4000)}
"""

Antworte JETZT mit dem JSON-Array:`;

    const raw = await callClaudeMessage({
      prompt,
      model: "claude-haiku-4-5-20251001",
      maxTokens: 800,
      temperature: 0.2,
    });

    // Markdown-Fences strippen falls Claude sie trotz Anweisung dranklebt
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    let tasks: Array<{
      title: string;
      description?: string;
      priority?: string;
      due_date?: string | null;
      mail_category?: string;
    }> = [];
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) tasks = parsed;
    } catch {
      // Versuch: erstes JSON-Array im Text finden
      const m = cleaned.match(/\[[\s\S]*\]/);
      if (m) {
        try {
          const p = JSON.parse(m[0]);
          if (Array.isArray(p)) tasks = p;
        } catch {
          /* fall through */
        }
      }
    }

    // Sanity-Filter: title ist Pflicht
    const VALID_PRIO = new Set(["urgent", "high", "medium", "low"]);
    const VALID_CAT = new Set([
      "aufgabe",
      "kritisch",
      "info",
      "rechnung",
      "bestellung",
      "dringend",
      "inbox",
    ]);
    const filtered = tasks
      .filter((t) => typeof t.title === "string" && t.title.trim().length > 0)
      .slice(0, 8) // hartes Cap
      .map((t) => ({
        title: t.title.trim().slice(0, 200),
        description:
          typeof t.description === "string" ? t.description.trim() : "",
        priority: VALID_PRIO.has(String(t.priority)) ? t.priority : "medium",
        due_date:
          typeof t.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.due_date)
            ? t.due_date
            : null,
        mail_category: VALID_CAT.has(String(t.mail_category))
          ? t.mail_category
          : "aufgabe",
      }));

    return NextResponse.json({ transcript, tasks: filtered });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
