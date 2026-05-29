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

const ALLOWED_KINDS = ["note", "mailto", "ai-draft", "hero-log"] as const;
type NoteKind = (typeof ALLOWED_KINDS)[number];

interface NoteRow {
  id: string;
  task_id: string;
  body: string;
  kind: NoteKind;
  created_at: string;
}

/**
 * GET /api/mail-tasks/[id]/notes
 * Liefert alle Notizen einer Aufgabe, neueste zuerst (max 50).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("task_notes")
    .select("id, task_id, body, kind, created_at")
    .eq("task_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ notes: (data ?? []) as NoteRow[] });
}

/**
 * POST /api/mail-tasks/[id]/notes
 * Body: { body: string, kind?: 'note'|'mailto'|'ai-draft'|'hero-log' }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    body?: string;
    kind?: string;
  };
  const text = (body.body ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "body required" }, { status: 400 });
  }
  if (text.length > 4000) {
    return NextResponse.json(
      { error: "body too long (max 4000)" },
      { status: 400 },
    );
  }
  const kind: NoteKind =
    body.kind && (ALLOWED_KINDS as readonly string[]).includes(body.kind)
      ? (body.kind as NoteKind)
      : "note";

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("task_notes")
    .insert({ task_id: id, body: text, kind })
    .select("id, task_id, body, kind, created_at")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ note: data as NoteRow });
}
