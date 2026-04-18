import "server-only";

import { KPIData } from "@/components/dashboard/dashboard-cards";
import { HistoricDataPoint } from "@/components/dashboard/dashboard-charts";
import { type DashboardTimeframe } from "@/lib/dashboard/dashboard-timeframe";
import { type DashboardProjectListItem, type Department } from "@/lib/dashboard/dashboard-types";
import { buildHeroSampleDashboardData } from "@/lib/hero/hero-sample-data";

const HERO_SAMPLE_MODE_NOTICE =
  "Hero Live-Daten sind vorübergehend pausiert. Bis die offizielle REST/OpenAPI-Integration umgesetzt ist, nutzt das Dashboard bewusst Hero-Beispieldaten.";

const EMPTY_KPIS: KPIData = {
  activeProjects: 0,
  completedProjectsWeek: 0,
  accountingTransferredCount: 0,
  accountingTransferredAmount: 0,
  openReworks: 0,
  scheduledReworks: 0,
  openCustomerCommitments: 0,
  scheduledClosings: 0,
};

export interface DashboardTabData {
  kpiData: KPIData;
  historicData: HistoricDataPoint[];
  projectList: DashboardProjectListItem[];
  source: "hero" | "sample" | "empty";
  notice?: string;
  projectListNotice?: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getDashboardTabData(
  department: Department,
  timeframe: DashboardTimeframe
): Promise<DashboardTabData> {
  return getFallbackData(department, timeframe, HERO_SAMPLE_MODE_NOTICE);
}

function getFallbackData(
  department: Department,
  timeframe: DashboardTimeframe,
  reason: string
): DashboardTabData {
  const sampleData = buildHeroSampleDashboardData(department, timeframe);

  if (!sampleData.hasDataInRange) {
    return {
      kpiData: EMPTY_KPIS,
      historicData: [],
      projectList: [],
      source: "sample",
      notice: `${reason} Für den gewählten Zeitraum sind in den Hero-Beispieldaten keine Snapshots vorhanden.`,
      projectListNotice:
        "Im gewählten Zeitraum wurden keine Beispielprojekte gefunden.",
    };
  }

  return {
    kpiData: sampleData.kpiData,
    historicData: sampleData.historicData,
    projectList: sampleData.projectList,
    source: "sample",
    notice: `${reason} Es werden Hero-Beispieldaten angezeigt, bis ein read-only Hero-Zugriff verfügbar ist.`,
  };
}
