import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { berlinIsoNoon } from "@/lib/dashboard/berlin-iso";

export const runtime = "nodejs";
export const maxDuration = 10;

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

const bodySchema = z.object({
  /** ISO-Datum (YYYY-MM-DD oder voller Timestamp) oder null zum Loeschen. */
  age_reset_at: z.union([z.string().min(1).max(40), z.null()]),
  age_reset_note: z.string().max(500).nullable().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id missing" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  let resetAt: string | null = null;
  if (parsed.data.age_reset_at) {
    const raw = parsed.data.age_reset_at;
    const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(raw)
      ? berlinIsoNoon(raw)
      : raw;
    const parsedDate = new Date(isoDate);
    if (Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: "invalid age_reset_at date" },
        { status: 400 }
      );
    }
    resetAt = parsedDate.toISOString();
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("hero_projects")
    .update({
      age_reset_at: resetAt,
      age_reset_note: parsed.data.age_reset_note ?? null,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // MV refresh damit der neue Wert sofort in loadLongestRunning sichtbar ist.
  try {
    await supabase.rpc("refresh_hero_dashboard_projects");
  } catch {
    // Refresh-Fehler ignorieren — Werte landen spaetestens beim naechsten
    // automatischen MV-Refresh in der Anzeige.
  }

  return NextResponse.json({
    ok: true,
    id,
    age_reset_at: resetAt,
    age_reset_note: parsed.data.age_reset_note ?? null,
  });
}
