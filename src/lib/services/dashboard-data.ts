import { KPIData } from "@/components/dashboard/dashboard-cards";
import { HistoricDataPoint } from "@/components/dashboard/dashboard-charts";
import { getLatestKPIs, getHistoricKPIs } from "@/lib/supabase/dashboard-queries";

export type Department = "GESAMT" | "PV" | "WP" | "HAUSTECHNIK";

const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ---------------------------------------------------------------------------
// Mock data (used when Supabase is not yet configured)
// ---------------------------------------------------------------------------

function getMockKPIs(department: Department): KPIData {
  const m = { GESAMT: 1, PV: 0.5, WP: 0.3, HAUSTECHNIK: 0.2 }[department];
  return {
    activeProjects: Math.floor(124 * m),
    completedProjectsWeek: Math.floor(15 * m),
    accountingTransferredCount: Math.floor(12 * m),
    accountingTransferredAmount: Math.floor(185000 * m),
    openReworks: Math.floor(28 * m),
    scheduledReworks: Math.floor(14 * m),
    openCustomerCommitments: Math.floor(35 * m),
    scheduledClosings: Math.floor(8 * m),
  };
}

function getMockHistoric(department: Department): HistoricDataPoint[] {
  const m = { GESAMT: 1, PV: 0.5, WP: 0.3, HAUSTECHNIK: 0.2 }[department];
  const result: HistoricDataPoint[] = [];
  const today = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i * 7);
    const rf = 0.8 + Math.random() * 0.4;
    result.push({
      date: `KW ${getWeekNumber(d)}`,
      active: Math.floor(120 * m * rf),
      completed: Math.floor(12 * m * rf),
      accounting: Math.floor(10 * m * rf),
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getKPIData(department: Department): Promise<KPIData> {
  if (SUPABASE_CONFIGURED) {
    try {
      const data = await getLatestKPIs(department);
      if (data) return data;
      // No snapshot yet → fall through to mocks
    } catch (err) {
      console.warn("[dashboard-data] Supabase unavailable, using mocks:", err);
    }
  }
  // Simulate async for UX consistency
  await new Promise((r) => setTimeout(r, 200));
  return getMockKPIs(department);
}

export async function getHistoricData(
  department: Department
): Promise<HistoricDataPoint[]> {
  if (SUPABASE_CONFIGURED) {
    try {
      const data = await getHistoricKPIs(department);
      if (data.length > 0) return data;
    } catch (err) {
      console.warn("[dashboard-data] Supabase unavailable, using mocks:", err);
    }
  }
  await new Promise((r) => setTimeout(r, 150));
  return getMockHistoric(department);
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
}
