import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 15;

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

interface HistoryEntry {
  id: string;
  title: string;
  created_at: string;
  status: string;
  priority: string | null;
  mail_category: string | null;
  thread_message_count: number;
  due_date: string | null;
}

/**
 * GET /api/mail-tasks/history?email=foo@bar.de&days=90
 *
 * Liefert alle Tasks der letzten N Tage, deren description mit "Von: {email}"
 * beginnt. Sortiert neueste zuerst, hart auf 50 Eintraege begrenzt.
 *
 * email = Pflicht
 * days  = optional, default 90, clamp [1..365]
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = (searchParams.get("email") ?? "").trim();
    if (!email) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }
    if (email.length > 200) {
      return NextResponse.json({ error: "email too long" }, { status: 400 });
    }

    const daysRaw = parseInt(searchParams.get("days") ?? "90", 10);
    const days = Math.min(365, Math.max(1, Number.isFinite(daysRaw) ? daysRaw : 90));
    const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const supabase = supabaseAdmin();

    // ILIKE auf description-Prefix. Tasks werden so eingefuegt:
    //   "Von: <email>\n\n<body>"
    // daher matcht "Von: <email>%" zuverlaessig.
    // Sonderzeichen in der Email-Adresse (% _) werden escaped.
    const safeEmail = email.replace(/[%_\\]/g, "\\$&");
    const pattern = `Von: ${safeEmail}%`;

    const { data, error } = await supabase
      .from("tasks")
      .select(
        "id, title, created_at, status, priority, mail_category, thread_message_count, due_date",
      )
      .or("is_automated.eq.true,is_user_created.eq.true")
      .ilike("description", pattern)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json(
        { error: error.message ?? "DB-Fehler" },
        { status: 500 },
      );
    }

    const entries: HistoryEntry[] = (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      created_at: row.created_at,
      status: row.status,
      priority: row.priority ?? null,
      mail_category: row.mail_category ?? null,
      thread_message_count:
        typeof row.thread_message_count === "number"
          ? row.thread_message_count
          : 1,
      due_date: row.due_date ?? null,
    }));

    return NextResponse.json(
      { email, days, total: entries.length, entries },
      {
        headers: {
          // 30s frisch, 120s stale-while-revalidate — History aendert sich
          // nicht so oft dass haeufige refetches noetig waeren.
          "Cache-Control":
            "private, max-age=30, stale-while-revalidate=120",
        },
      },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
