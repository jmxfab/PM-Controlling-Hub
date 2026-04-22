import "server-only";

import { cache } from "react";
import { createClient } from "@supabase/supabase-js";

import {
  normalizeHeroProject,
  type HeroProject,
} from "@/lib/hero/hero-client";

/**
 * Read-side accessors for the Hero mirror tables.
 *
 * `loadHeroProjectsFromSupabase` is wrapped in React `cache()` so a single
 * request that needs projects for every tab only pays for one Supabase read
 * (plus one aggregate for accounting totals). Customer documents are NOT
 * hydrated into each project by default — fetching 18k+ document rows just
 * to compute a per-project invoice sum is wasteful. Instead we aggregate
 * invoice totals server-side via SQL and merge the sum into each project
 * as `accounting_amount`. Anything that needs the full document list on a
 * single project can fetch it on demand.
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

interface HeroProjectRow {
  id: string;
  raw: Record<string, unknown> | null;
}

export const loadHeroProjectsFromSupabase = cache(
  async (): Promise<HeroProject[]> => {
    const supabase = supabaseAdmin();

    const [projectsResult, accountingSums] = await Promise.all([
      supabase.from("hero_projects").select("id, raw").eq("is_deleted", false),
      loadAccountingSumsByProjectId(),
    ]);

    const { data: projectRows, error: projectsError } = projectsResult;
    if (projectsError) {
      throw new Error(`Failed to load hero_projects: ${projectsError.message}`);
    }
    if (!projectRows || projectRows.length === 0) {
      return [];
    }

    return (projectRows as HeroProjectRow[]).flatMap((row) => {
      if (!row.raw) return [];
      const project = normalizeHeroProject(
        row.raw as unknown as Parameters<typeof normalizeHeroProject>[0]
      );
      if (!project.department) return [];

      const accountingAmount = accountingSums.get(row.id);
      if (accountingAmount != null && accountingAmount > 0) {
        project.accounting_amount = accountingAmount;
      }
      return [project];
    });
  }
);

/**
 * Aggregate invoice totals per project_match_id via SQL. Matches the same
 * "type contains invoice/rechnung" rule the in-memory normalizer used to
 * apply, but does it in one query rather than 18k row materialisation.
 */
const loadAccountingSumsByProjectId = cache(
  async (): Promise<Map<string, number>> => {
    const supabase = supabaseAdmin();
    const result = new Map<string, number>();

    const { data, error } = await supabase
      .from("hero_customer_documents")
      .select("project_match_id, value, type, document_type_name, document_base_type")
      .eq("is_deleted", false)
      .not("project_match_id", "is", null)
      .not("value", "is", null);

    if (error) {
      console.warn("accounting sums query failed:", error.message);
      return result;
    }

    for (const row of (data ?? []) as Array<{
      project_match_id: string | null;
      value: number | null;
      type: string | null;
      document_type_name: string | null;
      document_base_type: string | null;
    }>) {
      if (!row.project_match_id || row.value == null) continue;
      const typeValue =
        `${row.type ?? ""} ${row.document_type_name ?? ""} ${row.document_base_type ?? ""}`.toLowerCase();
      if (!typeValue.includes("invoice") && !typeValue.includes("rechnung")) {
        continue;
      }
      result.set(
        row.project_match_id,
        (result.get(row.project_match_id) ?? 0) + row.value
      );
    }

    return result;
  }
);

export const getHeroProjectsCount = cache(async (): Promise<number> => {
  const supabase = supabaseAdmin();
  const { count, error } = await supabase
    .from("hero_projects")
    .select("id", { count: "exact", head: true })
    .eq("is_deleted", false);
  if (error) {
    throw new Error(`hero_projects count failed: ${error.message}`);
  }
  return count ?? 0;
});

export interface HeroSyncStatus {
  lastRunAt: string | null;
  lastRunStatus: "success" | "error" | "running" | null;
  lastRunError: string | null;
  projectCount: number;
}

export const getHeroSyncStatus = cache(async (): Promise<HeroSyncStatus> => {
  const supabase = supabaseAdmin();

  const [{ data: runRows, error: runsError }, projectCount] = await Promise.all(
    [
      supabase
        .from("hero_sync_runs")
        .select("started_at, finished_at, status, error_message")
        .eq("entity", "projects")
        .order("started_at", { ascending: false })
        .limit(1),
      getHeroProjectsCount(),
    ]
  );

  if (runsError) {
    return {
      lastRunAt: null,
      lastRunStatus: null,
      lastRunError: runsError.message,
      projectCount,
    };
  }

  const latest = runRows?.[0];
  return {
    lastRunAt: latest?.finished_at ?? latest?.started_at ?? null,
    lastRunStatus: (latest?.status as HeroSyncStatus["lastRunStatus"]) ?? null,
    lastRunError: latest?.error_message ?? null,
    projectCount,
  };
});
