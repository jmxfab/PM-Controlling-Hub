import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 15;

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

const VALID_STATUS = new Set([
  "open",
  "in_progress",
  "waiting",
  "controlling",
  "done",
  "cancelled",
]);
const VALID_CATEGORY = new Set([
  "info",
  "aufgabe",
  "dringend",
  "kritisch",
  "inbox",
  "rechnung",
  "bestellung",
]);
const VALID_PRIORITY = new Set(["urgent", "high", "medium", "low"]);

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object") {
    const obj = e as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.error === "string") return obj.error;
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }
  return String(e);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      status?: string;
      due_date?: string | null;
      mail_category?: string;
      priority?: string;
      assigned_to?: string | null;
      remind_at?: string | null;
      title?: string;
      description?: string;
      /** true/false: in Mein Tag stellen oder rausnehmen. Server setzt Timestamp. */
      in_my_day?: boolean;
      /** Manuelle Drag-and-Drop Sortierung. */
      sort_order?: number;
    };

    const update: Record<string, unknown> = {};

    if (body.status !== undefined) {
      if (!VALID_STATUS.has(body.status)) {
        return NextResponse.json(
          { error: `Invalid status: ${body.status}` },
          { status: 400 },
        );
      }
      update.status = body.status;
      update.completed_at = body.status === "done" ? new Date().toISOString() : null;
    }

    if (body.due_date !== undefined) update.due_date = body.due_date;

    if (body.mail_category !== undefined) {
      if (!VALID_CATEGORY.has(body.mail_category)) {
        return NextResponse.json(
          { error: `Invalid mail_category: ${body.mail_category}` },
          { status: 400 },
        );
      }
      update.mail_category = body.mail_category;
    }

    if (body.priority !== undefined) {
      if (!VALID_PRIORITY.has(body.priority)) {
        return NextResponse.json(
          { error: `Invalid priority: ${body.priority}` },
          { status: 400 },
        );
      }
      update.priority = body.priority;
    }

    if (body.assigned_to !== undefined) {
      const v = body.assigned_to;
      if (v !== null && (typeof v !== "string" || v.length > 200)) {
        return NextResponse.json(
          { error: "Invalid assigned_to (must be string ≤200 chars or null)" },
          { status: 400 },
        );
      }
      update.assigned_to = v && v.trim().length > 0 ? v.trim() : null;
    }

    if (body.remind_at !== undefined) {
      if (body.remind_at !== null) {
        const d = new Date(body.remind_at);
        if (Number.isNaN(d.getTime())) {
          return NextResponse.json(
            { error: "Invalid remind_at (must be ISO date or null)" },
            { status: 400 },
          );
        }
        update.remind_at = d.toISOString();
      } else {
        update.remind_at = null;
      }
    }

    if (body.title !== undefined && typeof body.title === "string") {
      update.title = body.title.trim().slice(0, 200);
    }

    if (body.description !== undefined && typeof body.description === "string") {
      update.description = body.description.slice(0, 4000);
    }

    if (body.in_my_day !== undefined) {
      update.in_my_day_at = body.in_my_day ? new Date().toISOString() : null;
    }

    if (body.sort_order !== undefined && typeof body.sort_order === "number") {
      // Clamp gegen NaN / extreme Werte
      const n = Math.round(body.sort_order);
      update.sort_order =
        Number.isFinite(n) ? Math.min(1_000_000, Math.max(-1_000_000, n)) : 0;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const { error } = await supabase.from("tasks").update(update).eq("id", id);
    if (error) return NextResponse.json({ error: errMsg(error) }, { status: 500 });

    return NextResponse.json({ ok: true, id, update });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
