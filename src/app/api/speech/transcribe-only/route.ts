import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/speech/transcribe-only
 *
 * Wie /api/speech/transcribe-and-extract, aber ohne KI-Task-Extraktion.
 * Liefert nur das reine Transkript. Wird vom AI-Chat-Voice-Input benutzt.
 *
 * Multipart-Body: file=audio
 * Response: { transcript: string }
 */
export async function POST(req: NextRequest) {
  // Provider-Auswahl: Aether (gunstig, OpenAI-compat) bevorzugt, OpenAI direkt
  // als Fallback. Eines von beiden muss in Vercel gesetzt sein.
  const aetherKey = process.env.AETHER_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const { baseUrl, apiKey, provider } = aetherKey
    ? {
        baseUrl: "https://api.aetherapi.dev/v1",
        apiKey: aetherKey,
        provider: "aether",
      }
    : openaiKey
      ? {
          baseUrl: "https://api.openai.com/v1",
          apiKey: openaiKey,
          provider: "openai",
        }
      : { baseUrl: "", apiKey: "", provider: "" };
  if (!apiKey) {
    return NextResponse.json(
      { error: "Weder AETHER_API_KEY noch OPENAI_API_KEY gesetzt" },
      { status: 503 },
    );
  }
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "file fehlt" }, { status: 400 });
    }
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "Audio > 25 MB" }, { status: 400 });
    }
    const whisperForm = new FormData();
    whisperForm.append("file", file);
    whisperForm.append("model", "whisper-1");
    whisperForm.append("language", "de");
    whisperForm.append("response_format", "json");
    const res = await fetch(`${baseUrl}/audio/transcriptions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: whisperForm,
        signal: AbortSignal.timeout(25_000),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Whisper-Fehler (${provider}) ${res.status}: ${body.slice(0, 200)}` },
        { status: 502 },
      );
    }
    const json = (await res.json()) as { text?: string };
    return NextResponse.json({ transcript: (json.text ?? "").trim(), provider });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
