import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";

import {
  normalizeHeroProject,
  type HeroProject,
} from "@/lib/hero/hero-client";

/**
 * TTL for the cross-request data cache. The GitHub Actions sync refreshes
 * Supabase every 15 min, so a 60 s view is both cheap and acceptably fresh.
 */
const DATA_CACHE_TTL_S = 60;

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

/**
 * Raw Supabase fetch of the project rows. Cached across requests via
 * Next.js unstable_cache so repeated dashboard renders within the TTL
 * hit the data cache rather than re-reading 3k rows.
 */
const fetchHeroProjectRows = unstable_cache(
  async (): Promise<HeroProjectRow[]> => {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("hero_projects")
      .select("id, raw")
      .eq("is_deleted", false);
    if (error) {
      throw new Error(`Failed to load hero_projects: ${error.message}`);
    }
    return (data ?? []) as HeroProjectRow[];
  },
  ["hero_projects_raw"],
  { revalidate: DATA_CACHE_TTL_S, tags: ["hero_projects"] }
);

export const loadHeroProjectsFromSupabase = cache(
  async (): Promise<HeroProject[]> => {
    const [projectRows, accountingSums] = await Promise.all([
      fetchHeroProjectRows(),
      loadAccountingSumsByProjectId(),
    ]);

    if (projectRows.length === 0) return [];

    return projectRows.flatMap((row) => {
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
const fetchAccountingSumPairs = unstable_cache(
  async (): Promise<Array<[string, number]>> => {
    const supabase = supabaseAdmin();

    // Push the invoice/Rechnung filter to SQL — without it we'd pull all
    // 18k+ rows just to drop >80% of them in JS.
    const invoiceFilter = [
      "type.ilike.%invoice%",
      "type.ilike.%rechnung%",
      "document_type_name.ilike.%invoice%",
      "document_type_name.ilike.%rechnung%",
      "document_base_type.ilike.%invoice%",
      "document_base_type.ilike.%rechnung%",
    ].join(",");

    const { data, error } = await supabase
      .from("hero_customer_documents")
      .select("project_match_id, value")
      .eq("is_deleted", false)
      .not("project_match_id", "is", null)
      .not("value", "is", null)
      .or(invoiceFilter);

    if (error) {
      console.warn("accounting sums query failed:", error.message);
      return [];
    }

    const acc = new Map<string, number>();
    for (const row of (data ?? []) as Array<{
      project_match_id: string | null;
      value: number | null;
    }>) {
      if (!row.project_match_id || row.value == null) continue;
      acc.set(
        row.project_match_id,
        (acc.get(row.project_match_id) ?? 0) + row.value
      );
    }
    return Array.from(acc.entries());
  },
  ["hero_accounting_sums"],
  { revalidate: DATA_CACHE_TTL_S, tags: ["hero_customer_documents"] }
);

const loadAccountingSumsByProjectId = cache(
  async (): Promise<Map<string, number>> => {
    const pairs = await fetchAccountingSumPairs();
    return new Map(pairs);
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
