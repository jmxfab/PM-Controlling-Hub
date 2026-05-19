import "server-only";

import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

export interface WeeklyDigest {
  /** ISO-Start der Berichtswoche (Fr 00:00 Berlin). */
  fromIso: string;
  /** ISO-Ende der Berichtswoche (Do 23:59 Berlin / Fr 00:00 exklusiv). */
  toIso: string;
  /** Human-Label "16.05.2026 → 22.05.2026". */
  rangeLabel: string;
  topPeople: Array<{
    email: string;
    name: string | null;
    events: number;
  }>;
  topEventTypes: Array<{
    eventType: string;
    count: number;
  }>;
  newProjects: Array<{
    id: string;
    number: string | null;
    name: string | null;
    customer: string | null;
    createdAt: string;
  }>;
  completedProjects: Array<{
    id: string;
    number: string | null;
    name: string | null;
    customer: string | null;
    finishedAt: string;
  }>;
  /** Mitarbeiter die signifikant unter ihrem 4-Wochen-Schnitt liegen
   *  (Krankheits-/Urlaubs-Indikator). Nur Personen mit normalerweise >= 5
   *  Events/Woche werden ueberhaupt geprueft. */
  anomalies: Array<{
    email: string;
    name: string | null;
    thisWeek: number;
    avg4Weeks: number;
    deltaPct: number;
  }>;
  /** Mail-Aufgaben-Pipeline-Stats fuer die Woche. */
  tasks: {
    newCount: number;
    doneCount: number;
    openTotal: number;
    kritischOpen: number;
  };
  /** Liquidity-Snapshot zum Berichtszeitpunkt. */
  cash: {
    totalOpenEur: number;
    overdueEur: number;
    overdueCount: number;
  };
}

/** Letzte abgeschlossene Jumax-Woche: Fr 00:00 -> Fr 00:00 (exklusiv).
 *  Wenn heute Fr->Do: letzte komplette Fr-Do Woche.
 *  Wenn heute Fr 0:00: gestern war Do, also Fr-vor-7d bis heute. */
export function getLastJumaxWeek(now: Date = new Date()): {
  fromIso: string;
  toIso: string;
  rangeLabel: string;
} {
  // Berlin-Zeit normalisieren: wir nutzen lokale Server-Zeit als Approximation.
  // Vercel laeuft UTC, daher: berechne in UTC und +1/+2 Stunden-Offset spaeter.
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // 5 = Freitag. Tage seit letztem Fr.
  const dow = today.getDay(); // So=0, Mo=1, ..., Fr=5, Sa=6
  const daysSinceLastFriday = (dow - 5 + 7) % 7;
  // Aktueller Fr (Beginn der laufenden Jumax-Woche)
  const currentFriday = new Date(today);
  currentFriday.setDate(today.getDate() - daysSinceLastFriday);
  // Vorheriger Fr = Start der letzten ABGESCHLOSSENEN Jumax-Woche
  const from = new Date(currentFriday);
  from.setDate(currentFriday.getDate() - 7);
  // Bis exklusiv = current Friday (= Ende der letzten Woche + 1 Min)
  const to = currentFriday;

  const fmt = (d: Date) =>
    d.toLocaleDateString("de-AT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  // Ende-Label: Donnerstag der letzten Woche
  const thursday = new Date(to);
  thursday.setDate(to.getDate() - 1);

  return {
    fromIso: from.toISOString(),
    toIso: to.toISOString(),
    rangeLabel: `${fmt(from)} → ${fmt(thursday)}`,
  };
}

export async function loadWeeklyDigest(): Promise<WeeklyDigest> {
  const supabase = supabaseAdmin();
  const { fromIso, toIso, rangeLabel } = getLastJumaxWeek();

  // 1) Hero-Histories der Woche fuer People+Events
  const { data: histData } = await supabase
    .from("hero_histories")
    .select("user_email, author_name, event_type, project_match_id, entry_date")
    .gte("entry_date", fromIso)
    .lt("entry_date", toIso)
    .eq("is_deleted", false)
    .limit(20_000);
  const hist = histData ?? [];

  // Top-Mitarbeiter
  const peopleMap = new Map<
    string,
    { email: string; name: string | null; events: number }
  >();
  for (const h of hist) {
    const email = (h.user_email as string | null) ?? null;
    if (!email) continue;
    const existing = peopleMap.get(email);
    if (existing) {
      existing.events += 1;
    } else {
      peopleMap.set(email, {
        email,
        name: (h.author_name as string | null) ?? null,
        events: 1,
      });
    }
  }
  const topPeople = Array.from(peopleMap.values())
    .sort((a, b) => b.events - a.events)
    .slice(0, 5);

  // Top-Event-Types
  const typeMap = new Map<string, number>();
  for (const h of hist) {
    const t = (h.event_type as string | null) ?? null;
    if (!t) continue;
    typeMap.set(t, (typeMap.get(t) ?? 0) + 1);
  }
  const topEventTypes = Array.from(typeMap.entries())
    .map(([eventType, count]) => ({ eventType, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // 2) Anomalien: 4-Wochen-Schnitt vs diese Woche
  // Vergleichszeitraum: 4 Wochen VOR der Berichtswoche.
  const fourWeeksAgo = new Date(
    new Date(fromIso).getTime() - 28 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data: prevData } = await supabase
    .from("hero_histories")
    .select("user_email")
    .gte("entry_date", fourWeeksAgo)
    .lt("entry_date", fromIso)
    .eq("is_deleted", false)
    .limit(50_000);
  const prevPerEmail = new Map<string, number>();
  for (const r of prevData ?? []) {
    const email = (r.user_email as string | null) ?? null;
    if (!email) continue;
    prevPerEmail.set(email, (prevPerEmail.get(email) ?? 0) + 1);
  }
  const anomalies = [] as WeeklyDigest["anomalies"];
  for (const p of peopleMap.values()) {
    const prevTotal = prevPerEmail.get(p.email) ?? 0;
    const avg4Weeks = prevTotal / 4;
    if (avg4Weeks < 5) continue; // zu wenig Baseline-Daten
    if (p.events >= avg4Weeks * 0.5) continue; // nicht signifikant unter
    anomalies.push({
      email: p.email,
      name: p.name,
      thisWeek: p.events,
      avg4Weeks: Math.round(avg4Weeks * 10) / 10,
      deltaPct: Math.round(((p.events - avg4Weeks) / avg4Weeks) * 100),
    });
  }
  // Auch People mit avg>=5 aber ohne Events diese Woche -> anomaly
  for (const [email, prevTotal] of prevPerEmail.entries()) {
    const avg = prevTotal / 4;
    if (avg < 5) continue;
    if (peopleMap.has(email)) continue; // schon abgedeckt
    anomalies.push({
      email,
      name: null,
      thisWeek: 0,
      avg4Weeks: Math.round(avg * 10) / 10,
      deltaPct: -100,
    });
  }
  anomalies.sort((a, b) => a.deltaPct - b.deltaPct);

  // 3) Neue Projekte (created_at_hero in Woche)
  const { data: newProj } = await supabase
    .from("hero_dashboard_projects")
    .select("id, project_number, project_name, customer_name, created_at_hero")
    .gte("created_at_hero", fromIso)
    .lt("created_at_hero", toIso)
    .order("created_at_hero", { ascending: false })
    .limit(50);
  const newProjects = (newProj ?? []).map(
    (p: {
      id: string;
      project_number: string | null;
      project_name: string | null;
      customer_name: string | null;
      created_at_hero: string;
    }) => ({
      id: p.id,
      number: p.project_number,
      name: p.project_name,
      customer: p.customer_name,
      createdAt: p.created_at_hero,
    }),
  );

  // 4) Abgeschlossene Projekte (last_finish_at in Woche)
  const { data: doneProj } = await supabase
    .from("hero_dashboard_projects")
    .select("id, project_number, project_name, customer_name, last_finish_at")
    .gte("last_finish_at", fromIso)
    .lt("last_finish_at", toIso)
    .order("last_finish_at", { ascending: false })
    .limit(50);
  const completedProjects = (doneProj ?? []).map(
    (p: {
      id: string;
      project_number: string | null;
      project_name: string | null;
      customer_name: string | null;
      last_finish_at: string;
    }) => ({
      id: p.id,
      number: p.project_number,
      name: p.project_name,
      customer: p.customer_name,
      finishedAt: p.last_finish_at,
    }),
  );

  // 5) Mail-Aufgaben-Pipeline
  const [newTasksRes, doneTasksRes, openTasksRes, kritischRes] =
    await Promise.all([
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .or("is_automated.eq.true,is_user_created.eq.true")
        .gte("created_at", fromIso)
        .lt("created_at", toIso),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .or("is_automated.eq.true,is_user_created.eq.true")
        .eq("status", "done")
        .gte("completed_at", fromIso)
        .lt("completed_at", toIso),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .or("is_automated.eq.true,is_user_created.eq.true")
        .neq("status", "done"),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .or("is_automated.eq.true,is_user_created.eq.true")
        .eq("mail_category", "kritisch")
        .neq("status", "done"),
    ]);

  // 6) Cash-Snapshot
  const { data: openInv } = await supabase
    .from("hero_customer_documents")
    .select("value, booking_balance, booking_due_date")
    .eq("type", "invoice")
    .eq("is_deleted", false)
    .eq("status_code", 200)
    .eq("booking_is_open", true)
    .limit(10_000);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  let totalOpenEur = 0;
  let overdueEur = 0;
  let overdueCount = 0;
  for (const inv of openInv ?? []) {
    const amt = Number(inv.booking_balance ?? inv.value) || 0;
    if (amt <= 0) continue;
    totalOpenEur += amt;
    if (inv.booking_due_date) {
      const due = new Date(inv.booking_due_date);
      if (!Number.isNaN(due.getTime()) && due < todayStart) {
        overdueEur += amt;
        overdueCount += 1;
      }
    }
  }

  return {
    fromIso,
    toIso,
    rangeLabel,
    topPeople,
    topEventTypes,
    newProjects,
    completedProjects,
    anomalies,
    tasks: {
      newCount: newTasksRes.count ?? 0,
      doneCount: doneTasksRes.count ?? 0,
      openTotal: openTasksRes.count ?? 0,
      kritischOpen: kritischRes.count ?? 0,
    },
    cash: {
      totalOpenEur,
      overdueEur,
      overdueCount,
    },
  };
}
