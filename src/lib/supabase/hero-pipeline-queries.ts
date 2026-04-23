import "server-only";

import { cache } from "react";
import { createClient } from "@supabase/supabase-js";

import {
  HERO_TYPE_ID_TO_DEPARTMENT,
  type Department,
  type ProjectDepartment,
} from "@/lib/dashboard/dashboard-types";
import {
  fetchDashboardProjectRows,
  type DashboardProjectRow,
} from "./hero-read-queries";
import { cleanProjectTitle } from "@/lib/hero/project-title";
import {
  classifyStep,
  isAccountingStep,
  isFinishedStep as isFinishedStepName,
  isReworkStep as isReworkStepName,
  STEP_CATEGORIES,
  type StepCategory,
} from "@/lib/hero/step-classifier";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase creds");
  return createClient(url, key);
}

/**
 * Per-department Hero pipeline panel.
 *
 * Reads the hero_dashboard_projects materialized view (already paginated
 * + cached by hero-read-queries), groups projects by `step_group` and
 * returns counts/metadata per step. For GESAMT the step_group collapses
 * emoji/whitespace variants so the same semantic step (e.g. Abschlussgespräch)
 * from multiple departments appears as one bucket. Distinct steps with
 * different meanings (e.g. "Nacharbeiten terminiert" vs
 * "Nacharbeiten nicht terminiert") stay separate.
 */

function typeIdsFor(department: Department): string[] {
  if (department === "GESAMT") {
    return Object.keys(HERO_TYPE_ID_TO_DEPARTMENT);
  }
  return Object.entries(HERO_TYPE_ID_TO_DEPARTMENT)
    .filter(([, dept]) => dept === department)
    .map(([typeId]) => typeId);
}

export interface HeroPipelineStep {
  /** step_group — the grouping key used across the UI. */
  id: string;
  name: string;
  projectCount: number;
  isFinished: boolean;
  overdueCount: number;
  reopenedCount: number;
  /** Pipeline-order key derived from Hero's status_code + sort_order. */
  stepOrder: number;
  /**
   * Wie viele Projekte sind im gewählten Timeframe IN diesen Step
   * gewandert (nur gesetzt wenn timeframe = past Zeitraum).
   */
  periodEnteredCount?: number;
  /**
   * Wie viele Projekte sind im gewählten Timeframe aus diesem Step
   * RAUS gewandert (= bearbeitet). Nur gesetzt bei past-Zeitraum.
   */
  periodLeftCount?: number;
  /**
   * Summe der offenen Rechnungen (EUR) der Projekte die aktuell in
   * diesem Step stehen. Nur für Abrechnungs-Steps gefüllt.
   */
  openInvoiceAmount?: number;
  /** Category-Bucket für die Gruppierung im UI. */
  category: StepCategory;
}

export interface HeroPipelineKpis {
  totalProjects: number;
  totalOpen: number;
  totalOverdue: number;
  totalReopened: number;
  completedLastWeek: number;
  newThisWeek: number;
  /** Summe noch offener Rechnungen (EUR) über alle offenen Projekte */
  openInvoiceAmount: number;
  openInvoiceCount: number;
}

export interface HeroPipelineDto extends HeroPipelineKpis {
  department: Department;
  typeIds: string[];
  steps: HeroPipelineStep[];
  /**
   * Optional: Änderungen im gewählten Zeitraum (nur gesetzt, wenn der
   * Timeframe nicht "current" ist). Quelle: hero_status_transitions.
   */
  timeframeDelta?: TimeframeDeltaDto;
}

export interface TimeframeDeltaDto {
  fromIso: string;
  toIso: string;
  newProjects: number;           // erste History-Transition im Zeitraum
  completedTransitions: number;  // Übergänge nach Abgeschlossen/Archiviert
  reworkTransitions: number;     // Übergänge nach Nacharbeit/Reklamation
  reopenedTransitions: number;   // Projekt war vorher Abgeschlossen und ist wieder offen geworden
  accountingTransitions: number; // Übergänge in Abschlussrechnung / Teil-RG / Kundenrechnung
  /** Summe der Rechnungsbeträge der Projekte die im Zeitraum nach Abrechnung gingen. */
  accountingTransitionsAmount: number;
  totalTransitions: number;      // alle Status-Wechsel insgesamt
  overdueBecame: number;         // Projekte die in diesem Zeitraum überfällig wurden
}

/**
 * Jumax reporting week: Friday 00:00 → Thursday 23:59:59.999 in
 * **Europe/Berlin** time. Vercel-Server laufen in UTC, deswegen
 * rechnen wir die Grenze explizit in Berlin-Zeit und wandeln sie in
 * einen UTC-Timestamp um.
 */
function getJumaxWeekBoundaries(now = new Date()): {
  currentWeekStart: number;
  lastWeekStart: number;
} {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  const weekday = get("weekday");
  const daysSinceFridayMap: Record<string, number> = {
    Fri: 0,
    Sat: 1,
    Sun: 2,
    Mon: 3,
    Tue: 4,
    Wed: 5,
    Thu: 6,
  };
  const daysSinceFriday = daysSinceFridayMap[weekday] ?? 0;

  // Berlin-Datum für den letzten Freitag
  const fridayUtcMid = Date.UTC(year, month - 1, day) - daysSinceFriday * 86400000;
  // Offset Berlin→UTC für das Datum bestimmen
  const probe = new Date(fridayUtcMid);
  const probeBerlinHour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Berlin",
      hour: "2-digit",
      hour12: false,
    })
      .formatToParts(probe)
      .find((p) => p.type === "hour")?.value ?? "0"
  );
  // Berlin ist probeBerlinHour Stunden vor UTC. Berlin-Mitternacht =
  // UTC-Mitternacht − offsetHours. Wenn probeBerlinHour=2 (CEST) →
  // Berlin-00:00 ist UTC-22:00 vom Vortag.
  const offsetHours = probeBerlinHour === 0 ? 0 : 24 - probeBerlinHour;
  const currentWeekStart = fridayUtcMid - offsetHours * 3600000;
  const lastWeekStart = currentWeekStart - 7 * 86400000;
  return { currentWeekStart, lastWeekStart };
}

function rowsFor(
  rows: DashboardProjectRow[],
  department: Department
): DashboardProjectRow[] {
  if (department === "GESAMT") {
    return rows.filter((row) => row.department_key != null);
  }
  return rows.filter((row) => row.department_key === department);
}

export interface TimeframeRangeIso {
  fromIso: string; // inklusive Start (z.B. 2026-04-17T00:00:00+02:00)
  toIso: string;   // exklusive Ende (z.B. 2026-04-24T00:00:00+02:00)
  label: string;   // "Woche (Fr → Do)", "Letzte 14 Tage", …
  /** "past" = Zeitraum liegt rückwärts (Änderungen) — "future" = Termin-Fenster (Fälligkeit). */
  direction: "past" | "future";
}

/**
 * Änderungen (Transitions) im Zeitraum für ein Department.
 * Liest aus hero_status_transitions + hero_dashboard_projects.
 */
export async function loadTimeframeDeltas(
  department: Department,
  range: TimeframeRangeIso
): Promise<TimeframeDeltaDto> {
  const supabase = supabaseAdmin();
  const typeIds = typeIdsFor(department);

  // Lade alle Transitions im Zeitraum und aggregiere in JS.

  let query = supabase
    .from("hero_status_transitions")
    .select("project_match_id, step_name, entered_at, history_index, department_key")
    .gte("entered_at", range.fromIso)
    .lt("entered_at", range.toIso);

  if (department !== "GESAMT") {
    query = query.eq("department_key", department);
  } else {
    query = query.not("department_key", "is", null);
  }
  // Hole in 1000er-Chunks (falls mal >1000 Transitions)
  const chunks: Array<{
    project_match_id: string;
    step_name: string | null;
    entered_at: string;
    history_index: number;
  }> = [];
  for (let offset = 0; offset < 10000; offset += 1000) {
    const { data, error } = await query.range(offset, offset + 999).order("entered_at", { ascending: true });
    if (error) {
      console.warn("loadTimeframeDeltas chunk failed:", error.message);
      break;
    }
    const rows = (data ?? []) as Array<{
      project_match_id: string;
      step_name: string | null;
      entered_at: string;
      history_index: number;
    }>;
    chunks.push(...rows);
    if (rows.length < 1000) break;
  }

  const seenNewProjects = new Set<string>();
  let completed = 0;
  let reworks = 0;
  let accounting = 0;
  let reopened = 0;
  const accountingProjectIds = new Set<string>();
  const finishedBefore = new Set<string>();

  // Für Reopen: wir müssen wissen ob das Projekt VOR dem Zeitraum schon mal
  // auf Abgeschlossen war. Das ist in hero_dashboard_projects.last_finish_at.
  const { data: finishedList } = await supabase
    .from("hero_dashboard_projects")
    .select("id, last_finish_at")
    .lt("last_finish_at", range.fromIso);
  for (const r of (finishedList ?? []) as Array<{ id: string; last_finish_at: string | null }>) {
    if (r.last_finish_at) finishedBefore.add(r.id);
  }

  for (const t of chunks) {
    if (!t.step_name) continue;
    if (t.history_index === 1) seenNewProjects.add(t.project_match_id);
    if (isFinishedStepName(t.step_name)) completed += 1;
    if (isReworkStepName(t.step_name)) {
      reworks += 1;
      if (finishedBefore.has(t.project_match_id)) reopened += 1;
    }
    if (isAccountingStep(t.step_name)) {
      accounting += 1;
      accountingProjectIds.add(t.project_match_id);
    }
  }

  // Summe der Rechnungsbeträge der Projekte die im Zeitraum nach Abrechnung
  // gegangen sind — als EUR-Anzeige für das "In Abrechnung"-Delta-Tile.
  let accountingAmount = 0;
  if (accountingProjectIds.size > 0) {
    const ids = Array.from(accountingProjectIds);
    for (let offset = 0; offset < ids.length; offset += 500) {
      const chunkIds = ids.slice(offset, offset + 500);
      const { data } = await supabase
        .from("hero_dashboard_projects")
        .select("id, accounting_open_amount, accounting_amount")
        .in("id", chunkIds);
      for (const r of (data ?? []) as Array<{
        accounting_open_amount: number | null;
        accounting_amount: number | null;
      }>) {
        // Bevorzuge offene Summe (noch nicht bezahlt), sonst Gesamtsumme
        accountingAmount += Number(r.accounting_open_amount ?? r.accounting_amount ?? 0) || 0;
      }
    }
  }

  // Projekte die in diesem Zeitraum überfällig wurden = maturity_date fiel
  // in den Zeitraum und Projekt war zu diesem Zeitpunkt noch offen.
  let overdueBecame = 0;
  const { data: overdueList } = await supabase
    .from("hero_dashboard_projects")
    .select("id, maturity_date, is_finished")
    .gte("maturity_date", range.fromIso)
    .lt("maturity_date", range.toIso);
  for (const r of (overdueList ?? []) as Array<{
    id: string; maturity_date: string | null; is_finished: boolean;
  }>) {
    if (r.maturity_date && !r.is_finished) overdueBecame += 1;
  }

  return {
    fromIso: range.fromIso,
    toIso: range.toIso,
    newProjects: seenNewProjects.size,
    completedTransitions: completed,
    reworkTransitions: reworks,
    reopenedTransitions: reopened,
    accountingTransitions: accounting,
    accountingTransitionsAmount: accountingAmount,
    totalTransitions: chunks.length,
    overdueBecame,
  };
}

/**
 * Für jeden Step (gekeyed per step_group, also ohne Emoji): wie viele
 * Transitions sind im Zeitraum in diesen Step eingetreten? Die gleiche
 * Normalisierung wie im View (strip leading emoji/symbols).
 */
async function loadStepTransitionCounts(
  department: Department,
  range: TimeframeRangeIso
): Promise<{ entered: Map<string, number>; left: Map<string, number> }> {
  const supabase = supabaseAdmin();
  const entered = new Map<string, number>();
  const left = new Map<string, number>();

  const groupOf = (stepName: string): string =>
    stepName.replace(/^[^A-Za-zÄÖÜäöüß0-9]+/g, "").trim();

  // 1) Eintritte im Zeitraum (entered_at zwischen from/to)
  let qEntered = supabase
    .from("hero_status_transitions")
    .select("step_name, department_key, entered_at")
    .gte("entered_at", range.fromIso)
    .lt("entered_at", range.toIso)
    .not("step_name", "is", null);
  if (department !== "GESAMT") qEntered = qEntered.eq("department_key", department);
  else qEntered = qEntered.not("department_key", "is", null);

  for (let offset = 0; offset < 30000; offset += 1000) {
    const { data, error } = await qEntered.range(offset, offset + 999);
    if (error) break;
    const rows = (data ?? []) as Array<{ step_name: string | null }>;
    for (const r of rows) {
      if (!r.step_name) continue;
      const key = groupOf(r.step_name);
      if (!key) continue;
      entered.set(key, (entered.get(key) ?? 0) + 1);
    }
    if (rows.length < 1000) break;
  }

  // 2) Austritte im Zeitraum (left_at zwischen from/to)
  let qLeft = supabase
    .from("hero_status_transitions")
    .select("step_name, department_key, left_at")
    .gte("left_at", range.fromIso)
    .lt("left_at", range.toIso)
    .not("step_name", "is", null);
  if (department !== "GESAMT") qLeft = qLeft.eq("department_key", department);
  else qLeft = qLeft.not("department_key", "is", null);

  for (let offset = 0; offset < 30000; offset += 1000) {
    const { data, error } = await qLeft.range(offset, offset + 999);
    if (error) break;
    const rows = (data ?? []) as Array<{ step_name: string | null }>;
    for (const r of rows) {
      if (!r.step_name) continue;
      const key = groupOf(r.step_name);
      if (!key) continue;
      left.set(key, (left.get(key) ?? 0) + 1);
    }
    if (rows.length < 1000) break;
  }

  return { entered, left };
}

export const loadHeroPipeline = cache(
  async (
    department: Department,
    timeframeRange?: TimeframeRangeIso,
    options?: { excludeCashSteps?: boolean; onlyCashSteps?: boolean }
  ): Promise<HeroPipelineDto> => {
    const all = await fetchDashboardProjectRows();
    let projects = rowsFor(all, department);
    const now = Date.now();
    const { currentWeekStart, lastWeekStart } = getJumaxWeekBoundaries();

    // Termin-Fenster (Morgen / In 3 Tagen / Nächste Woche): nur Projekte
    // zeigen deren maturity_date in diesem Zukunftsfenster liegt.
    if (timeframeRange?.direction === "future") {
      const from = new Date(timeframeRange.fromIso).getTime();
      const to = new Date(timeframeRange.toIso).getTime();
      projects = projects.filter((p) => {
        if (!p.maturity_date) return false;
        const t = Date.parse(p.maturity_date);
        return Number.isFinite(t) && t >= from && t < to;
      });
    }

    const stepMap = new Map<
      string,
      {
        name: string;
        projectCount: number;
        overdueCount: number;
        reopenedCount: number;
        stepOrder: number;
        openInvoiceAmount: number;
      }
    >();
    let totalOpen = 0;
    let totalOverdue = 0;
    let totalReopened = 0;
    let completedLastWeek = 0;
    let newThisWeek = 0;
    let openInvoiceAmount = 0;
    let openInvoiceCount = 0;

    for (const row of projects) {
      const stepKey = row.step_group ?? row.step_name ?? row.step_id;
      if (!stepKey) continue;
      // Display label = the full step_name with Hero emoji ("🔧 Zählermontage",
      // "💸 Abschlussrechnung", …). step_key is without the emoji so the
      // same semantic step from different departments shares a bucket on
      // GESAMT; we still show whichever emoji-version we see first.
      const display = row.step_name ?? row.step_group ?? stepKey;
      const bucket = stepMap.get(stepKey) ?? {
        name: display,
        projectCount: 0,
        overdueCount: 0,
        reopenedCount: 0,
        stepOrder: row.step_order ?? Number.MAX_SAFE_INTEGER,
        openInvoiceAmount: 0,
      };
      // Keep the *smallest* step_order across rows in the same bucket
      // (GESAMT merges steps across departments; we show them in pipeline
      // order of the earliest matching department step).
      if (
        row.step_order != null &&
        row.step_order < bucket.stepOrder
      ) {
        bucket.stepOrder = row.step_order;
      }
      bucket.projectCount += 1;
      const open = !row.is_finished;
      if (open) {
        totalOpen += 1;
        if (row.maturity_date) {
          const t = Date.parse(row.maturity_date);
          if (Number.isFinite(t) && t < now) {
            bucket.overdueCount += 1;
            totalOverdue += 1;
          }
        }
        if (row.was_reopened) {
          bucket.reopenedCount += 1;
          totalReopened += 1;
        }
        // "Offene Rechnung" in KPI-Sprech nur dann, wenn das Projekt aktuell
        // in einem Abrechnungs-Step steht (is_accounting_open aus der View —
        // PV/Klima/GT: Abschlussrechnung; WP zusätzlich 2. Teil-RG offen).
        if (row.is_accounting_open) {
          if (row.accounting_open_amount != null) {
            openInvoiceAmount += Number(row.accounting_open_amount) || 0;
          }
          if (row.accounting_open_count != null) {
            openInvoiceCount += Number(row.accounting_open_count) || 0;
          }
        }
      }
      // Offene Rechnungssumme auch pro Step aggregieren (damit wir bei den
      // Abrechnungs-Steps im Cash-Panel den Eur-Wert direkt anzeigen können).
      if (!row.is_finished && row.accounting_open_amount != null) {
        bucket.openInvoiceAmount +=
          Number(row.accounting_open_amount) || 0;
      }
      stepMap.set(stepKey, bucket);

      // Jumax reporting week = Friday morning → Thursday evening.
      // "Letzte Woche abgeschlossen": completion_date inside the previous
      // [Fri,Thu] window. "Neu diese Woche": created_at_hero inside the
      // current [Fri,Thu] window.
      if (row.is_finished && row.completion_date) {
        const completedAt = Date.parse(row.completion_date);
        if (
          Number.isFinite(completedAt) &&
          completedAt >= lastWeekStart &&
          completedAt < currentWeekStart
        ) {
          completedLastWeek += 1;
        }
      }

      if (row.created_at_hero) {
        const createdAt = Date.parse(row.created_at_hero);
        if (Number.isFinite(createdAt) && createdAt >= currentWeekStart) {
          newThisWeek += 1;
        }
      }
    }

    let steps: HeroPipelineStep[] = Array.from(stepMap.entries())
      .map(([id, meta]) => ({
        id,
        name: meta.name,
        projectCount: meta.projectCount,
        isFinished: isFinishedStepName(meta.name),
        overdueCount: meta.overdueCount,
        reopenedCount: meta.reopenedCount,
        stepOrder: meta.stepOrder,
        openInvoiceAmount: meta.openInvoiceAmount,
        category: classifyStep(meta.name),
      }))
      .sort((a, b) => {
        if (a.isFinished !== b.isFinished) return a.isFinished ? 1 : -1;
        return a.stepOrder - b.stepOrder;
      });

    // Cash-Steps (Abschluss-/Teil-/Kundenrechnung) optional ausblenden oder
    // isoliert anzeigen. Insights-Tab = nur operativ, Cash-Tab = nur Cash.
    if (options?.onlyCashSteps) {
      steps = steps.filter((step) => isAccountingStep(step.name));
    } else if (options?.excludeCashSteps) {
      steps = steps.filter((step) => !isAccountingStep(step.name));
    }

    // Delta-Karte (Änderungen im Zeitraum) nur bei "past" Timeframes;
    // bei "future" (Termin-Fenster) ist die Pipeline bereits auf das
    // Fälligkeitsfenster gefiltert.
    const timeframeDelta =
      timeframeRange && timeframeRange.direction === "past"
        ? await loadTimeframeDeltas(department, timeframeRange)
        : undefined;

    // Pro-Step Transition-Counts im Zeitraum (nur bei "past"):
    // entered = Projekte die in diesen Step gewandert sind,
    // left    = Projekte die diesen Step verlassen haben (= bearbeitet).
    if (timeframeRange && timeframeRange.direction === "past") {
      const { entered, left } = await loadStepTransitionCounts(
        department,
        timeframeRange
      );
      for (const step of steps) {
        // Match über step_group (ohne Emoji). `step.id` IST step_group.
        const inCount = entered.get(step.id);
        if (inCount != null) step.periodEnteredCount = inCount;
        const leftCount = left.get(step.id);
        if (leftCount != null) step.periodLeftCount = leftCount;
      }
    }

    return {
      department,
      typeIds: typeIdsFor(department),
      steps,
      totalProjects: projects.length,
      totalOpen,
      totalOverdue,
      totalReopened,
      completedLastWeek,
      newThisWeek,
      openInvoiceAmount,
      openInvoiceCount,
      timeframeDelta,
    };
  }
);

export interface PipelineProjectRow {
  id: string;
  projectNumber: string | null;
  projectName: string | null;
  customerName: string | null;
  stepName: string | null;
  previousStepName: string | null;
  previousStepAt: string | null;
  maturityDate: string | null;
  createdAtHero: string | null;
  completionDate: string | null;
  department: ProjectDepartment | null;
  wasReopened: boolean;
  /** Summe der offenen Invoice-Werte (Status 100/200) dieses Projekts */
  openInvoiceAmount: number;
  openInvoiceCount: number;
  /** Projekt steht aktuell in einem Abrechnungs-Step */
  isAccountingOpen: boolean;
  /** Fälligkeitsdatum vor heute, Projekt noch offen */
  isOverdue: boolean;
  /** Projekt wurde im gewählten Zeitraum neu angelegt (nur past-Timeframe) */
  isNewInPeriod: boolean;
  /** Projekt wurde im gewählten Zeitraum abgeschlossen (nur past-Timeframe) */
  isCompletedInPeriod: boolean;
  /** Aktueller Step ist Abgeschlossen/Archiviert */
  isFinished: boolean;
}

/**
 * Mappt eine DashboardProjectRow auf unseren UI-Projekt-Datensatz. Shared
 * zwischen loadProjectsForSteps und loadKpiProjects.
 */
function toPipelineProjectRow(
  row: DashboardProjectRow,
  options?: { periodFrom?: number | null; periodTo?: number | null; now?: number }
): PipelineProjectRow {
  const now = options?.now ?? Date.now();
  const createdTs = row.created_at_hero ? Date.parse(row.created_at_hero) : NaN;
  const completionTs = row.completion_date
    ? Date.parse(row.completion_date)
    : NaN;
  const maturityTs = row.maturity_date ? Date.parse(row.maturity_date) : NaN;

  const isFinished = row.is_finished ?? false;
  const isOverdue =
    !isFinished && Number.isFinite(maturityTs) && maturityTs < now;
  const periodFrom = options?.periodFrom ?? null;
  const periodTo = options?.periodTo ?? null;
  const isNewInPeriod =
    periodFrom != null &&
    periodTo != null &&
    Number.isFinite(createdTs) &&
    createdTs >= periodFrom &&
    createdTs < periodTo;
  const isCompletedInPeriod =
    periodFrom != null &&
    periodTo != null &&
    isFinished &&
    Number.isFinite(completionTs) &&
    completionTs >= periodFrom &&
    completionTs < periodTo;

  return {
    id: row.id,
    projectNumber: row.project_number,
    projectName: cleanProjectTitle(row.project_name, {
      customerName: row.customer_name,
      projectNumber: row.project_number,
    }),
    customerName: row.customer_name,
    stepName: row.step_name,
    previousStepName: row.previous_step_name ?? null,
    previousStepAt: row.previous_step_at ?? null,
    maturityDate: row.maturity_date,
    createdAtHero: row.created_at_hero ?? null,
    completionDate: row.completion_date ?? null,
    isOverdue,
    isNewInPeriod,
    isCompletedInPeriod,
    isFinished,
    department: row.department_key ?? null,
    wasReopened: row.was_reopened ?? false,
    openInvoiceAmount: Number(row.accounting_open_amount ?? 0) || 0,
    openInvoiceCount: Number(row.accounting_open_count ?? 0) || 0,
    isAccountingOpen: row.is_accounting_open ?? false,
  };
}

export type PipelineKpi =
  // Snapshot-KPIs (oberste Leiste)
  | "all_open"
  | "overdue"
  | "accounting_open"
  | "completed_last_week"
  | "new_this_week"
  | "reopens"
  // Zeitraum-Deltas (zweite Leiste)
  | "delta_new"
  | "delta_completed"
  | "delta_accounting"
  | "delta_rework"
  | "delta_reopens"
  | "delta_overdue_became";

/**
 * Projektliste hinter einer KPI-Kachel. Jede Kachel im Pipeline-Panel
 * zeigt eine Zahl — diese Funktion gibt die Projekte zurück, die diese
 * Zahl ergeben haben. Für Delta-KPIs muss ein timeframeRange (past)
 * übergeben werden.
 */
export async function loadKpiProjects(
  department: Department,
  kpi: PipelineKpi,
  options?: { timeframeRange?: TimeframeRangeIso }
): Promise<PipelineProjectRow[]> {
  const all = await fetchDashboardProjectRows();
  const rows = rowsFor(all, department);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const now = Date.now();
  const periodFrom =
    options?.timeframeRange?.direction === "past"
      ? new Date(options.timeframeRange.fromIso).getTime()
      : null;
  const periodTo =
    options?.timeframeRange?.direction === "past"
      ? new Date(options.timeframeRange.toIso).getTime()
      : null;
  const mapRow = (r: DashboardProjectRow) =>
    toPipelineProjectRow(r, { periodFrom, periodTo, now });

  // Snapshot-KPIs — direkt aus hero_dashboard_projects filtern.
  if (kpi === "all_open") {
    return rows.filter((r) => !r.is_finished).map(mapRow).sort(sortByNumber);
  }
  if (kpi === "overdue") {
    return rows
      .filter((r) => {
        if (r.is_finished) return false;
        if (!r.maturity_date) return false;
        const t = Date.parse(r.maturity_date);
        return Number.isFinite(t) && t < now;
      })
      .map(mapRow)
      .sort(sortByNumber);
  }
  if (kpi === "accounting_open") {
    return rows
      .filter((r) => !r.is_finished && r.is_accounting_open)
      .map(mapRow)
      .sort(sortByNumber);
  }
  if (kpi === "completed_last_week") {
    const { currentWeekStart, lastWeekStart } = getJumaxWeekBoundaries();
    return rows
      .filter((r) => {
        if (!r.is_finished || !r.completion_date) return false;
        const t = Date.parse(r.completion_date);
        return (
          Number.isFinite(t) && t >= lastWeekStart && t < currentWeekStart
        );
      })
      .map(mapRow)
      .sort(sortByNumber);
  }
  if (kpi === "new_this_week") {
    const { currentWeekStart } = getJumaxWeekBoundaries();
    return rows
      .filter((r) => {
        if (!r.created_at_hero) return false;
        const t = Date.parse(r.created_at_hero);
        return Number.isFinite(t) && t >= currentWeekStart;
      })
      .map(mapRow)
      .sort(sortByNumber);
  }
  if (kpi === "reopens") {
    return rows
      .filter((r) => !r.is_finished && r.was_reopened)
      .map(mapRow)
      .sort(sortByNumber);
  }

  // Delta-KPIs — brauchen timeframeRange und lesen hero_status_transitions.
  if (!options?.timeframeRange) return [];
  const range = options.timeframeRange;
  const supabase = supabaseAdmin();

  if (kpi === "delta_overdue_became") {
    // Projekte deren maturity_date im Zeitraum liegt UND noch offen sind.
    // hero_dashboard_projects direkt filtern.
    let q = supabase
      .from("hero_dashboard_projects")
      .select("id")
      .gte("maturity_date", range.fromIso)
      .lt("maturity_date", range.toIso)
      .eq("is_finished", false);
    if (department !== "GESAMT") q = q.eq("department_key", department);
    else q = q.not("department_key", "is", null);
    const ids = new Set<string>();
    for (let offset = 0; offset < 10000; offset += 1000) {
      const { data, error } = await q.range(offset, offset + 999);
      if (error) break;
      const chunk = (data ?? []) as Array<{ id: string }>;
      for (const row of chunk) ids.add(row.id);
      if (chunk.length < 1000) break;
    }
    return Array.from(ids)
      .map((id) => byId.get(id))
      .filter((r): r is DashboardProjectRow => !!r)
      .map(mapRow)
      .sort(sortByNumber);
  }

  // Status-Transitions-basierte KPIs: delta_new, delta_completed,
  // delta_accounting, delta_rework, delta_reopens.
  let tq = supabase
    .from("hero_status_transitions")
    .select("project_match_id, step_name, entered_at, history_index")
    .gte("entered_at", range.fromIso)
    .lt("entered_at", range.toIso)
    .not("step_name", "is", null);
  if (department !== "GESAMT") tq = tq.eq("department_key", department);
  else tq = tq.not("department_key", "is", null);

  const transitions: Array<{
    project_match_id: string;
    step_name: string | null;
    history_index: number | null;
  }> = [];
  for (let offset = 0; offset < 30000; offset += 1000) {
    const { data, error } = await tq.range(offset, offset + 999);
    if (error) break;
    const chunk = (data ?? []) as typeof transitions;
    transitions.push(...chunk);
    if (chunk.length < 1000) break;
  }

  // Für Reopens brauchen wir zusätzlich, welche Projekte VOR dem Zeitraum
  // schon mal Abgeschlossen waren (last_finish_at < fromIso).
  const finishedBefore = new Set<string>();
  if (kpi === "delta_reopens") {
    const { data } = await supabase
      .from("hero_dashboard_projects")
      .select("id, last_finish_at")
      .lt("last_finish_at", range.fromIso);
    for (const r of (data ?? []) as Array<{
      id: string;
      last_finish_at: string | null;
    }>) {
      if (r.last_finish_at) finishedBefore.add(r.id);
    }
  }

  const matchIds = new Set<string>();
  for (const t of transitions) {
    if (!t.step_name) continue;
    const n = t.step_name.toLowerCase();
    const isFinished = /abgeschlossen|archiviert/.test(n);
    const isRework = /nacharbeit|reklamation/.test(n);
    const isAccount = /abschlussrechnung|kundenrechnung|schlussrechnung|teil-rg|teilrechnung/.test(n);

    if (kpi === "delta_new" && t.history_index === 1) {
      matchIds.add(t.project_match_id);
    } else if (kpi === "delta_completed" && isFinished) {
      matchIds.add(t.project_match_id);
    } else if (kpi === "delta_accounting" && isAccount) {
      matchIds.add(t.project_match_id);
    } else if (kpi === "delta_rework" && isRework) {
      matchIds.add(t.project_match_id);
    } else if (
      kpi === "delta_reopens" &&
      isRework &&
      finishedBefore.has(t.project_match_id)
    ) {
      matchIds.add(t.project_match_id);
    }
  }

  return Array.from(matchIds)
    .map((id) => byId.get(id))
    .filter((r): r is DashboardProjectRow => !!r)
    .map(mapRow)
    .sort(sortByNumber);
}

function sortByNumber(a: PipelineProjectRow, b: PipelineProjectRow): number {
  return (a.projectNumber ?? "").localeCompare(b.projectNumber ?? "");
}

export async function loadProjectsForSteps(
  department: Department,
  stepKeys: string[],
  options?: { timeframeRange?: TimeframeRangeIso }
): Promise<PipelineProjectRow[]> {
  if (stepKeys.length === 0) return [];
  const all = await fetchDashboardProjectRows();
  const rows = rowsFor(all, department);
  const stepKeySet = new Set(stepKeys);

  const now = Date.now();
  const periodFrom =
    options?.timeframeRange?.direction === "past"
      ? new Date(options.timeframeRange.fromIso).getTime()
      : null;
  const periodTo =
    options?.timeframeRange?.direction === "past"
      ? new Date(options.timeframeRange.toIso).getTime()
      : null;

  return rows
    .filter((row) => {
      const key = row.step_group ?? row.step_name ?? row.step_id;
      return key != null && stepKeySet.has(key);
    })
    .map((row) => toPipelineProjectRow(row, { periodFrom, periodTo, now }))
    .sort(sortByNumber);
}
