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
 * GET /api/ai/chat/sessions/[id]
 * Liefert eine einzelne Session inkl. allen Messages chronologisch.
 *
 * Response: { session: {id, title, updated_at}, messages: [{role, content, tool_names, created_at}] }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id fehlt" }, { status: 400 });
  try {
    const supabase = supabaseAdmin();
    const [{ data: session }, { data: messages }] = await Promise.all([
      supabase
        .from("ai_chat_sessions")
        .select("id, title, created_at, updated_at, message_count")
        .eq("id", id)
        .single(),
      supabase
        .from("ai_chat_messages")
        .select("role, content, tool_names, created_at")
        .eq("session_id", id)
        .order("created_at", { ascending: true }),
    ]);
    if (!session) {
      return NextResponse.json({ error: "session not found" }, { status: 404 });
    }
    return NextResponse.json({ session, messages: messages ?? [] });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/ai/chat/sessions/[id]
 * Loescht eine Session + alle Messages (cascade).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id fehlt" }, { status: 400 });
  try {
    const supabase = supabaseAdmin();
    const { error } = await supabase
      .from("ai_chat_sessions")
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
