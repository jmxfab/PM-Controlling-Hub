import { Suspense } from "react";
import type { Metadata } from "next";

import { DashboardInitialLoader } from "@/components/dashboard/dashboard-initial-loader";
import { InsightsView } from "@/components/dashboard/insights-view";
import {
  loadWeeklyThroughput,
  loadStepDurations,
  loadLongestRunning,
} from "@/lib/supabase/hero-insights-queries";
import {
  DASHBOARD_DEPARTMENTS,
  type Department,
  parseDashboardDepartmentParam,
} from "@/lib/dashboard/dashboard-types";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { parseDashboardTimeframe } from "@/lib/dashboard/dashboard-timeframe";

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
      (
        <Suspense fallback={<DashboardInitialLoader />}>
          <InsightsTab department={dept} />
        </Suspense>
      ),
    ])
  ) as Record<Department, React.ReactNode>;

  return (
    <div className="flex-1 space-y-4 p-8 pt-6 max-w-[1200px] mx-auto min-h-screen">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Insights</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Flow-Raten, Durchlaufzeiten und Bottleneck-Ansichten auf Basis der
          Hero-Statushistorie.
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

async function InsightsTab({ department }: { department: Department }) {
  const [weekly, stepDurations, longestRunning] = await Promise.all([
    loadWeeklyThroughput(department).catch(() => []),
    loadStepDurations(department).catch(() => []),
    loadLongestRunning(department).catch(() => []),
  ]);

  return (
    <InsightsView
      department={department}
      weekly={weekly}
      stepDurations={stepDurations}
      longestRunning={longestRunning}
    />
  );
}
