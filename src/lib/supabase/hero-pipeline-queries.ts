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
  totalTransitions: number;      // alle Status-Wechsel insgesamt
  overdueBecame: number;         // Projekte die in diesem Zeitraum überfällig wurden
}

const FINISHED_NAME_PATTERNS = ["abgeschlossen", "archiviert", "fertig", "finished"];

function isFinishedStep(name: string | null | undefined): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return FINISHED_NAME_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * Jumax reporting week: Friday 00:00 → Thursday 23:59:59.999.
 *
 * Returns [currentWeekStart, lastWeekStart] for counting:
 *   - completedLastWeek: lastWeekStart ≤ completion_date < currentWeekStart
 *   - newThisWeek: created_at_hero ≥ currentWeekStart
 *
 * Done with a single local-time Date so daylight-savings transitions and
 * server timezone don't shift the boundary off the Friday morning.
 */
function getJumaxWeekBoundaries(now = new Date()): {
  currentWeekStart: number;
  lastWeekStart: number;
} {
  const start = new Date(now);
  const dayOfWeek = start.getDay(); // 0=Sun, 1=Mon, … 5=Fri, 6=Sat
  const daysSinceFriday = (dayOfWeek - 5 + 7) % 7;
  start.setDate(start.getDate() - daysSinceFriday);
  start.setHours(0, 0, 0, 0);
  const currentWeekStart = start.getTime();
  const lastWeekStart = currentWeekStart - 7 * 24 * 60 * 60 * 1000;
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

  // Basis-Query: alle Transitions im Zeitraum + Department-Filter
  let deptFilter = "";
  const deptParams: string[] = [];
  if (department !== "GESAMT") {
    deptFilter = ` AND department_key = '${department}'`;
  } else {
    deptFilter = ` AND department_key IS NOT NULL`;
  }

  // Transitions im Zeitraum pro Kategorie via SQL-RPC ... oder inline
  // Wir nutzen eine einzige SELECT mit FILTER-Aggregaten.
  const sql = `
    SELECT
      count(DISTINCT t.project_match_id) FILTER (
        WHERE t.history_index = 1
      ) AS new_projects,
      count(*) FILTER (
        WHERE LOWER(t.step_name) SIMILAR TO '%(abgeschlossen|archiviert)%'
      ) AS completed,
      count(*) FILTER (
        WHERE LOWER(t.step_name) ~ '(nacharbeit|reklamation)'
      ) AS reworks,
      count(*) FILTER (
        WHERE LOWER(t.step_name) LIKE '%abschlussrechnung%'
           OR LOWER(t.step_name) LIKE '%kundenrechnung%'
           OR LOWER(t.step_name) LIKE '%schlussrechnung%'
           OR LOWER(t.step_name) LIKE '%teil-rg%'
           OR LOWER(t.step_name) LIKE '%teilrechnung%'
      ) AS accounting,
      count(*) AS total
    FROM hero_status_transitions t
    WHERE t.entered_at >= $1::timestamptz
      AND t.entered_at <  $2::timestamptz
      ${deptFilter}
  `;
  void sql;
  void deptParams;

  // Leichteres: alle transitions via supabase REST mit inline filtern
  // Supabase-js kann JSON-basierte Range-Queries, aber für FILTERs mit
  // SIMILAR/ILIKE brauchen wir rpc. Stattdessen: lade alle relevanten
  // Zeilen und aggregiere in JS (im Zeitraum sind meist <1000 Zeilen).

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
    const n = t.step_name.toLowerCase();
    const isFinishedStep = /abgeschlossen|archiviert/.test(n);
    const isReworkStep = /nacharbeit|reklamation/.test(n);
    const isAccountingStep = /abschlussrechnung|kundenrechnung|schlussrechnung|teil-rg|teilrechnung/.test(n);
    if (t.history_index === 1) seenNewProjects.add(t.project_match_id);
    if (isFinishedStep) completed += 1;
    if (isReworkStep) {
      reworks += 1;
      if (finishedBefore.has(t.project_match_id)) reopened += 1;
    }
    if (isAccountingStep) accounting += 1;
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
    totalTransitions: chunks.length,
    overdueBecame,
  };
}

export const loadHeroPipeline = cache(
  async (
    department: Department,
    timeframeRange?: TimeframeRangeIso
  ): Promise<HeroPipelineDto> => {
    const all = await fetchDashboardProjectRows();
    const projects = rowsFor(all, department);
    const now = Date.now();
    const { currentWeekStart, lastWeekStart } = getJumaxWeekBoundaries();

    const stepMap = new Map<
      string,
      {
        name: string;
        projectCount: number;
        overdueCount: number;
        reopenedCount: number;
        stepOrder: number;
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

    const steps: HeroPipelineStep[] = Array.from(stepMap.entries())
      .map(([id, meta]) => ({
        id,
        name: meta.name,
        projectCount: meta.projectCount,
        isFinished: isFinishedStep(meta.name),
        overdueCount: meta.overdueCount,
        reopenedCount: meta.reopenedCount,
        stepOrder: meta.stepOrder,
      }))
      // Sort by Hero pipeline order: finished states last, then by
      // status_code*1e6 + sort_order*1e3 (derived in the view).
      .sort((a, b) => {
        if (a.isFinished !== b.isFinished) return a.isFinished ? 1 : -1;
        return a.stepOrder - b.stepOrder;
      });

    const timeframeDelta = timeframeRange
      ? await loadTimeframeDeltas(department, timeframeRange)
      : undefined;

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
  department: ProjectDepartment | null;
  wasReopened: boolean;
  /** Summe der offenen Invoice-Werte (Status 100/200) dieses Projekts */
  openInvoiceAmount: number;
  openInvoiceCount: number;
  /** Projekt steht aktuell in einem Abrechnungs-Step */
  isAccountingOpen: boolean;
}

export async function loadProjectsForSteps(
  department: Department,
  stepKeys: string[]
): Promise<PipelineProjectRow[]> {
  if (stepKeys.length === 0) return [];
  const all = await fetchDashboardProjectRows();
  const rows = rowsFor(all, department);
  const stepKeySet = new Set(stepKeys);

  return rows
    .filter((row) => {
      const key = row.step_group ?? row.step_name ?? row.step_id;
      return key != null && stepKeySet.has(key);
    })
    .map((row) => ({
      id: row.id,
      projectNumber: row.project_number,
      projectName: row.project_name,
      customerName: row.customer_name,
      stepName: row.step_name,
      previousStepName: row.previous_step_name ?? null,
      previousStepAt: row.previous_step_at ?? null,
      maturityDate: row.maturity_date,
      department: row.department_key ?? null,
      wasReopened: row.was_reopened ?? false,
      openInvoiceAmount: Number(row.accounting_open_amount ?? 0) || 0,
      openInvoiceCount: Number(row.accounting_open_count ?? 0) || 0,
      isAccountingOpen: row.is_accounting_open ?? false,
    }))
    .sort((a, b) =>
      (a.projectNumber ?? "").localeCompare(b.projectNumber ?? "")
    );
}
