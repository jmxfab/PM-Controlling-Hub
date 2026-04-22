import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";

import { type HeroProject } from "@/lib/hero/hero-client";
import {
  HERO_TYPE_ID_TO_DEPARTMENT,
  type ProjectDepartment,
} from "@/lib/dashboard/dashboard-types";

/**
 * Read-side accessors for the Hero mirror.
 *
 * Dashboard reads now go through the `hero_dashboard_projects` materialized
 * view, which pre-computes department, step info, accounting sums and the
 * is_finished flag. That pushes everything expensive (JSONB extraction,
 * department mapping, invoice aggregation) to Postgres and leaves the Next.js
 * side with a single table scan and cheap row mapping.
 *
 * The view is refreshed after every sync (see scripts/sync/sync-engine.ts
 * `refreshDashboardView` hook) — it is SECURITY DEFINER so the sync job can
 * call it via RPC without needing extra grants.
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

const DATA_CACHE_TTL_S = 60;
const ROW_CHUNK_SIZE = 1000;

interface DashboardProjectRow {
  id: string;
  project_number: string | null;
  project_name: string | null;
  type_id: string | null;
  department_key: ProjectDepartment | null;
  status_name: string | null;
  status_code: number | null;
  step_id: string | null;
  step_name: string | null;
  step_sort_order: number | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  measure_short: string | null;
  measure_name: string | null;
  created_at_hero: string | null;
  hero_modified_at: string | null;
  maturity_date: string | null;
  completion_date: string | null;
  accounting_date: string | null;
  rework_scheduled_date: string | null;
  closing_appointment_date: string | null;
  is_finished: boolean;
  accounting_amount: number | null;
  raw: Record<string, unknown> | null;
}

const fetchDashboardProjectRows = unstable_cache(
  async (): Promise<DashboardProjectRow[]> => {
    const supabase = supabaseAdmin();
    const all: DashboardProjectRow[] = [];
    // Page through the whole view and filter departments in JS — the
    // supabase-js .not("col", "is", null) modifier has not been applying
    // to our materialized view reliably, so we fetch everything (3k rows)
    // and drop the Leads-bucket locally. The view has ~3k rows, so this
    // is cheap.
    for (let offset = 0; ; offset += ROW_CHUNK_SIZE) {
      const { data, error } = await supabase
        .from("hero_dashboard_projects")
        .select("*")
        .order("id", { ascending: true })
        .range(offset, offset + ROW_CHUNK_SIZE - 1);

      if (error) {
        throw new Error(`hero_dashboard_projects read failed: ${error.message}`);
      }
      const rows = (data ?? []) as DashboardProjectRow[];
      all.push(...rows);
      if (rows.length < ROW_CHUNK_SIZE) break;
    }
    return all.filter((row) => row.department_key != null);
  },
  ["hero_dashboard_projects_v2"],
  { revalidate: DATA_CACHE_TTL_S, tags: ["hero_dashboard_projects"] }
);

function toHeroProject(row: DashboardProjectRow): HeroProject {
  const raw = (row.raw ?? {}) as Record<string, unknown>;
  const customer = (raw.customer ?? null) as HeroProject["customer"];
  const contact = (raw.contact ?? null) as HeroProject["contact"];
  const address = (raw.address ?? null) as HeroProject["address"];
  const projectMatchStatuses =
    (raw.project_match_statuses as HeroProject["project_match_statuses"]) ?? [];

  return {
    id: row.id,
    project_number: row.project_number,
    name: row.project_name,
    status: row.status_name,
    project_type: typeof raw.project_type === "string" ? raw.project_type : null,
    type_id: row.type_id,
    department: row.department_key,
    step_id: row.step_id,
    step_name: row.step_name,
    step_sort_order: row.step_sort_order,
    measure_short: row.measure_short,
    measure_name: row.measure_name,
    created_at: row.created_at_hero,
    modified_at: row.hero_modified_at,
    maturity_date: row.maturity_date,
    customer,
    contact,
    address,
    customer_documents: [],
    customerDocuments: [],
    project_match_statuses: projectMatchStatuses,
    customer_name: row.customer_name,
    customer_contact_name: null,
    customer_phone: row.customer_phone,
    customer_email: row.customer_email,
    customer_address: row.customer_address,
    customerName: row.customer_name,
    customerContactName: null,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    customerAddress: row.customer_address,
    completion_date: row.completion_date,
    accounting_date: row.accounting_date,
    accounting_amount: row.accounting_amount ?? null,
    rework_status: null,
    rework_scheduled_date: row.rework_scheduled_date,
    customer_commitment_status: null,
    closing_appointment_date: row.closing_appointment_date,
  };
}

export const loadHeroProjectsFromSupabase = cache(
  async (): Promise<HeroProject[]> => {
    const rows = await fetchDashboardProjectRows();
    return rows.map(toHeroProject);
  }
);

export const getHeroProjectsCount = cache(async (): Promise<number> => {
  const rows = await fetchDashboardProjectRows();
  return rows.length;
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

// Re-export the mapping constant for any legacy caller that still wants it.
export { HERO_TYPE_ID_TO_DEPARTMENT };
