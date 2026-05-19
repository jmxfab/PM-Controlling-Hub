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

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  mail_category: string | null;
  priority: string | null;
  due_date: string | null;
  created_at: string;
  is_important: boolean;
  remind_at: string | null;
};

const PRIO_WEIGHT: Record<string, number> = {
  urgent: 50,
  high: 35,
  medium: 15,
  low: 5,
};

const CATEGORY_WEIGHT: Record<string, number> = {
  kritisch: 30, // ist eigentlich woanders, aber wenn nicht-snoozed schon relevant
  dringend: 25,
  aufgabe: 15,
  rechnung: 12,
  bestellung: 10,
  inbox: 5,
  info: -10, // explizit abwerten — Info ist meist FYI
};

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

/** Liefert einen Score + menschenlesbaren Grund warum die Task als
 *  Vorschlag taugt. Kombiniert mehrere Signale statt nur stumpfer Sort. */
function scoreTask(t: TaskRow, now: Date): { score: number; reason: string } {
  let score = 0;
  let reason = "";

  // 1) Faelligkeit — staerkster Boost. Heute > morgen > diese Woche.
  if (t.due_date) {
    const due = new Date(t.due_date);
    if (!Number.isNaN(due.getTime())) {
      const days = daysBetween(due, now);
      if (days < 0) {
        score += 80;
        reason = `Überfällig (${Math.abs(days)} Tag${Math.abs(days) === 1 ? "" : "e"})`;
      } else if (days === 0) {
        score += 70;
        reason = "Fällig heute";
      } else if (days === 1) {
        score += 55;
        reason = "Fällig morgen";
      } else if (days <= 3) {
        score += 35;
        reason = `Fällig in ${days} Tagen`;
      } else if (days <= 7) {
        score += 15;
        reason = "Diese Woche fällig";
      }
    }
  }

  // 2) Wichtig-Star — manueller Boost vom User.
  if (t.is_important) {
    score += 40;
    if (!reason) reason = "Wichtig markiert";
  }

  // 3) Priorität.
  if (t.priority && PRIO_WEIGHT[t.priority] !== undefined) {
    score += PRIO_WEIGHT[t.priority];
    if (!reason && (t.priority === "urgent" || t.priority === "high")) {
      reason = t.priority === "urgent" ? "Dringend" : "Hohe Priorität";
    }
  }

  // 4) Kategorie.
  if (t.mail_category && CATEGORY_WEIGHT[t.mail_category] !== undefined) {
    score += CATEGORY_WEIGHT[t.mail_category];
    if (!reason && t.mail_category === "kritisch") reason = "Kritische Mail";
  }

  // 5) Frische — bis 3 Tage alt Bonus, ab 14 Tage Malus.
  const ageDays = daysBetween(now, new Date(t.created_at));
  if (ageDays <= 1) score += 10;
  else if (ageDays <= 3) score += 5;
  else if (ageDays > 14) score -= 10;
  else if (ageDays > 21) score -= 25;

  if (!reason) {
    // Wenn keine spezielle Begruendung greift, je nach Score-Niveau labeln.
    if (score >= 15) reason = "Neu eingegangen";
    else if (score >= 5) reason = "Offen";
    else reason = "Backlog";
  }

  return { score, reason };
}

/**
 * GET /api/mail-tasks/my-day-suggestions
 *
 * MS-To-Do-Style "Vorschläge" Panel fuer den Mein-Tag-Tab.
 * Smartes Scoring statt stupide Sortierung:
 *   - Faelligkeit (heute/morgen/ueberfaellig = grosser Boost)
 *   - Wichtig-Star + Prio + Kategorie als Signale
 *   - Snoozes ausgeschlossen
 *   - Info-Kategorie abgewertet (kein FYI in Mein Tag)
 * Liefert max 8 Suggestions inkl. menschenlesbarem Grund.
 */
export async function GET() {
  try {
    const supabase = supabaseAdmin();
    const now = new Date();
    const nowIso = now.toISOString();

    // ALLE offenen Tasks die nicht in Mein Tag sind. Keine Altersgrenze
    // (User-Wunsch: 'die ganze liste rein'). Snoozes (remind_at > jetzt)
    // bleiben ausgeschlossen, sonst landet alles drin was eh versteckt sein soll.
    const { data, error } = await supabase
      .from("tasks")
      .select(
        "id, title, description, mail_category, priority, due_date, created_at, is_important, remind_at",
      )
      .or("is_automated.eq.true,is_user_created.eq.true")
      .neq("status", "done")
      .neq("status", "cancelled")
      .is("in_my_day_at", null)
      .or(`remind_at.is.null,remind_at.lte.${nowIso}`)
      .limit(500);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as TaskRow[];
    // KEIN score>0 Filter mehr — wir wollen die ganze Liste. Sortieren
    // bleibt nach Relevanz (Wichtig/Faellig/Prio oben), Cap auf 30.
    const scored = rows
      .map((t) => ({
        task: t,
        ...scoreTask(t, now),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);

    return NextResponse.json({
      suggestions: scored.map((x) => ({
        id: x.task.id,
        title: x.task.title,
        description: x.task.description,
        mail_category: x.task.mail_category,
        priority: x.task.priority,
        due_date: x.task.due_date,
        created_at: x.task.created_at,
        is_important: x.task.is_important,
        reason: x.reason,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
