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
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY fehlt fuer Whisper" },
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
    const res = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: whisperForm,
        signal: AbortSignal.timeout(25_000),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Whisper-Fehler ${res.status}: ${body.slice(0, 200)}` },
        { status: 502 },
      );
    }
    const json = (await res.json()) as { text?: string };
    return NextResponse.json({ transcript: (json.text ?? "").trim() });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
