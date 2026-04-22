import "server-only";

import { createClient } from "@supabase/supabase-js";

import {
  normalizeHeroProject,
  type HeroCustomerDocument,
  type HeroProject,
} from "@/lib/hero/hero-client";

/**
 * Read-side accessors for the Hero mirror tables.
 *
 * Everything here returns the same shapes the dashboard used to get from the
 * live Hero GraphQL client. The sync job (outside this runtime) is what keeps
 * Supabase fresh.
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

interface HeroCustomerDocumentRow {
  project_match_id: string | null;
  raw: Record<string, unknown> | null;
}

/**
 * Load every mirrored project, hydrate its customer_documents from the
 * separate mirror table and run the normalizer so downstream code sees the
 * exact same `HeroProject[]` shape it got from the live GraphQL query.
 */
export async function loadHeroProjectsFromSupabase(): Promise<HeroProject[]> {
  const supabase = supabaseAdmin();

  const { data: projectRows, error: projectsError } = await supabase
    .from("hero_projects")
    .select("id, raw")
    .eq("is_deleted", false);

  if (projectsError) {
    throw new Error(`Failed to load hero_projects: ${projectsError.message}`);
  }
  if (!projectRows || projectRows.length === 0) {
    return [];
  }

  const ids = (projectRows as HeroProjectRow[]).map((row) => row.id);
  const documentsByProjectId = await loadDocumentsForProjects(supabase, ids);

  return (projectRows as HeroProjectRow[]).flatMap((row) => {
    if (!row.raw) return [];
    const raw = { ...row.raw } as Record<string, unknown>;
    const docs = documentsByProjectId.get(row.id) ?? [];
    raw.customer_documents = docs;
    const project = normalizeHeroProject(
      raw as unknown as Parameters<typeof normalizeHeroProject>[0]
    );
    // Filter out any project type that doesn't map to a dashboard department
    // (e.g. Leads, inactive legacy types). normalizeHeroProject populates
    // project.department from type_id; a null department means "don't show".
    if (!project.department) return [];
    return [project];
  });
}

async function loadDocumentsForProjects(
  supabase: ReturnType<typeof supabaseAdmin>,
  projectIds: string[]
): Promise<Map<string, HeroCustomerDocument[]>> {
  const result = new Map<string, HeroCustomerDocument[]>();
  if (projectIds.length === 0) return result;

  const chunkSize = 500;
  for (let index = 0; index < projectIds.length; index += chunkSize) {
    const chunk = projectIds.slice(index, index + chunkSize);
    const { data, error } = await supabase
      .from("hero_customer_documents")
      .select("project_match_id, raw")
      .in("project_match_id", chunk)
      .eq("is_deleted", false);

    if (error) {
      throw new Error(
        `Failed to load hero_customer_documents: ${error.message}`
      );
    }

    for (const row of (data ?? []) as HeroCustomerDocumentRow[]) {
      if (!row.project_match_id || !row.raw) continue;
      const list = result.get(row.project_match_id) ?? [];
      list.push(row.raw as HeroCustomerDocument);
      result.set(row.project_match_id, list);
    }
  }
  return result;
}

export async function getHeroProjectsCount(): Promise<number> {
  const supabase = supabaseAdmin();
  const { count, error } = await supabase
    .from("hero_projects")
    .select("id", { count: "exact", head: true })
    .eq("is_deleted", false);
  if (error) {
    throw new Error(`hero_projects count failed: ${error.message}`);
  }
  return count ?? 0;
}

export interface HeroSyncStatus {
  lastRunAt: string | null;
  lastRunStatus: "success" | "error" | "running" | null;
  lastRunError: string | null;
  projectCount: number;
}

export async function getHeroSyncStatus(): Promise<HeroSyncStatus> {
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
}
