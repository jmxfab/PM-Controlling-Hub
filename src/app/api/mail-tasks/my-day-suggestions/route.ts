import { NextResponse } from "next/server";
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
 * GET /api/mail-tasks/my-day-suggestions
 *
 * MS-To-Do-Style "Vorschläge" Panel fuer den Mein-Tag-Tab:
 * Listet bis zu 12 offene Tasks die NOCH NICHT in Mein Tag sind, sortiert
 * nach Relevanz:
 *   1. Wichtige (is_important) zuerst
 *   2. Priorisierte (urgent/high) als naechstes
 *   3. Innerhalb gleicher Stufe: juengste zuerst (max 30 Tage alt)
 */
export async function GET() {
  try {
    const supabase = supabaseAdmin();
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data, error } = await supabase
      .from("tasks")
      .select(
        "id, title, description, mail_category, priority, due_date, created_at, is_important",
      )
      .or("is_automated.eq.true,is_user_created.eq.true")
      .neq("status", "done")
      .neq("status", "cancelled")
      .is("in_my_day_at", null)
      .gte("created_at", thirtyDaysAgo)
      .order("is_important", { ascending: false })
      .order("priority", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(12);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      suggestions: data ?? [],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
