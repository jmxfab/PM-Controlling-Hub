import { Suspense } from "react";
import type { Metadata } from "next";

import { DashboardInitialLoader } from "@/components/dashboard/dashboard-initial-loader";
import { InsightsView } from "@/components/dashboard/insights-view";
import {
  loadWeeklyThroughput,
  loadStepDurations,
  loadLongestRunning,
  type InsightsRange,
} from "@/lib/supabase/hero-insights-queries";
import {
  DASHBOARD_DEPARTMENTS,
  DASHBOARD_DEPARTMENT_NAMES,
  type Department,
  parseDashboardDepartmentParam,
} from "@/lib/dashboard/dashboard-types";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  parseDashboardTimeframe,
  getDashboardTimeframeLabel,
  getDashboardTimeframeRange,
  type DashboardTimeframe,
} from "@/lib/dashboard/dashboard-timeframe";

export const metadata: Metadata = {
  title: "Insights",
  description:
    "Analytics: wöchentliche Flow-Raten, Step-Durchlaufzeiten und älteste offene Projekte.",
};

export const revalidate = 60;

interface InsightsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function InsightsPage({
  searchParams,
}: InsightsPageProps) {
  const resolved = (await searchParams) ?? {};
  const department = parseDashboardDepartmentParam(resolved.department);
  const timeframe = parseDashboardTimeframe(resolved);

  const tabContents = Object.fromEntries(
    DASHBOARD_DEPARTMENTS.map((dept) => [
      dept,
      dept === department ? (
        <Suspense
          key={`${department}-${timeframe.mode}-${timeframe.from ?? ""}-${timeframe.to ?? ""}`}
          fallback={<DashboardInitialLoader />}
        >
          <InsightsTab department={department} timeframe={timeframe} />
        </Suspense>
      ) : (
        <div className="text-sm text-muted-foreground py-8 text-center">
          Wechsel zu {DASHBOARD_DEPARTMENT_NAMES[dept]} lädt die Daten neu …
        </div>
      ),
    ])
  ) as Record<Department, React.ReactNode>;

  return (
    <div className="flex-1 space-y-4 p-8 pt-6 max-w-[1200px] mx-auto min-h-screen">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Insights</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Flow-Raten, Durchlaufzeiten und Bottleneck-Ansichten für{" "}
          <span className="font-medium">
            {DASHBOARD_DEPARTMENT_NAMES[department]}
          </span>{" "}
          — Zeitraum:{" "}
          <span className="font-medium">
            {getDashboardTimeframeLabel(timeframe)}
          </span>
        </p>
      </div>

      <DashboardShell
        department={department}
        departments={DASHBOARD_DEPARTMENTS}
        tabContents={tabContents}
        timeframe={timeframe}
      />
    </div>
  );
}

async function InsightsTab({
  department,
  timeframe,
}: {
  department: Department;
  timeframe: DashboardTimeframe;
}) {
  const range = buildInsightsRange(timeframe);
  const [weekly, stepDurations, longestRunning] = await Promise.all([
    loadWeeklyThroughput(department, range ? { range } : undefined).catch(
      () => []
    ),
    loadStepDurations(department, range ? { range } : undefined).catch(
      () => []
    ),
    loadLongestRunning(department).catch(() => []),
  ]);

  return (
    <InsightsView
      department={department}
      weekly={weekly}
      stepDurations={stepDurations}
      longestRunning={longestRunning}
      timeframeLabel={getDashboardTimeframeLabel(timeframe)}
    />
  );
}

function buildInsightsRange(
  timeframe: DashboardTimeframe
): InsightsRange | undefined {
  if (timeframe.mode === "current") return undefined;
  const range = getDashboardTimeframeRange(timeframe);
  if (!range) return undefined;
  return {
    fromIso: `${range.from}T00:00:00+02:00`,
    toIso: `${addOneDay(range.to)}T00:00:00+02:00`,
  };
}

function addOneDay(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
