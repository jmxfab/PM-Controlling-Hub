import "server-only";

import {
  computeKPIsFromProjectsAt,
  groupProjectsByDepartment,
} from "@/lib/hero/hero-aggregator";
import { fetchAllHeroProjects } from "@/lib/hero/hero-client";
import { upsertKpiSnapshot } from "@/lib/supabase/dashboard-queries";

export interface HeroSyncResult {
  totalProjects: number;
  projectsByDepartment: Record<string, number>;
  durationMs: number;
  syncedAt: string;
}

export async function runHeroSync(): Promise<HeroSyncResult> {
  const startTime = Date.now();
  const today = new Date().toISOString().split("T")[0];
  const referenceDate = new Date();

  const allProjects = await fetchAllHeroProjects();
  const grouped = groupProjectsByDepartment(allProjects);

  const projectsByDepartment: Record<string, number> = {};

  for (const department of ["PV", "WP", "HAUSTECHNIK"] as const) {
    const projects = grouped[department] ?? [];
    projectsByDepartment[department] = projects.length;
    const kpis = computeKPIsFromProjectsAt(projects, referenceDate);
    await upsertKpiSnapshot(department, kpis, today);
  }

  const gesamtKpis = computeKPIsFromProjectsAt(allProjects, referenceDate);
  await upsertKpiSnapshot("GESAMT", gesamtKpis, today);
  projectsByDepartment["GESAMT"] = allProjects.length;

  return {
    totalProjects: allProjects.length,
    projectsByDepartment,
    durationMs: Date.now() - startTime,
    syncedAt: new Date().toISOString(),
  };
}
