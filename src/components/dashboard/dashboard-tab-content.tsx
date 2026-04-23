import { Suspense } from "react";
import { DashboardCharts } from "./dashboard-charts";
import { DashboardKpiDialog } from "./dashboard-kpi-dialog";
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
  return (
    <div className="space-y-4">
      <Suspense key={`main-${suspenseKey}`} fallback={<DashboardSectionSkeleton rows={4} />}>
        <DashboardMainSection
          department={department}
          heroProjectLinkTemplate={heroProjectLinkTemplate}
          timeframe={timeframe}
        />
      </Suspense>
      <Suspense key={`pipeline-${suspenseKey}`} fallback={<DashboardSectionSkeleton rows={2} />}>
        <DashboardPipelineSection
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
  const tabData = await getDashboardTabData(department, timeframe);
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

async function DashboardPipelineSection({
  department,
  heroProjectLinkTemplate,
  timeframe,
}: {
  department: Department;
  heroProjectLinkTemplate: string | null;
  timeframe: DashboardTimeframe;
}) {
  const pipelineRange = buildPipelineRange(timeframe);
  const pipeline = await loadHeroPipeline(department, pipelineRange, {
    excludeCashSteps: true,
  }).catch(() => null);

  if (!pipeline) return null;

  return (
    <HeroPipelinePanel
      department={department}
      pipeline={pipeline}
      heroProjectLinkTemplate={heroProjectLinkTemplate}
    />
  );
}

function DashboardSectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-24 animate-pulse rounded-lg border bg-muted/30"
        />
      ))}
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
