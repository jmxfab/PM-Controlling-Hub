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
    // 'prompt' biased Whisper auf erwartetes Vokabular UND reduziert die
    // beruechtigten Halluzinationen bei stillen/leeren Aufnahmen
    // ('Untertitel der Amara.org-Community', 'Vielen Dank fuers Zuschauen').
    whisperForm.append(
      "prompt",
      "Jumax Elektrotechnik, Photovoltaik, Waermepumpe, Klima, Aufgabe, Termin, Kunde, Projekt, Anruf, Mueller, Anlage.",
    );
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
    const rawText = (json.text ?? "").trim();
    // Whisper-Halluzinations-Filter: bei stillen/sehr kurzen Aufnahmen
    // erzeugt Whisper bekannte Phrasen aus dem YouTube-Training. Wenn das
    // GANZE Transkript so eine Phrase ist -> als leer behandeln.
    const HALLUCINATIONS = [
      /^untertitel(ung)?( der amara\.org-community)?\.?$/i,
      /^vielen dank f(ue|ü)rs? zuschauen[.!]?$/i,
      /^(bis zum n(ä|ae)chsten mal[.!]?)$/i,
      /^danke f(ue|ü)r['s]* zuschauen[.!]?$/i,
      /^musik\.?$/i,
      /^\[musik\]$/i,
    ];
    const isHallucination = HALLUCINATIONS.some((re) => re.test(rawText));
    const transcript = isHallucination ? "" : rawText;
    return NextResponse.json({
      transcript,
      provider,
      ...(isHallucination ? { note: "Whisper-Halluzination gefiltert" } : {}),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
