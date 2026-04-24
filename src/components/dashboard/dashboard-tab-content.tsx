import { Suspense } from "react";
import { DashboardCharts } from "./dashboard-charts";
import { DashboardInitialLoader } from "./dashboard-initial-loader";
import { DashboardKpiDialog } from "./dashboard-kpi-dialog";
import { DashboardPeriodKpiCards } from "./dashboard-period-kpi-cards";
import { DashboardProjectList } from "./dashboard-project-list";
import { HeroPipelinePanel } from "./hero-pipeline-panel";
import { getDashboardTabData } from "@/lib/services/dashboard-data";
import {
  getDashboardTimeframeLabel,
  getDashboardHistoricDescription,
  getDashboardTimeframeRange,
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

const FUTURE_MODES = new Set<DashboardTimeframe["mode"]>([
  "morgen",
  "next3d",
  "next7d",
  "30d",
]);

function buildPipelineRange(
  timeframe: DashboardTimeframe
): TimeframeRangeIso | undefined {
  if (timeframe.mode === "current") return undefined;
  const range = getDashboardTimeframeRange(timeframe);
  if (!range) return undefined;
  return {
    fromIso: `${range.from}T00:00:00+02:00`,
    toIso: `${addOneDay(range.to)}T00:00:00+02:00`,
    label: `${range.from} → ${range.to}`,
    direction: FUTURE_MODES.has(timeframe.mode) ? "future" : "past",
  };
}

function addOneDay(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function DashboardTabContent({
  department,
  heroProjectLinkTemplate,
  timeframe,
}: {
  department: Department;
  heroProjectLinkTemplate: string | null;
  timeframe: DashboardTimeframe;
}) {
  const suspenseKey = `${department}-${timeframe.mode}-${timeframe.from ?? ""}-${timeframe.to ?? ""}`;
  // Ein gemeinsamer Suspense-Boundary → genau ein Full-Screen-Overlay
  // solange irgendwas auf der Seite streamt, keine Section-Skeletons.
  return (
    <div className="space-y-4">
      <Suspense key={suspenseKey} fallback={<DashboardInitialLoader />}>
        <DashboardMainSection
          department={department}
          heroProjectLinkTemplate={heroProjectLinkTemplate}
          timeframe={timeframe}
        />
      </Suspense>
    </div>
  );
}

async function DashboardMainSection({
  department,
  heroProjectLinkTemplate,
  timeframe,
}: {
  department: Department;
  heroProjectLinkTemplate: string | null;
  timeframe: DashboardTimeframe;
}) {
  const pipelineRange = buildPipelineRange(timeframe);
  const [tabData, pipeline] = await Promise.all([
    getDashboardTabData(department, timeframe),
    loadHeroPipeline(department, pipelineRange, {
      excludeCashSteps: true,
    }).catch(() => null),
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
  const timeframeLabel = getDashboardTimeframeLabel(timeframe);
  const periodDelta = pipeline?.timeframeDelta ?? null;

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
      {pipelineRange && periodDelta ? (
        <DashboardPeriodKpiCards
          department={department}
          range={pipelineRange}
          timeframeLabel={timeframeLabel}
          counts={{
            newProjects: periodDelta.newProjects,
            completedTransitions: periodDelta.completedTransitions,
            reopenedTransitions: periodDelta.reopenedTransitions,
          }}
          heroProjectLinkTemplate={heroProjectLinkTemplate}
        />
      ) : null}
      {historicData.length > 0 ? (
        <DashboardCharts
          historicData={historicData}
          historicDescription={historicDescription}
          departmentName={departmentName}
          emptyMessage={emptyHistoricMessage}
        />
      ) : null}
      <DashboardProjectList
        departmentName={departmentName}
        heroProjectLinkTemplate={heroProjectLinkTemplate}
        projects={projectList}
        source={source}
        timeframe={timeframe}
      />
      {pipeline ? (
        <HeroPipelinePanel
          department={department}
          pipeline={pipeline}
          heroProjectLinkTemplate={heroProjectLinkTemplate}
        />
      ) : null}
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
