import "server-only";

import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

export interface PvKpiProject {
  id: string;
  projectNumber: string | null;
  projectName: string | null;
  customerName: string | null;
  stepName: string | null;
  maturityDate: string | null;
}

export interface PvKpiCalendarEvent {
  id: string;
  title: string | null;
  category: string | null;
  start: string | null;
  end: string | null;
  isDone: boolean | null;
  projectId: string | null;
  projectNumber: string | null;
  projectName: string | null;
  /** Manuelle Erinnerung (Dashboard-Eingabe, ueberlebt Hero-Sync). */
  reminderAt: string | null;
  reminderNote: string | null;
}

export interface PvControllingKpis {
  /** Gesamte Anzahl Projekte (Montageplanung..Abschlussgespräch planen). */
  pipelineActive: { count: number; projects: PvKpiProject[] };
  /** Rechnungen versendet (status_code=200) im Zeitraum, exkl. reversal_invoice. */
  invoicesSent: {
    count: number;
    items: Array<{
      id: string;
      projectNumber: string | null;
      projectName: string | null;
      customerName: string | null;
      docNumber: string | null;
      type: string | null;
      created: string | null;
    }>;
  };
  /** Termine mit Kategorie Gesamtmontage/AC Montage/DC Montage im Zeitraum. */
  installations: { count: number; events: PvKpiCalendarEvent[] };
  /** Termine deren Titel WB/Wallbox/Speicher enthält im Zeitraum. */
  storageWallbox: { count: number; events: PvKpiCalendarEvent[] };
  /** Projekte die im Zeitraum aus einem Nacharbeit-Step rausgewandert sind. */
  reworkResolved: { count: number; projects: PvKpiProject[] };
  /** Termine mit Titel "Zählerwechsel"/"Zählermontage" im Zeitraum. */
  meterChange: { count: number; events: PvKpiCalendarEvent[] };
  /** Aktuell offene Nacharbeiten — Step + rework_scheduled_date gesetzt. */
  reworkScheduled: { count: number; projects: PvKpiProject[] };
  /** Aktuell offene Nacharbeiten — Step ohne rework_scheduled_date. */
  reworkUnscheduled: { count: number; projects: PvKpiProject[] };
  /** Projekte aktuell im Step "➡️ Abschlussgespräch planen". */
  closingsToPlan: { count: number; projects: PvKpiProject[] };
  /** Projekte im Step "🤝🏼 Abschlussgespräch" mit gesetztem maturity_date. */
  closingsScheduled: { count: number; projects: PvKpiProject[] };

  /** Termin-Aktivität gefiltert auf Kategorie Gesamtmontage / Kleinauftrag. */
  appointmentActivity: {
    /** Termine mit is_done=true im Zeitraum. */
    completed: { count: number; events: PvKpiCalendarEvent[] };
    /** Termine deren Start im Zeitraum liegt (egal ob abgeschlossen). */
    worked: { count: number; events: PvKpiCalendarEvent[] };
    /** Termine die im Zeitraum frisch angelegt wurden (created in window). */
    added: { count: number; events: PvKpiCalendarEvent[] };
  };
}

export interface PvKpiTimeWindow {
  /** ISO-Start (Fr 00:00 Europe/Berlin) der vergangenen Jumax-Woche. */
  fromIso: string;
  /** ISO-Ende (Fr 00:00 Europe/Berlin) — also Do 23:59 + 1 min, exklusiv. */
  toIso: string;
  label: string;
}

const PIPELINE_ACTIVE_PATTERNS = [
  "montageplanung",
  "terminierte montage",
  "zählermontage",
  "nacharbeit", // AC/DC/terminiert/nicht terminiert
  "abschlussrechnung",
  "abschlussgespräch planen",
];

const REWORK_PATTERNS = ["nacharbeit", "reklamation"];

export async function loadPvControllingKpis(
  window: PvKpiTimeWindow
): Promise<PvControllingKpis> {
  const supabase = supabaseAdmin();
  const fromIso = window.fromIso;
  const toIso = window.toIso;

  // ─── Snapshot-KPIs aus hero_dashboard_projects ─────────────────────────
  const { data: dashRows } = await supabase
    .from("hero_dashboard_projects")
    .select(
      "id, project_number, project_name, customer_name, step_name, maturity_date, rework_scheduled_date, is_finished, department_key"
    )
    .eq("department_key", "PV")
    .limit(5000);

  const allPv = (dashRows ?? []) as Array<{
    id: string;
    project_number: string | null;
    project_name: string | null;
    customer_name: string | null;
    step_name: string | null;
    maturity_date: string | null;
    rework_scheduled_date: string | null;
    is_finished: boolean | null;
    department_key: string | null;
  }>;

  const lc = (v: string | null | undefined) => (v ?? "").toLowerCase();
  const matchAny = (s: string, patterns: string[]) =>
    patterns.some((p) => s.includes(p));

  const toProject = (r: (typeof allPv)[number]): PvKpiProject => ({
    id: r.id,
    projectNumber: r.project_number,
    projectName: r.project_name,
    customerName: r.customer_name,
    stepName: r.step_name,
    maturityDate: r.maturity_date,
  });

  // Gesamte Anzahl Projekte (Montageplanung..Abschlussgespräch planen) — open
  const pipelineActiveProjects = allPv
    .filter((r) => !r.is_finished && r.step_name)
    .filter((r) => matchAny(lc(r.step_name), PIPELINE_ACTIVE_PATTERNS))
    .map(toProject);

  // Nacharbeiten — terminiert (current = rework, has scheduled date)
  const reworkActive = allPv
    .filter((r) => !r.is_finished && r.step_name)
    .filter((r) => matchAny(lc(r.step_name), REWORK_PATTERNS));
  const reworkScheduledProjects = reworkActive
    .filter((r) => !!r.rework_scheduled_date || !!r.maturity_date)
    .map(toProject);
  const reworkUnscheduledProjects = reworkActive
    .filter((r) => !r.rework_scheduled_date && !r.maturity_date)
    .map(toProject);

  // Noch zu planen — Abschlussgespräch planen
  const closingsToPlanProjects = allPv
    .filter((r) => !r.is_finished && lc(r.step_name).includes("abschlussgespräch planen"))
    .map(toProject);

  // Geplante Abschlussgespräche — Abschlussgespräch (ohne "planen") + maturity_date
  const closingsScheduledProjects = allPv
    .filter((r) => {
      const s = lc(r.step_name);
      return (
        !r.is_finished &&
        s.includes("abschlussgespräch") &&
        !s.includes("planen") &&
        !!r.maturity_date
      );
    })
    .map(toProject);

  // ─── Bewegungs-KPIs: Rechnungen versendet ─────────────────────────────
  // Versendet = status_code=200, type=invoice (NICHT reversal_invoice).
  // "Exkl. Abschlussrechnung" interpretiere ich als: Rechnung ist nicht
  // vom Typ reversal_invoice und ist im gewählten Zeitraum versendet
  // worden (created date). PV-Filter über Projekt-Zugehörigkeit.
  const pvIds = new Set(allPv.map((r) => r.id));

  const { data: invoiceRows } = await supabase
    .from("hero_customer_documents")
    .select("id, project_match_id, type, status_code, nr, created, value")
    .eq("is_deleted", false)
    .eq("status_code", 200)
    .in("type", ["invoice"])
    .gte("created", fromIso)
    .lt("created", toIso)
    .limit(2000);

  const invoiceItems = (invoiceRows ?? [])
    .filter(
      (r) =>
        r.project_match_id != null &&
        pvIds.has(String(r.project_match_id))
    )
    .map((r) => {
      const pid = String(r.project_match_id);
      const proj = allPv.find((p) => p.id === pid);
      return {
        id: String(r.id),
        projectNumber: proj?.project_number ?? null,
        projectName: proj?.project_name ?? null,
        customerName: proj?.customer_name ?? null,
        docNumber: (r.nr as string | null) ?? null,
        type: (r.type as string | null) ?? null,
        created: (r.created as string | null) ?? null,
      };
    });

  // ─── Bewegungs-KPIs: Calendar Events ──────────────────────────────────
  // Filter über `original_event_start`: das ist der eingefrorene Wert
  // beim ersten Sync. Auch wenn jemand den Termin in Hero später
  // verschiebt, fällt er weiterhin in den Bericht der ursprünglichen
  // Woche. Fallback auf event_start für Zeilen ohne Original-Wert
  // (sollte nach dem Backfill keine geben).
  const { data: eventRows } = await supabase
    .from("hero_calendar_events")
    .select(
      "id, title, category_name, event_start, event_end, original_event_start, is_done, project_match_id, reminder_at, reminder_note"
    )
    .eq("is_deleted", false)
    .or(
      `and(original_event_start.gte.${fromIso},original_event_start.lt.${toIso}),and(original_event_start.is.null,event_start.gte.${fromIso},event_start.lt.${toIso})`
    )
    .limit(5000);

  const events = (eventRows ?? []) as Array<{
    id: string;
    title: string | null;
    category_name: string | null;
    event_start: string | null;
    event_end: string | null;
    original_event_start: string | null;
    is_done: boolean | null;
    project_match_id: string | null;
    reminder_at: string | null;
    reminder_note: string | null;
  }>;

  const toEvent = (e: (typeof events)[number]): PvKpiCalendarEvent => {
    const proj = e.project_match_id
      ? allPv.find((p) => p.id === e.project_match_id)
      : undefined;
    return {
      id: e.id,
      title: e.title,
      category: e.category_name,
      // Wir zeigen das eingefrorene Original-Datum — falls Hero den Termin
      // nachträglich verschoben hat, sieht der User trotzdem den
      // ursprünglichen Wert. event_end gibt's nicht in der gefrorenen
      // Variante, deshalb Live-Wert.
      start: e.original_event_start ?? e.event_start,
      end: e.event_end,
      isDone: e.is_done,
      projectId: e.project_match_id,
      projectNumber: proj?.project_number ?? null,
      projectName: proj?.project_name ?? null,
      reminderAt: e.reminder_at,
      reminderNote: e.reminder_note,
    };
  };

  // Filter: PV-Zugehörigkeit (entweder explizit über project_match_id in PV
  // oder ohne Projekt = ignorieren).
  const pvEvents = events.filter(
    (e) => e.project_match_id != null && pvIds.has(e.project_match_id)
  );

  // Gesamtmontagen — Kategorie ∈ {Gesamtmontage, AC Montage, DC Montage}.
  // Pro Projekt nur einmal zählen (DISTINCT).
  const installCategories = new Set([
    "gesamtmontage",
    "ac montage",
    "dc montage",
  ]);
  const installEvents = pvEvents.filter((e) =>
    installCategories.has(lc(e.category_name))
  );
  const installEventsDeduped = dedupeBy(installEvents, (e) => e.project_match_id ?? e.id);

  // WB/Speichererweiterung — Titel matched
  const storageEvents = pvEvents.filter((e) => {
    const t = lc(e.title);
    return (
      t.includes("speicher") ||
      t.includes("wallbox") ||
      /\bwb\b/.test(t)
    );
  });
  // Aus den storageEvents die installCategories-Events nicht doppelt zählen?
  // Doch — der User wollte sie als zwei separate Karten. Wir zählen daher
  // alle storageEvents pro Projekt einmal.
  const storageEventsDeduped = dedupeBy(storageEvents, (e) => e.project_match_id ?? e.id);

  // Zählerwechsel — Titel match
  const meterEvents = pvEvents.filter((e) => {
    const t = lc(e.title);
    return t.includes("zählerwechsel") || t.includes("zählermontage");
  });
  const meterEventsDeduped = dedupeBy(meterEvents, (e) => e.project_match_id ?? e.id);

  // ─── Termin-Aktivität (Gesamtmontage / Kleinauftrag) ──────────────────
  // Drei zusätzliche KPIs für die Kategorien Gesamtmontage + Kleinauftrag:
  // wie viele Termine wurden abgeschlossen, bearbeitet (also überhaupt im
  // Zeitraum stattgefunden) und wie viele kamen neu dazu (created in window).
  const activityCategories = new Set(["gesamtmontage", "kleinauftrag"]);
  const activityFilter = (e: (typeof events)[number]) =>
    activityCategories.has(lc(e.category_name)) &&
    e.project_match_id != null &&
    pvIds.has(e.project_match_id);

  const completedAppointments = events.filter(
    (e) => activityFilter(e) && e.is_done === true
  );
  const workedAppointments = events.filter(activityFilter);

  // "added" = im Zeitraum NEU angelegt — eigene Query auf created
  const { data: addedRows } = await supabase
    .from("hero_calendar_events")
    .select(
      "id, title, category_name, event_start, event_end, original_event_start, is_done, project_match_id, reminder_at, reminder_note, created_at"
    )
    .eq("is_deleted", false)
    .gte("created_at", fromIso)
    .lt("created_at", toIso)
    .limit(5000);
  const addedAppointments = ((addedRows ?? []) as Array<typeof events[number] & { created_at: string }>)
    .filter(activityFilter);

  // ─── Nacharbeiten erledigt diese Woche ────────────────────────────────
  // = im Zeitraum gab es eine Status-Transition AUS einem Nacharbeit-Step
  //   IN einen anderen Step (z.B. abgeschlossen / abschlussrechnung).
  // Wir nehmen vereinfacht: alle PV-Projekte deren NEUE Transition im Zeitraum
  // einen NICHT-Nacharbeit-Step erreicht hat, UND deren VORHERIGE Transition
  // ein Nacharbeit-Step war.
  const { data: transitionRows } = await supabase
    .from("hero_status_transitions")
    .select(
      "project_match_id, step_name, entered_at, history_index, department_key"
    )
    .eq("department_key", "PV")
    .gte("entered_at", fromIso)
    .lt("entered_at", toIso)
    .limit(5000);

  const transitions = (transitionRows ?? []) as Array<{
    project_match_id: string;
    step_name: string | null;
    entered_at: string;
    history_index: number;
    department_key: string | null;
  }>;

  // Für jede Transition checken: war der vorherige step für das Projekt ein Nacharbeit-Step?
  // Optimierung: alle vorherigen Transitions je Projekt aus DB holen.
  const projectsWithTransitionsInWindow = [
    ...new Set(transitions.map((t) => t.project_match_id)),
  ];

  let resolvedRework = new Set<string>();
  if (projectsWithTransitionsInWindow.length > 0) {
    const { data: priorRows } = await supabase
      .from("hero_status_transitions")
      .select("project_match_id, step_name, entered_at")
      .in("project_match_id", projectsWithTransitionsInWindow)
      .lt("entered_at", fromIso)
      .order("entered_at", { ascending: false })
      .limit(20000);

    const lastBeforeWindow = new Map<string, string | null>();
    for (const r of priorRows ?? []) {
      const pid = (r as { project_match_id: string }).project_match_id;
      if (!lastBeforeWindow.has(pid)) {
        lastBeforeWindow.set(
          pid,
          (r as { step_name: string | null }).step_name
        );
      }
    }

    for (const t of transitions) {
      const before = lastBeforeWindow.get(t.project_match_id);
      const isReworkBefore = matchAny(lc(before), REWORK_PATTERNS);
      const isReworkAfter = matchAny(lc(t.step_name), REWORK_PATTERNS);
      if (isReworkBefore && !isReworkAfter) {
        resolvedRework.add(t.project_match_id);
      }
    }
  }

  const reworkResolvedProjects = [...resolvedRework]
    .map((pid) => allPv.find((p) => p.id === pid))
    .filter((p): p is (typeof allPv)[number] => Boolean(p))
    .map(toProject);

  return {
    pipelineActive: {
      count: pipelineActiveProjects.length,
      projects: pipelineActiveProjects,
    },
    invoicesSent: { count: invoiceItems.length, items: invoiceItems },
    installations: {
      count: installEventsDeduped.length,
      events: installEventsDeduped.map(toEvent),
    },
    storageWallbox: {
      count: storageEventsDeduped.length,
      events: storageEventsDeduped.map(toEvent),
    },
    reworkResolved: {
      count: reworkResolvedProjects.length,
      projects: reworkResolvedProjects,
    },
    meterChange: {
      count: meterEventsDeduped.length,
      events: meterEventsDeduped.map(toEvent),
    },
    reworkScheduled: {
      count: reworkScheduledProjects.length,
      projects: reworkScheduledProjects,
    },
    reworkUnscheduled: {
      count: reworkUnscheduledProjects.length,
      projects: reworkUnscheduledProjects,
    },
    closingsToPlan: {
      count: closingsToPlanProjects.length,
      projects: closingsToPlanProjects,
    },
    closingsScheduled: {
      count: closingsScheduledProjects.length,
      projects: closingsScheduledProjects,
    },
    appointmentActivity: {
      completed: {
        count: completedAppointments.length,
        events: completedAppointments.map(toEvent),
      },
      worked: {
        count: workedAppointments.length,
        events: workedAppointments.map(toEvent),
      },
      added: {
        count: addedAppointments.length,
        events: addedAppointments.map(toEvent),
      },
    },
  };
}

function dedupeBy<T>(items: T[], keyFn: (item: T) => string | null): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!key) {
      out.push(item);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Letzte komplette Jumax-Woche: Fr 00:00 → Do 23:59 (Europe/Berlin).
 */
export function getJumaxWeekWindow(reference: Date = new Date()): PvKpiTimeWindow {
  const ref = new Date(reference);
  ref.setUTCHours(12, 0, 0, 0); // Lokal-Mittag, vermeidet Tagesgrenze
  const dayOfWeek = ref.getDay(); // 0=So..5=Fr 6=Sa
  const daysSinceFriday = (dayOfWeek - 5 + 7) % 7;
  const currentFriday = new Date(ref);
  currentFriday.setDate(ref.getDate() - daysSinceFriday);
  // 7 Tage zurück → Fr der letzten abgeschlossenen Woche.
  const lastFriday = new Date(currentFriday);
  lastFriday.setDate(currentFriday.getDate() - 7);

  const fromIso =
    `${dateToIsoLocal(lastFriday)}T00:00:00+02:00`;
  const toIso = `${dateToIsoLocal(currentFriday)}T00:00:00+02:00`;
  return {
    fromIso,
    toIso,
    label: `${dateToIsoLocal(lastFriday)} → ${dateToIsoLocal(
      addDays(currentFriday, -1)
    )}`,
  };
}

function dateToIsoLocal(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(d.getDate() + days);
  return next;
}
