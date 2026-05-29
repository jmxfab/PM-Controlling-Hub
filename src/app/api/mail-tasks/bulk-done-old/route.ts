import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 30;

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

const VALID_CATEGORIES = new Set([
  "info",
  "aufgabe",
  "dringend",
  "kritisch",
  "rechnung",
  "bestellung",
  "inbox",
]);

/**
 * POST /api/mail-tasks/bulk-done-old
 *
 * Body: { categories: string[], olderThanDays: number, dryRun?: boolean }
 *
 * Setzt alle offenen Tasks der gegebenen Kategorien aelter als N Tage
 * auf status=done + completed_at=now. dryRun=true gibt nur den Count
 * zurueck ohne zu schreiben.
 *
 * Response: { affected: number, dryRun: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      categories?: unknown;
      olderThanDays?: unknown;
      dryRun?: unknown;
    };

    const cats = Array.isArray(body.categories)
      ? (body.categories as unknown[])
          .filter((c): c is string => typeof c === "string")
          .filter((c) => VALID_CATEGORIES.has(c))
      : [];
    if (cats.length === 0) {
      return NextResponse.json(
        { error: "categories: leeres Array oder ungueltige Werte" },
        { status: 400 },
      );
    }

    const days =
      typeof body.olderThanDays === "number" ? body.olderThanDays : 30;
    if (!Number.isFinite(days) || days < 7 || days > 365) {
      return NextResponse.json(
        { error: "olderThanDays muss 7-365 sein (Sicherheits-Floor)" },
        { status: 400 },
      );
    }

    const dryRun = body.dryRun === true;
    const cutoff = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000,
    ).toISOString();

    const supabase = supabaseAdmin();

    // Zaehle erst — damit der User vor Confirm die Zahl sieht
    const { count, error: countErr } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .in("mail_category", cats)
      .neq("status", "done")
      .neq("status", "cancelled")
      .is("in_my_day_at", null) // Sicherheitsnetz: Mein-Tag-Items NIE bulk-archivieren
      .lt("created_at", cutoff);

    if (countErr) {
      return NextResponse.json({ error: countErr.message }, { status: 500 });
    }

    const affected = count ?? 0;
    if (dryRun || affected === 0) {
      return NextResponse.json({ affected, dryRun: true });
    }

    const { error: updateErr } = await supabase
      .from("tasks")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .in("mail_category", cats)
      .neq("status", "done")
      .neq("status", "cancelled")
      .is("in_my_day_at", null)
      .lt("created_at", cutoff);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ affected, dryRun: false });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
