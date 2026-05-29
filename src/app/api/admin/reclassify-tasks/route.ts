import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { classifyEmail } from "@/lib/anthropic/email-classifier";

export const runtime = "nodejs";
export const maxDuration = 60;

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

/**
 * POST /api/admin/reclassify-tasks
 *
 * Re-classifiziert bestehende Tasks durch den aktuellen Email-Classifier.
 * Sinnvoll nach Prompt-Aenderungen — bestehende 'aufgabe'/'dringend' Tasks
 * koennen nach Verschaerfung auf gf_aufgabe / pl_aufgabe umgemappt werden.
 *
 * Query:
 *   ?categories=aufgabe,dringend  (Default: alle Operativ-Kategorien)
 *   ?limit=20                      (max 50 pro Aufruf wegen Timeout/Token)
 *   ?dry=1                         (nur preview, kein UPDATE)
 *
 * Auth: keine — Admin-Route, geschuetzt durch Middleware/Login.
 *
 * Response:
 *   {
 *     processed: N,
 *     updated: N,
 *     changes: [{ id, title, from, to, reasoning }],
 *     remaining: N
 *   }
 */
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const categoriesParam = (searchParams.get("categories") ?? "aufgabe,dringend").trim();
  const categories = categoriesParam.split(",").map((s) => s.trim()).filter(Boolean);
  const limit = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20),
  );
  const dryRun = searchParams.get("dry") === "1";

  if (categories.length === 0) {
    return NextResponse.json({ error: "categories required" }, { status: 400 });
  }

  try {
    const supabase = supabaseAdmin();

    // 1) Tasks-Batch laden — nur offene, mit Title + Description (Body)
    const { data: tasks, error: loadErr } = await supabase
      .from("tasks")
      .select("id, title, description, mail_category")
      .in("mail_category", categories)
      .neq("status", "done")
      .or("is_automated.eq.true,is_user_created.eq.true")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (loadErr) {
      return NextResponse.json({ error: loadErr.message }, { status: 500 });
    }

    if (!tasks || tasks.length === 0) {
      return NextResponse.json({
        processed: 0,
        updated: 0,
        changes: [],
        remaining: 0,
      });
    }

    // 2) Pro Task: Classifier laufen lassen
    const changes: Array<{
      id: string;
      title: string;
      from: string;
      to: string;
      reasoning: string;
      changed: boolean;
    }> = [];

    for (const task of tasks) {
      // Description ist oft im Format "Von: name <email>\n<body>" — wir
      // wollen Body fuer den Classifier. Parsen wie loadMailTasks tut:
      const desc = task.description ?? "";
      const senderMatch = desc.match(/^Von:\s*([^\n]+)\n+([\s\S]*)$/);
      const senderFull = senderMatch?.[1]?.trim() ?? "";
      const body = senderMatch?.[2]?.trim() ?? desc;

      // Sender splitten in name + email
      const emailMatch = senderFull.match(/<([^>]+)>/);
      const senderEmail = emailMatch?.[1]?.trim() ?? senderFull;
      const senderName = senderFull.replace(/<[^>]+>/, "").trim();

      try {
        const result = await classifyEmail({
          senderName,
          senderEmail,
          subject: task.title ?? "",
          body,
        });
        const newCategory = result.category;
        const changed = newCategory !== task.mail_category;
        changes.push({
          id: task.id,
          title: (task.title ?? "").slice(0, 80),
          from: task.mail_category ?? "?",
          to: newCategory,
          reasoning: result.reasoning,
          changed,
        });

        if (changed && !dryRun) {
          await supabase
            .from("tasks")
            .update({ mail_category: newCategory })
            .eq("id", task.id);
        }
      } catch (e) {
        changes.push({
          id: task.id,
          title: (task.title ?? "").slice(0, 80),
          from: task.mail_category ?? "?",
          to: "ERROR",
          reasoning: e instanceof Error ? e.message : String(e),
          changed: false,
        });
      }
    }

    // 3) Count remaining
    const { count: remaining } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .in("mail_category", categories)
      .neq("status", "done")
      .or("is_automated.eq.true,is_user_created.eq.true");

    return NextResponse.json({
      processed: tasks.length,
      updated: changes.filter((c) => c.changed).length,
      changes,
      remaining: Math.max(0, (remaining ?? 0) - changes.filter((c) => c.changed).length),
      dryRun,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
