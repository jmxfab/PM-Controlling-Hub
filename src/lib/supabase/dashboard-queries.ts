import { createClient } from "@supabase/supabase-js";
import { KPIData } from "@/components/dashboard/dashboard-cards";
import { HistoricDataPoint } from "@/components/dashboard/dashboard-charts";
import { Department } from "@/lib/services/dashboard-data";

type SupabaseDepartment = "PV" | "WP" | "HAUSTECHNIK";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, key);
}

function supabasePublic() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
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
export async function getLatestKPIs(department: Department): Promise<KPIData | null> {
  const supabase = supabasePublic();
  const { data, error } = await supabase
    .from("kpi_snapshots")
    .select("*")
    .eq("department", department)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();

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
  };
}

/** Fetch the last 8 weekly snapshots for trend chart */
export async function getHistoricKPIs(
  department: Department
): Promise<HistoricDataPoint[]> {
  const supabase = supabasePublic();
  const { data, error } = await supabase
    .from("kpi_snapshots")
    .select(
      "snapshot_date, active_projects, completed_projects_week, accounting_transferred_count"
    )
    .eq("department", department)
    .order("snapshot_date", { ascending: false })
    .limit(8);

  if (error) throw new Error(`Supabase query error: ${error.message}`);
  if (!data) return [];

  // Reverse so oldest is leftmost on chart
  return data.reverse().map((row) => ({
    date: formatDateLabel(row.snapshot_date),
    active: row.active_projects,
    completed: row.completed_projects_week,
    accounting: row.accounting_transferred_count,
  }));
}

function formatDateLabel(isoDate: string): string {
  const d = new Date(isoDate);
  const weekNum = getWeekNumber(d);
  return `KW ${weekNum}`;
}

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
