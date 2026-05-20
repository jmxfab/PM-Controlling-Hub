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
 * GET /api/ai/chat/sessions?search=foo&days=30
 *
 * Listet die Chat-Sessions, sortiert nach updated_at DESC.
 * Optional:
 *   - search: Volltext-Suche in Message-Contents (joined)
 *   - days:   nur Sessions juenger als N Tage (default 365)
 *
 * Response: { sessions: [{id, title, updated_at, message_count}] }
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") ?? "").trim();
    const days = parseInt(searchParams.get("days") ?? "365", 10);
    const cutoff = new Date(
      Date.now() - Math.max(1, days) * 86_400_000,
    ).toISOString();

    const supabase = supabaseAdmin();

    if (search) {
      // Volltext-Search ueber message.content -> distinct sessions
      // Aether-style: einfache ilike-Suche statt fulltext, ist schneller fuer
      // kleine Datenmenge und gibt direkt Treffer-Snippets zurueck.
      const safe = search.replace(/[,()*%\\]/g, " ").trim();
      if (!safe) {
        return NextResponse.json({ sessions: [] });
      }
      const { data: msgs } = await supabase
        .from("ai_chat_messages")
        .select("session_id")
        .ilike("content", `%${safe}%`)
        .gte("created_at", cutoff)
        .limit(500);
      const sessionIds = Array.from(
        new Set((msgs ?? []).map((m) => m.session_id)),
      );
      if (sessionIds.length === 0) return NextResponse.json({ sessions: [] });
      const { data } = await supabase
        .from("ai_chat_sessions")
        .select("id, title, updated_at, message_count")
        .in("id", sessionIds)
        .order("updated_at", { ascending: false })
        .limit(50);
      return NextResponse.json({ sessions: data ?? [] });
    }

    const { data, error } = await supabase
      .from("ai_chat_sessions")
      .select("id, title, updated_at, message_count")
      .gte("updated_at", cutoff)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ sessions: data ?? [] });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
