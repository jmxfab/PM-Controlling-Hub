import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 15;

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      status?: "open" | "in_progress" | "waiting" | "done" | "cancelled";
      due_date?: string | null;
    };

    const update: Record<string, unknown> = {};
    if (body.status !== undefined) {
      update.status = body.status;
      update.completed_at = body.status === "done" ? new Date().toISOString() : null;
    }
    if (body.due_date !== undefined) update.due_date = body.due_date;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const { error } = await supabase.from("tasks").update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, id, update });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
