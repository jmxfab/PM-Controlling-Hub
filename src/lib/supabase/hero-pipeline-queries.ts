import "server-only";

import { cache } from "react";
import { createClient } from "@supabase/supabase-js";

import {
  HERO_TYPE_ID_TO_DEPARTMENT,
  type Department,
  type ProjectDepartment,
} from "@/lib/dashboard/dashboard-types";
import { loadHeroProjectsFromSupabase } from "./hero-read-queries";

/**
 * Per-department Hero pipeline panel.
 *
 * Shares the cached HeroProject[] with the rest of the dashboard — no second
 * Supabase round trip. Step reference data still comes from
 * hero_project_types so steps that currently have zero projects are still
 * listed.
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

const loadProjectTypeStepsOnce = cache(
  async (): Promise<Map<string, Map<string, { name: string; sortOrder: number }>>> => {
    // Map<typeId, Map<stepId, { name, sortOrder }>>
    const supabase = supabaseAdmin();
    const result = new Map<string, Map<string, { name: string; sortOrder: number }>>();

    const { data, error } = await supabase
      .from("hero_project_types")
      .select("id, raw");

    if (error) {
      console.warn("loadProjectTypeStepsOnce:", error.message);
      return result;
    }

    for (const row of (data ?? []) as Array<{
      id: string;
      raw: Record<string, unknown> | null;
    }>) {
      const steps = (row.raw?.project_status_steps as
        | Array<{ id?: unknown; name?: unknown; sort_order?: unknown }>
        | undefined) ?? [];
      const perType = new Map<string, { name: string; sortOrder: number }>();
      for (const step of steps) {
        const id = step.id != null ? String(step.id) : null;
        const name = typeof step.name === "string" ? step.name : null;
        if (!id || !name) continue;
        perType.set(id, {
          name,
          sortOrder: typeof step.sort_order === "number" ? step.sort_order : 0,
        });
      }
      result.set(row.id, perType);
    }
    return result;
  }
);

export const loadHeroPipeline = cache(
  async (department: Department): Promise<HeroPipelineDto> => {
    const typeIds = typeIdsFor(department);
    const typeIdSet = new Set(typeIds);

    const [allProjects, stepsByType] = await Promise.all([
      loadHeroProjectsFromSupabase(),
      loadProjectTypeStepsOnce(),
    ]);

    const projects = allProjects.filter(
      (project) => project.type_id != null && typeIdSet.has(project.type_id)
    );

    // Step reference pool — start from hero_project_types so empty steps
    // (zero projects currently) still appear. GESAMT: union across types.
    const steps = new Map<string, { name: string; sortOrder: number }>();
    for (const typeId of typeIds) {
      const perType = stepsByType.get(typeId);
      if (!perType) continue;
      for (const [stepId, meta] of perType) {
        if (!steps.has(stepId)) steps.set(stepId, meta);
      }
    }

    // Count projects per step + overdue from the in-memory HeroProject array.
    const counts = new Map<string, number>();
    let totalOpen = 0;
    let totalOverdue = 0;
    const now = Date.now();

    for (const project of projects) {
      const stepId = project.step_id;
      const stepName = project.step_name;
      if (!stepId || !stepName) continue;

      if (!steps.has(stepId)) {
        steps.set(stepId, {
          name: stepName,
          sortOrder: project.step_sort_order ?? 0,
        });
      }
      counts.set(stepId, (counts.get(stepId) ?? 0) + 1);

      if (!isFinishedStep(stepName)) {
        totalOpen += 1;
        const maturity = project.maturity_date;
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
      .sort((a, b) => {
        if (a.isFinished !== b.isFinished) return a.isFinished ? 1 : -1;
        return b.projectCount - a.projectCount;
      });

    return {
      department,
      typeIds,
      steps: pipelineSteps,
      totalProjects: projects.length,
      totalOpen,
      totalOverdue,
    };
  }
);

export interface PipelineProjectRow {
  id: string;
  projectNumber: string | null;
  projectName: string | null;
  customerName: string | null;
  stepName: string | null;
  maturityDate: string | null;
  department: ProjectDepartment | null;
}

export async function loadProjectsForSteps(
  department: Department,
  stepIds: string[]
): Promise<PipelineProjectRow[]> {
  if (stepIds.length === 0) return [];
  const typeIds = typeIdsFor(department);
  const typeIdSet = new Set(typeIds);
  const stepIdSet = new Set(stepIds);

  const projects = await loadHeroProjectsFromSupabase();

  return projects
    .filter(
      (project) =>
        project.type_id != null &&
        typeIdSet.has(project.type_id) &&
        project.step_id != null &&
        stepIdSet.has(project.step_id)
    )
    .map((project) => ({
      id: project.id,
      projectNumber: project.project_number,
      projectName: project.name,
      customerName: project.customer_name ?? null,
      stepName: project.step_name ?? null,
      maturityDate: project.maturity_date ?? null,
      department: project.department ?? null,
    }))
    .sort((a, b) => (a.projectNumber ?? "").localeCompare(b.projectNumber ?? ""));
}
