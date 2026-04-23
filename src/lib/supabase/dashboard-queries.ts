import "server-only";

import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";

const CACHE_TTL_S = 300;
import { KPIData } from "@/components/dashboard/dashboard-cards";
import { HistoricDataPoint } from "@/components/dashboard/dashboard-charts";
import {
  getDashboardTimeframeRange,
  type DashboardTimeframe,
} from "@/lib/dashboard/dashboard-timeframe";
import { type Department } from "@/lib/dashboard/dashboard-types";
import { aggregateSnapshotsByWeek } from "@/lib/supabase/dashboard-historic";

type SupabaseDepartment =
  | "PV"
  | "PV_GEWERBE"
  | "WP"
  | "KLIMA"
  | "GEBAEUDETECHNIK";

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

export interface KpiSnapshot {
  id: string;
  department: SupabaseDepartment | "GESAMT";
  snapshot_date: string;
  active_projects: number;
  completed_projects_week: number;
  accounting_transferred_count: number;
  accounting_transferred_amount: number;
  open_reworks: number;
  scheduled_reworks: number;
  open_customer_commitments: number;
  scheduled_closings: number;
}

/** Upsert a KPI snapshot for a given department and date (called by sync route) */
export async function upsertKpiSnapshot(
  department: SupabaseDepartment | "GESAMT",
  kpis: KPIData,
  date: string = new Date().toISOString().split("T")[0]
): Promise<void> {
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("kpi_snapshots").upsert(
    {
      department,
      snapshot_date: date,
      active_projects: kpis.activeProjects,
      completed_projects_week: kpis.completedProjectsWeek,
      accounting_transferred_count: kpis.accountingTransferredCount,
      accounting_transferred_amount: kpis.accountingTransferredAmount ?? 0,
      open_reworks: kpis.openReworks,
      scheduled_reworks: kpis.scheduledReworks,
      open_customer_commitments: kpis.openCustomerCommitments,
      scheduled_closings: kpis.scheduledClosings,
    },
    { onConflict: "department,snapshot_date" }
  );

  if (error) throw new Error(`Supabase upsert error: ${error.message}`);
}

/** Fetch the latest KPI snapshot for a given department */
async function getLatestKPIsInner(
  department: Department,
  timeframe: DashboardTimeframe
): Promise<KPIData | null> {
  const supabase = supabaseAdmin();
  const timeframeRange = getDashboardTimeframeRange(timeframe);

  let query = supabase
    .from("kpi_snapshots")
    .select("*")
    .eq("department", department)
    .order("snapshot_date", { ascending: false })
    .limit(1);

  if (timeframeRange) {
    query = query
      .gte("snapshot_date", timeframeRange.from)
      .lte("snapshot_date", timeframeRange.to);
  }

  const { data, error } = await query.maybeSingle();

  if (error) throw new Error(`Supabase query error: ${error.message}`);
  if (!data) return null;

  return {
    activeProjects: data.active_projects,
    completedProjectsWeek: data.completed_projects_week,
    accountingTransferredCount: data.accounting_transferred_count,
    accountingTransferredAmount: data.accounting_transferred_amount,
    openReworks: data.open_reworks,
    scheduledReworks: data.scheduled_reworks,
    openCustomerCommitments: data.open_customer_commitments,
    scheduledClosings: data.scheduled_closings,
    bewertungspoolCount: 0,
  };
}

export const getLatestKPIs = (
  department: Department,
  timeframe: DashboardTimeframe
): Promise<KPIData | null> =>
  unstable_cache(
    () => getLatestKPIsInner(department, timeframe),
    [
      "getLatestKPIs",
      department,
      timeframe.mode,
      timeframe.from ?? "",
      timeframe.to ?? "",
    ],
    { revalidate: CACHE_TTL_S, tags: ["historic"] }
  )();

/** Fetch the last 8 weekly snapshots for trend chart */
async function getHistoricKPIsInner(
  department: Department,
  timeframe: DashboardTimeframe
): Promise<HistoricDataPoint[]> {
  const supabase = supabaseAdmin();
  const timeframeRange = getDashboardTimeframeRange(timeframe);

  let query = supabase
    .from("kpi_snapshots")
    .select(
      "snapshot_date, active_projects, completed_projects_week, accounting_transferred_count"
    )
    .eq("department", department)
    .order("snapshot_date", { ascending: false })
    .limit(56);

  if (timeframeRange) {
    query = query
      .gte("snapshot_date", timeframeRange.from)
      .lte("snapshot_date", timeframeRange.to);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Supabase query error: ${error.message}`);
  if (!data) return [];

  return aggregateSnapshotsByWeek(data).slice(-8);
}

export const getHistoricKPIs = (
  department: Department,
  timeframe: DashboardTimeframe
): Promise<HistoricDataPoint[]> =>
  unstable_cache(
    () => getHistoricKPIsInner(department, timeframe),
    [
      "getHistoricKPIs",
      department,
      timeframe.mode,
      timeframe.from ?? "",
      timeframe.to ?? "",
    ],
    { revalidate: CACHE_TTL_S, tags: ["historic"] }
  )();
