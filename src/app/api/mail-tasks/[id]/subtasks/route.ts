import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 30;

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    if (typeof o.message === "string") return o.message;
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }
  return String(e);
}

interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * POST: Generiert via Claude eine Subtask-Checkliste aus title + body.
 * Body kann optional `regenerate: true` enthalten -> ueberschreibt bestehende.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      regenerate?: boolean;
    };

    const supabase = supabaseAdmin();
    const { data: task, error: fetchErr } = await supabase
      .from("tasks")
      .select("id, title, description, subtasks")
      .eq("id", id)
      .single();
    if (fetchErr || !task) {
      return NextResponse.json({ error: errMsg(fetchErr) || "Task nicht gefunden" }, { status: 404 });
    }

    const existing = Array.isArray(task.subtasks) ? (task.subtasks as Subtask[]) : [];
    if (existing.length > 0 && !body.regenerate) {
      return NextResponse.json({ subtasks: existing, regenerated: false });
    }

    // Claude-Call laeuft ueber n8n-Webhook — n8n hat die Anthropic-Credential
    // bereits konfiguriert (CIVOmhKOUSF1m3z6), wir brauchen keinen API-Key
    // hier in Vercel zu hinterlegen.
    const webhookUrl =
      process.env.N8N_SUBTASK_WEBHOOK_URL ||
      "https://n8n-eree.srv1603751.hstgr.cloud/webhook/subtask-generate";

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: task.title,
        description: (task.description ?? "").slice(0, 2000),
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `n8n-Webhook ${res.status}: ${txt.slice(0, 200)}` },
        { status: 502 },
      );
    }

    const json = (await res.json().catch(() => ({}))) as { titles?: string[] };
    const titles = (json.titles ?? [])
      .filter((t) => typeof t === "string" && t.trim().length > 0)
      .map((t) => t.trim().slice(0, 200))
      .slice(0, 7);

    if (titles.length === 0) {
      return NextResponse.json(
        { error: "Keine Schritte generiert — bitte erneut versuchen" },
        { status: 502 },
      );
    }

    const subtasks: Subtask[] = titles.map((title) => ({
      id: makeId(),
      title,
      done: false,
    }));

    const { error: updateErr } = await supabase
      .from("tasks")
      .update({ subtasks })
      .eq("id", id);
    if (updateErr) {
      return NextResponse.json({ error: errMsg(updateErr) }, { status: 500 });
    }

    return NextResponse.json({ subtasks, regenerated: existing.length > 0 });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

/**
 * PATCH: Togglet einen Subtask oder updated titel.
 * Body: { subtaskId: string, done?: boolean, title?: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      subtaskId?: string;
      done?: boolean;
      title?: string;
    };

    if (!body.subtaskId) {
      return NextResponse.json({ error: "subtaskId required" }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const { data: task, error: fetchErr } = await supabase
      .from("tasks")
      .select("subtasks")
      .eq("id", id)
      .single();
    if (fetchErr || !task) {
      return NextResponse.json({ error: "Task nicht gefunden" }, { status: 404 });
    }

    const current = Array.isArray(task.subtasks) ? (task.subtasks as Subtask[]) : [];
    const updated = current.map((s) =>
      s.id === body.subtaskId
        ? {
            ...s,
            done: body.done !== undefined ? body.done : s.done,
            title: body.title !== undefined ? body.title : s.title,
          }
        : s,
    );

    const { error: updateErr } = await supabase
      .from("tasks")
      .update({ subtasks: updated })
      .eq("id", id);
    if (updateErr) {
      return NextResponse.json({ error: errMsg(updateErr) }, { status: 500 });
    }

    return NextResponse.json({ subtasks: updated });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

/**
 * DELETE: Loescht alle Subtasks (Reset).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = supabaseAdmin();
    const { error } = await supabase
      .from("tasks")
      .update({ subtasks: [] })
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: errMsg(error) }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
