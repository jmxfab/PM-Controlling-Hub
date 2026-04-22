import "server-only";

import { cache } from "react";

import {
  HERO_TYPE_ID_TO_DEPARTMENT,
  type Department,
  type ProjectDepartment,
} from "@/lib/dashboard/dashboard-types";
import {
  fetchDashboardProjectRows,
  type DashboardProjectRow,
} from "./hero-read-queries";

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

export const loadHeroPipeline = cache(
  async (department: Department): Promise<HeroPipelineDto> => {
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
    }))
    .sort((a, b) =>
      (a.projectNumber ?? "").localeCompare(b.projectNumber ?? "")
    );
}
