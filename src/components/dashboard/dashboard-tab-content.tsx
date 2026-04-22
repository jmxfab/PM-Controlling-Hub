import { DashboardCharts } from "./dashboard-charts";
import { DashboardKpiDialog } from "./dashboard-kpi-dialog";
import { DashboardProjectList } from "./dashboard-project-list";
import { HeroPipelinePanel } from "./hero-pipeline-panel";
import { getDashboardTabData } from "@/lib/services/dashboard-data";
import {
  getDashboardTimeframeLabel,
  getDashboardHistoricDescription,
  type DashboardTimeframe,
} from "@/lib/dashboard/dashboard-timeframe";
import {
  DASHBOARD_DEPARTMENT_NAMES,
  type Department,
} from "@/lib/dashboard/dashboard-types";
import {
  loadHeroPipeline,
  type TimeframeRangeIso,
} from "@/lib/supabase/hero-pipeline-queries";
import { getDashboardTimeframeRange } from "@/lib/dashboard/dashboard-timeframe";

export async function DashboardTabContent({
  department,
  heroProjectLinkTemplate,
  timeframe,
}: {
  department: Department;
  heroProjectLinkTemplate: string | null;
  timeframe: DashboardTimeframe;
}) {
  // Zeitraum für Deltas berechnen (bei "current" kein Zeitraum-Delta)
  const rangeIso = buildTimeframeRangeIso(timeframe);
  const [tabData, pipeline] = await Promise.all([
    getDashboardTabData(department, timeframe),
    // Dashboard-Pipeline zeigt NUR operative Steps. Die Abrechnungs-Steps
    // (Abschlussrechnung / Teil-RG / Kundenrechnung) leben im /cashflow-Tab.
    loadHeroPipeline(department, rangeIso, { excludeCashSteps: true }).catch(
      () => null
    ),
  ]);
  const {
    kpiData,
    historicData,
    projectList,
    kpiProjectGroups,
    notice,
    source,
  } = tabData;

  const departmentName = DASHBOARD_DEPARTMENT_NAMES[department];
  const snapshotContextLabel =
    timeframe.mode === "current"
      ? "aktuellen Hero-Stand"
      : `Zeitraum ${getDashboardTimeframeLabel(timeframe)}`;
  const historicDescription = getDashboardHistoricDescription(timeframe);
  const emptyHistoricMessage =
    timeframe.mode === "current"
      ? "Noch keine historischen Daten vorhanden."
      : "Im gewählten Zeitraum liegen noch keine historischen Daten vor.";
  const statusNotice = notice ?? getDashboardStatusNotice(source);

  return (
    <div className="space-y-4">
      {statusNotice ? (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          {statusNotice}
        </div>
      ) : null}
      <DashboardKpiDialog
        data={kpiData}
        departmentName={departmentName}
        snapshotContextLabel={snapshotContextLabel}
        heroProjectLinkTemplate={heroProjectLinkTemplate}
        kpiProjectGroups={kpiProjectGroups}
        source={source}
        timeframe={timeframe}
      />
      {historicData.length > 0 ? (
        <DashboardCharts
          historicData={historicData}
          historicDescription={historicDescription}
          departmentName={departmentName}
          emptyMessage={emptyHistoricMessage}
        />
      ) : null}
      {pipeline ? (
        <HeroPipelinePanel department={department} pipeline={pipeline} />
      ) : null}
      <DashboardProjectList
        departmentName={departmentName}
        heroProjectLinkTemplate={heroProjectLinkTemplate}
        projects={projectList}
        source={source}
        timeframe={timeframe}
      />
    </div>
  );
}

function getDashboardStatusNotice(
  source: "hero" | "empty"
): string | null {
  if (source === "empty") {
    return "Für den gewählten Zeitraum wurden keine Projekte gefunden.";
  }

  return null;
}

const FUTURE_MODES = new Set<DashboardTimeframe["mode"]>(["morgen", "next3d", "next7d", "30d"]);

function buildTimeframeRangeIso(
  timeframe: DashboardTimeframe
): TimeframeRangeIso | undefined {
  if (timeframe.mode === "current") return undefined;
  const range = getDashboardTimeframeRange(timeframe);
  if (!range) return undefined;
  const fromIso = `${range.from}T00:00:00+02:00`;
  const nextDay = addDaysIso(range.to, 1);
  const toIso = `${nextDay}T00:00:00+02:00`;
  return {
    fromIso,
    toIso,
    label: `${range.from} → ${range.to}`,
    direction: FUTURE_MODES.has(timeframe.mode) ? "future" : "past",
  };
}

function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
