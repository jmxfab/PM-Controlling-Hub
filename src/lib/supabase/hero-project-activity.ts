import "server-only";

import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

export interface ProjectActivityEntry {
  id: string;
  /** ISO Zeitpunkt — wann der Eintrag im Logbuch entstanden ist. */
  date: string;
  /** Beschreibender Text — primary custom_text, fallback description.
   *  HTML-Tags gestripped, max 300 Zeichen. */
  text: string;
  /** Autor des Eintrags falls bekannt. */
  author: string | null;
  /** event_type aus hero_histories. */
  eventType: string | null;
}

export interface ProjectActivity {
  projectId: string;
  projectNumber: string | null;
  projectName: string | null;
  customerName: string | null;
  currentStep: string | null;
  isFinished: boolean;
  /** Wann war der letzte Event uberhaupt — fuer "lebt das Projekt?". */
  lastEventAt: string | null;
  /** Anzahl Events in den letzten 30 Tagen — Aktivitaets-Score. */
  events30d: number;
  /** Letzte N Eintraege, neueste zuerst. */
  entries: ProjectActivityEntry[];
}

/**
 * Last-N Activity je Projekt: kombiniert hero_histories (Notizen, manuelle
 * Eintraege) + hero_status_transitions (Step-Wechsel). Wird auf TaskCards
 * + Projekt-Pulse-Seite verwendet.
 */
export async function loadProjectActivity(
  projectId: string,
  limit = 5,
): Promise<ProjectActivity | null> {
  const supabase = supabaseAdmin();

  // Projekt-Header
  const { data: proj } = await supabase
    .from("hero_dashboard_projects")
    .select("id, project_number, project_name, customer_name, step_name, is_finished")
    .eq("id", projectId)
    .maybeSingle();

  if (!proj) return null;

  // Histories
  const { data: hist } = await supabase
    .from("hero_histories")
    .select(
      "id, entry_date, custom_text, custom_title, description, author_name, event_type",
    )
    .eq("project_match_id", projectId)
    .eq("is_deleted", false)
    .order("entry_date", { ascending: false, nullsFirst: false })
    .limit(limit * 3);

  // Status-Transitions
  const { data: trans } = await supabase
    .from("hero_status_transitions")
    .select("id, entered_at, step_name")
    .eq("project_match_id", projectId)
    .order("entered_at", { ascending: false, nullsFirst: false })
    .limit(limit * 2);

  type RawEntry = {
    id: string;
    date: string | null;
    text: string;
    author: string | null;
    eventType: string | null;
  };

  const histRaw: RawEntry[] = (hist ?? []).map((h) => {
    const raw = [h.custom_title, h.custom_text, h.description]
      .filter((s): s is string => Boolean(s))
      .join(" — ");
    const clean = raw
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return {
      id: `h_${h.id}`,
      date: h.entry_date,
      text: clean.length > 300 ? clean.slice(0, 297) + "…" : clean,
      author: h.author_name ?? null,
      eventType: h.event_type ?? null,
    };
  });

  const transRaw: RawEntry[] = (trans ?? []).map((t) => ({
    id: `t_${t.id}`,
    date: t.entered_at,
    text: t.step_name ? `Step gewechselt zu: ${t.step_name}` : "Status-Wechsel",
    author: null,
    eventType: "transition",
  }));

  const combined: RawEntry[] = [...histRaw, ...transRaw]
    .filter((e) => e.date && e.text.length > 0)
    .sort((a, b) => {
      const aT = new Date(a.date!).getTime();
      const bT = new Date(b.date!).getTime();
      return bT - aT;
    });

  // Deduplicate: ein Step-Wechsel wird oft als History UND als Transition
  // gespeichert. Wenn zwei Eintraege innerhalb von 60s denselben Text haben
  // -> nur den ersten behalten.
  const dedup: RawEntry[] = [];
  for (const e of combined) {
    const dup = dedup.find(
      (d) =>
        d.text === e.text &&
        Math.abs(
          new Date(d.date!).getTime() - new Date(e.date!).getTime(),
        ) < 60_000,
    );
    if (!dup) dedup.push(e);
  }

  const sliced = dedup.slice(0, limit);

  // events30d: alle dedup-Eintraege in letzten 30 Tagen zaehlen
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const events30d = dedup.filter((e) => {
    const t = new Date(e.date!).getTime();
    return Number.isFinite(t) && t >= thirtyDaysAgo;
  }).length;

  const lastEventAt = dedup[0]?.date ?? null;

  return {
    projectId: proj.id,
    projectNumber: proj.project_number ?? null,
    projectName: proj.project_name ?? null,
    customerName: proj.customer_name ?? null,
    currentStep: proj.step_name ?? null,
    isFinished: proj.is_finished ?? false,
    lastEventAt,
    events30d,
    entries: sliced.map((e) => ({
      id: e.id,
      date: e.date!,
      text: e.text,
      author: e.author,
      eventType: e.eventType,
    })),
  };
}

/**
 * Top-N aktivste Projekte fuer Projekt-Pulse-Karte-Liste.
 * Sortiert nach last event date (desc), nur Projekte mit events in den
 * letzten 60 Tagen werden ausgegeben.
 */
export interface ProjectPulseCard {
  projectId: string;
  projectNumber: string | null;
  projectName: string | null;
  customerName: string | null;
  currentStep: string | null;
  isFinished: boolean;
  lastEventAt: string | null;
  events30d: number;
  /** Letzte 5 Eintraege fuer das Mini-Pulse-Display. */
  entries: ProjectActivityEntry[];
}

export async function loadProjectPulse(limit = 12): Promise<ProjectPulseCard[]> {
  const supabase = supabaseAdmin();
  const sixtyDaysAgo = new Date(
    Date.now() - 60 * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Schritt 1: Welche Projekte hatten in den letzten 60 Tagen einen Event?
  const { data: recent } = await supabase
    .from("hero_histories")
    .select("project_match_id, entry_date")
    .gte("entry_date", sixtyDaysAgo)
    .eq("is_deleted", false)
    .not("project_match_id", "is", null)
    .order("entry_date", { ascending: false, nullsFirst: false })
    .limit(3000);

  if (!Array.isArray(recent) || recent.length === 0) return [];

  // Schritt 2: Per project_match_id die juengste entry_date sammeln,
  // top-N nach last-event sortiert.
  const lastByProject: Map<string, string> = new Map();
  for (const r of recent as Array<{
    project_match_id: string | null;
    entry_date: string | null;
  }>) {
    if (!r.project_match_id || !r.entry_date) continue;
    if (!lastByProject.has(r.project_match_id)) {
      lastByProject.set(r.project_match_id, r.entry_date);
    }
  }
  const topIds = Array.from(lastByProject.entries())
    .sort((a, b) => new Date(b[1]).getTime() - new Date(a[1]).getTime())
    .slice(0, limit)
    .map(([pid]) => pid);

  if (topIds.length === 0) return [];

  // Schritt 3: BATCH-Load. Statt N x 3 Queries (vorher loadProjectActivity je
  // Projekt = 3 Queries) machen wir jetzt 3 Queries total.
  const [projectsRes, histRes, transRes] = await Promise.all([
    supabase
      .from("hero_dashboard_projects")
      .select(
        "id, project_number, project_name, customer_name, step_name, is_finished",
      )
      .in("id", topIds)
      .limit(topIds.length),
    supabase
      .from("hero_histories")
      .select(
        "id, project_match_id, entry_date, custom_text, custom_title, description, author_name, event_type",
      )
      .in("project_match_id", topIds)
      .eq("is_deleted", false)
      .order("entry_date", { ascending: false, nullsFirst: false })
      .limit(topIds.length * 15),
    supabase
      .from("hero_status_transitions")
      .select("id, project_match_id, entered_at, step_name")
      .in("project_match_id", topIds)
      .order("entered_at", { ascending: false, nullsFirst: false })
      .limit(topIds.length * 10),
  ]);

  // Indizieren nach project_match_id
  const histByProject = new Map<
    string,
    Array<{
      id: string;
      entry_date: string | null;
      custom_text: string | null;
      custom_title: string | null;
      description: string | null;
      author_name: string | null;
      event_type: string | null;
    }>
  >();
  for (const h of (histRes.data ?? []) as Array<{
    id: string;
    project_match_id: string | null;
    entry_date: string | null;
    custom_text: string | null;
    custom_title: string | null;
    description: string | null;
    author_name: string | null;
    event_type: string | null;
  }>) {
    if (!h.project_match_id) continue;
    const arr = histByProject.get(h.project_match_id) ?? [];
    arr.push(h);
    histByProject.set(h.project_match_id, arr);
  }
  const transByProject = new Map<
    string,
    Array<{ id: string; entered_at: string | null; step_name: string | null }>
  >();
  for (const t of (transRes.data ?? []) as Array<{
    id: string;
    project_match_id: string | null;
    entered_at: string | null;
    step_name: string | null;
  }>) {
    if (!t.project_match_id) continue;
    const arr = transByProject.get(t.project_match_id) ?? [];
    arr.push(t);
    transByProject.set(t.project_match_id, arr);
  }

  // Schritt 4: Pro Projekt die Pulse-Karte bauen
  const result: ProjectPulseCard[] = [];
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  for (const proj of (projectsRes.data ?? []) as Array<{
    id: string;
    project_number: string | null;
    project_name: string | null;
    customer_name: string | null;
    step_name: string | null;
    is_finished: boolean | null;
  }>) {
    const hist = histByProject.get(proj.id) ?? [];
    const trans = transByProject.get(proj.id) ?? [];
    const combined = [
      ...hist.map((h) => {
        const raw = [h.custom_title, h.custom_text, h.description]
          .filter((s): s is string => Boolean(s))
          .join(" — ");
        const clean = raw
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        return {
          id: `h_${h.id}`,
          date: h.entry_date,
          text: clean.length > 300 ? clean.slice(0, 297) + "…" : clean,
          author: h.author_name ?? null,
          eventType: h.event_type ?? null,
        };
      }),
      ...trans.map((t) => ({
        id: `t_${t.id}`,
        date: t.entered_at,
        text: t.step_name
          ? `Step gewechselt zu: ${t.step_name}`
          : "Status-Wechsel",
        author: null as string | null,
        eventType: "transition" as string | null,
      })),
    ]
      .filter((e) => e.date && e.text.length > 0)
      .sort(
        (a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime(),
      );

    // Dedup: 60s Toleranz, gleicher Text
    const dedup: typeof combined = [];
    for (const e of combined) {
      const eMs = new Date(e.date!).getTime();
      if (
        dedup.some(
          (d) =>
            d.text === e.text &&
            Math.abs(new Date(d.date!).getTime() - eMs) < 60_000,
        )
      ) {
        continue;
      }
      dedup.push(e);
    }

    const events30d = dedup.filter((e) => {
      const t = new Date(e.date!).getTime();
      return Number.isFinite(t) && t >= thirtyDaysAgo;
    }).length;

    result.push({
      projectId: proj.id,
      projectNumber: proj.project_number ?? null,
      projectName: proj.project_name ?? null,
      customerName: proj.customer_name ?? null,
      currentStep: proj.step_name ?? null,
      isFinished: proj.is_finished ?? false,
      lastEventAt: dedup[0]?.date ?? null,
      events30d,
      entries: dedup.slice(0, 5).map((e) => ({
        id: e.id,
        date: e.date!,
        text: e.text,
        author: e.author,
        eventType: e.eventType,
      })),
    });
  }

  // Reihenfolge laut topIds wiederherstellen (nach Last-Event-Date desc)
  const orderMap = new Map(topIds.map((id, i) => [id, i]));
  result.sort(
    (a, b) =>
      (orderMap.get(a.projectId) ?? 0) - (orderMap.get(b.projectId) ?? 0),
  );

  return result;
}
