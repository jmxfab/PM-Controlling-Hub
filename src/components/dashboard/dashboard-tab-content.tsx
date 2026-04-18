import { DashboardCharts } from "./dashboard-charts";
import { DashboardKpiDialog } from "./dashboard-kpi-dialog";
import { DashboardProjectList } from "./dashboard-project-list";
import { getDashboardTabData } from "@/lib/services/dashboard-data";
import {
  getDashboardTimeframeLabel,
  getDashboardHistoricDescription,
  getDashboardSnapshotContextLabel,
  type DashboardTimeframe,
} from "@/lib/dashboard/dashboard-timeframe";
import {
  DASHBOARD_DEPARTMENT_NAMES,
  type Department,
} from "@/lib/dashboard/dashboard-types";

export async function DashboardTabContent({
  department,
  heroProjectLinkTemplate,
  timeframe,
}: {
  department: Department;
  heroProjectLinkTemplate: string | null;
  timeframe: DashboardTimeframe;
}) {
  const {
    kpiData,
    historicData,
    projectList,
    kpiProjectGroups,
    notice,
    source,
  } = await getDashboardTabData(department, timeframe);

  const departmentName = DASHBOARD_DEPARTMENT_NAMES[department];
  const snapshotContextLabel =
    source === "hero"
      ? timeframe.mode === "current"
        ? "aktuellen Hero-Stand"
        : `Zeitraum ${getDashboardTimeframeLabel(timeframe)}`
      : getDashboardSnapshotContextLabel(timeframe);
  const historicDescription = getDashboardHistoricDescription(timeframe);
  const emptyHistoricMessage =
    source === "hero"
      ? "Für Live-Hero-Lesungen sind aktuell keine historischen Verlaufssnapshots verfügbar."
      : timeframe.mode === "current"
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
      <DashboardCharts
        historicData={historicData}
        historicDescription={historicDescription}
        departmentName={departmentName}
        emptyMessage={emptyHistoricMessage}
      />
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
  source: "hero" | "sample" | "empty"
): string | null {
  if (source === "sample") {
    return "Hero Live-Daten sind aktuell nicht verfügbar. Das Dashboard zeigt automatisch Hero-Beispieldaten als Fallback.";
  }

  if (source === "empty") {
    return "Für den gewählten Zeitraum wurden keine Projekte gefunden.";
  }

  return null;
}
