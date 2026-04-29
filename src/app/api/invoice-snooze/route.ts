import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 10;

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

const bodySchema = z.object({
  invoice_id: z.string().min(1).max(50),
  /** Tage in der Zukunft fuer die naechste Erinnerung. Default 7. */
  days: z.number().int().min(1).max(365).default(7),
  note: z.string().max(500).optional(),
  user_email: z.string().email().max(120).optional(),
});

const deleteSchema = z.object({
  invoice_id: z.string().min(1).max(50),
});

/**
 * Snooze (oder Update) einer offenen Rechnung. Setzt snoozed_until auf
 * heute + days. Bei mehrfachem Aufruf wird die Erinnerung verlaengert
 * (= "wenn ich was eintrage wird das neu gesetzt").
 */
export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    );
  }

  const { invoice_id, days, note, user_email } = parsed.data;
  const today = new Date();
  const until = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
  const snoozedUntilIso = until.toISOString().slice(0, 10);

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("invoice_snoozes")
    .upsert(
      {
        invoice_id,
        snoozed_until: snoozedUntilIso,
        note: note ?? null,
        user_email: user_email ?? null,
        snoozed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "invoice_id" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    invoice_id,
    snoozed_until: snoozedUntilIso,
    note: note ?? null,
  });
}

/**
 * Snooze entfernen → Rechnung sofort wieder im Cash-Tab sichtbar.
 */
export async function DELETE(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = deleteSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("invoice_snoozes")
    .delete()
    .eq("invoice_id", parsed.data.invoice_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
