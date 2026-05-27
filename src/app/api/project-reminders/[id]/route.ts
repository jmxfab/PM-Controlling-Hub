import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 10;

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

/**
 * PATCH /api/project-reminders/[id]
 *
 * Updated eine Erinnerung — fuer Dismiss (X-Klick) oder Snooze ("Erneut erinnern").
 *
 * Body: {
 *   dismissed?: boolean          // true -> dismissed_at = NOW, false -> dismissed_at = NULL
 *   snooze_days?: number         // in N Tagen erinnern (1, 3, 7, beliebig)
 *   remind_at?: string (ISO)     // expliziter neuer Zeitpunkt (alternativ zu snooze_days)
 *   title?: string
 *   note?: string
 * }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      dismissed?: boolean;
      snooze_days?: number;
      remind_at?: string;
      title?: string;
      note?: string;
    };

    const update: Record<string, unknown> = {};

    if (body.dismissed !== undefined) {
      update.dismissed_at = body.dismissed ? new Date().toISOString() : null;
    }

    if (typeof body.snooze_days === "number" && Number.isFinite(body.snooze_days)) {
      const days = Math.max(1, Math.min(365, Math.round(body.snooze_days)));
      const next = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      update.remind_at = next.toISOString();
      update.dismissed_at = null; // wieder aktiv
      // snoozed_count via RPC waere besser, aber wir machen einen separaten Increment
    } else if (body.remind_at) {
      const d = new Date(body.remind_at);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json(
          { error: "remind_at ist kein gueltiges Datum" },
          { status: 400 },
        );
      }
      update.remind_at = d.toISOString();
      update.dismissed_at = null;
    }

    if (body.title !== undefined && typeof body.title === "string") {
      update.title = body.title.trim().slice(0, 200);
    }
    if (body.note !== undefined) {
      update.note = body.note?.slice(0, 4000) ?? null;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nichts zu aktualisieren" }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    // Bei Snooze: snoozed_count um 1 erhoehen via RPC-Style 2-Step-Query
    if (typeof body.snooze_days === "number") {
      const { data: cur } = await supabase
        .from("project_reminders")
        .select("snoozed_count")
        .eq("id", id)
        .maybeSingle();
      update.snoozed_count = (cur?.snoozed_count ?? 0) + 1;
    }

    const { error } = await supabase
      .from("project_reminders")
      .update(update)
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id, update });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/project-reminders/[id]
 *
 * Loescht eine Erinnerung permanent (z.B. weil sie irrtuemlich angelegt wurde).
 * Fuer normales "weg-klicken" sollte stattdessen PATCH dismissed:true verwendet
 * werden — das ist reversibel + behaelt die History.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = supabaseAdmin();
    const { error } = await supabase
      .from("project_reminders")
      .delete()
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
