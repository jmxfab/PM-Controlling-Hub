import "server-only";

import { createClient } from "@supabase/supabase-js";

import {
  HERO_TYPE_ID_TO_DEPARTMENT,
  type Department,
  type ProjectDepartment,
} from "@/lib/dashboard/dashboard-types";

/**
 * Read helpers for the per-department Hero pipeline panel.
 *
 * Queries Supabase directly on JSONB paths — fast enough for a few thousand
 * projects, and keeps the normalizeHeroProject hydration path out of the way.
 */

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, key);
}

function typeIdsFor(department: Department): string[] {
  if (department === "GESAMT") {
    return Object.keys(HERO_TYPE_ID_TO_DEPARTMENT);
  }
  return Object.entries(HERO_TYPE_ID_TO_DEPARTMENT)
    .filter(([, dept]) => dept === department)
    .map(([typeId]) => typeId);
}

export interface HeroPipelineStep {
  id: string;
  name: string;
  sortOrder: number;
  projectCount: number;
  isFinished: boolean;
}

export interface HeroPipelineDto {
  department: Department;
  typeIds: string[];
  steps: HeroPipelineStep[];
  totalProjects: number;
  totalOpen: number;
  totalOverdue: number;
}

const FINISHED_NAME_PATTERNS = [
  "abgeschlossen",
  "archiviert",
  "fertig",
  "finished",
  "done",
];

function isFinishedStep(name: string | null | undefined): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return FINISHED_NAME_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * Load the pipeline (all step buckets + counts) for a department.
 * For GESAMT we aggregate across all mapped type_ids.
 */
export async function loadHeroPipeline(
  department: Department
): Promise<HeroPipelineDto> {
  const supabase = supabaseAdmin();
  const typeIds = typeIdsFor(department);

  // 1. Load all projects for these type_ids — we only need the step info
  //    and maturity_date, not the full row.
  const { data, error } = await supabase
    .from("hero_projects")
    .select("raw")
    .in("raw->>type_id", typeIds)
    .eq("is_deleted", false);

  if (error) {
    throw new Error(`loadHeroPipeline: ${error.message}`);
  }

  type RawRow = { raw: Record<string, unknown> | null };
  const rows = (data ?? []) as RawRow[];

  // 2. Determine the reference set of steps we want to show. For a specific
  //    department we read hero_project_types; for GESAMT we synthesize from
  //    the actual projects so we don't list every type's step pool.
  const steps = new Map<string, { name: string; sortOrder: number }>();

  if (department !== "GESAMT") {
    const { data: typeRows, error: typesError } = await supabase
      .from("hero_project_types")
      .select("raw")
      .in("id", typeIds);
    if (typesError) {
      throw new Error(`loadHeroPipeline (types): ${typesError.message}`);
    }

    for (const typeRow of (typeRows ?? []) as RawRow[]) {
      const stepList = (typeRow.raw?.project_status_steps as
        | Array<{ id?: unknown; name?: unknown; sort_order?: unknown }>
        | undefined) ?? [];
      for (const step of stepList) {
        const id = step.id != null ? String(step.id) : null;
        const name = typeof step.name === "string" ? step.name : null;
        if (!id || !name) continue;
        if (!steps.has(id)) {
          steps.set(id, {
            name,
            sortOrder: typeof step.sort_order === "number" ? step.sort_order : 0,
          });
        }
      }
    }
  }

  // 3. Count projects per step + track overdue.
  const counts = new Map<string, number>();
  let totalOpen = 0;
  let totalOverdue = 0;
  const now = Date.now();

  for (const row of rows) {
    const cpms = (row.raw?.current_project_match_status ?? null) as
      | Record<string, unknown>
      | null;
    const step = (cpms?.step ?? null) as
      | { id?: unknown; name?: unknown; sort_order?: unknown }
      | null;
    const stepId = step?.id != null ? String(step.id) : null;
    const stepName = typeof step?.name === "string" ? step.name : null;

    if (!stepId || !stepName) continue;

    if (!steps.has(stepId)) {
      steps.set(stepId, {
        name: stepName,
        sortOrder: typeof step?.sort_order === "number" ? step.sort_order : 0,
      });
    }
    counts.set(stepId, (counts.get(stepId) ?? 0) + 1);

    if (!isFinishedStep(stepName)) {
      totalOpen += 1;
      const maturity =
        typeof cpms?.maturity_date === "string" ? (cpms.maturity_date as string) : null;
      if (maturity) {
        const maturityTime = Date.parse(maturity);
        if (Number.isFinite(maturityTime) && maturityTime < now) {
          totalOverdue += 1;
        }
      }
    }
  }

  const pipelineSteps: HeroPipelineStep[] = Array.from(steps.entries())
    .map(([id, meta]) => ({
      id,
      name: meta.name,
      sortOrder: meta.sortOrder,
      projectCount: counts.get(id) ?? 0,
      isFinished: isFinishedStep(meta.name),
    }))
    // Primary sort: active steps first, finished last.
    // Secondary sort: descending project count (most-used steps float up).
    .sort((a, b) => {
      if (a.isFinished !== b.isFinished) return a.isFinished ? 1 : -1;
      return b.projectCount - a.projectCount;
    });

  return {
    department,
    typeIds,
    steps: pipelineSteps,
    totalProjects: rows.length,
    totalOpen,
    totalOverdue,
  };
}

export interface PipelineProjectRow {
  id: string;
  projectNumber: string | null;
  projectName: string | null;
  customerName: string | null;
  stepName: string | null;
  maturityDate: string | null;
  department: ProjectDepartment | null;
}

/**
 * Load the projects currently sitting in one or more selected steps
 * (by step id). Used when the user picks steps in the pipeline panel.
 */
export async function loadProjectsForSteps(
  department: Department,
  stepIds: string[]
): Promise<PipelineProjectRow[]> {
  if (stepIds.length === 0) return [];
  const supabase = supabaseAdmin();
  const typeIds = typeIdsFor(department);

  const { data, error } = await supabase
    .from("hero_projects")
    .select("id, project_number, project_name, customer_name, maturity_date, raw")
    .in("raw->>type_id", typeIds)
    .eq("is_deleted", false);

  if (error) {
    throw new Error(`loadProjectsForSteps: ${error.message}`);
  }

  type Row = {
    id: string;
    project_number: string | null;
    project_name: string | null;
    customer_name: string | null;
    maturity_date: string | null;
    raw: Record<string, unknown> | null;
  };

  const stepIdSet = new Set(stepIds);

  return (data ?? [])
    .filter((r) => {
      const raw = (r as Row).raw;
      const stepId = ((raw?.current_project_match_status as Record<string, unknown> | null)?.step as
        | Record<string, unknown>
        | null)?.id;
      return stepId != null && stepIdSet.has(String(stepId));
    })
    .map((r) => {
      const raw = (r as Row).raw;
      const cpms = raw?.current_project_match_status as
        | Record<string, unknown>
        | null;
      const step = cpms?.step as Record<string, unknown> | null;
      const typeId = raw?.type_id != null ? String(raw.type_id) : null;
      return {
        id: (r as Row).id,
        projectNumber: (r as Row).project_number,
        projectName: (r as Row).project_name,
        customerName: (r as Row).customer_name,
        stepName: typeof step?.name === "string" ? step.name : null,
        maturityDate: (r as Row).maturity_date,
        department: typeId
          ? (HERO_TYPE_ID_TO_DEPARTMENT[typeId] ?? null)
          : null,
      } satisfies PipelineProjectRow;
    })
    .sort((a, b) => (a.projectNumber ?? "").localeCompare(b.projectNumber ?? ""));
}
