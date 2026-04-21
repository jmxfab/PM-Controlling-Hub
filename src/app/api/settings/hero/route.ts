import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  clearHeroApiKey,
  getHeroApiKeyStatus,
  saveHeroApiKey,
} from "@/lib/settings/hero-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const saveBodySchema = z.object({
  apiKey: z
    .string()
    .trim()
    .min(10, "Der Hero API Key muss mindestens 10 Zeichen lang sein.")
    .max(500, "Der Hero API Key ist ungewöhnlich lang."),
});

export async function GET() {
  try {
    const status = await getHeroApiKeyStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error("[settings/hero][GET] failed", error);
    return NextResponse.json(
      { error: "Status konnte nicht gelesen werden." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungültiger JSON-Body." },
      { status: 400 }
    );
  }

  const parsed = saveBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." },
      { status: 400 }
    );
  }

  try {
    const status = await saveHeroApiKey(parsed.data.apiKey);
    return NextResponse.json(status);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Speichern fehlgeschlagen.";
    console.error("[settings/hero][POST] failed", message);
    return NextResponse.json(
      { error: "Hero API Key konnte nicht gespeichert werden." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await clearHeroApiKey();
    const status = await getHeroApiKeyStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error("[settings/hero][DELETE] failed", error);
    return NextResponse.json(
      { error: "Hero API Key konnte nicht entfernt werden." },
      { status: 500 }
    );
  }
}
