import { Suspense } from "react";
import type { Metadata } from "next";

import { DashboardInitialLoader } from "@/components/dashboard/dashboard-initial-loader";
import { InsightsView } from "@/components/dashboard/insights-view";
import { HeroPipelinePanel } from "@/components/dashboard/hero-pipeline-panel";
import {
  loadWeeklyThroughput,
  loadDailyThroughput,
  loadStepDurations,
  loadLongestRunning,
  loadDurationMetrics,
  loadKwpStats,
  type InsightsRange,
} from "@/lib/supabase/hero-insights-queries";
import {
  loadHeroPipeline,
  type TimeframeRangeIso,
} from "@/lib/supabase/hero-pipeline-queries";
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
  const heroProjectLinkTemplate = process.env.HERO_PROJECT_URL_TEMPLATE ?? null;

  const suspenseKey = `${department}-${timeframe.mode}-${timeframe.from ?? ""}-${timeframe.to ?? ""}`;

  const tabContents = Object.fromEntries(
    DASHBOARD_DEPARTMENTS.map((dept) => [
      dept,
      dept === department ? (
        <Suspense
          key={suspenseKey}
          fallback={<DashboardInitialLoader />}
        >
          <div className="space-y-6">
            <PipelineTab
              department={department}
              timeframe={timeframe}
              heroProjectLinkTemplate={heroProjectLinkTemplate}
            />
            <InsightsTab
              department={department}
              timeframe={timeframe}
              heroProjectLinkTemplate={heroProjectLinkTemplate}
            />
          </div>
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
  heroProjectLinkTemplate,
}: {
  department: Department;
  timeframe: DashboardTimeframe;
  heroProjectLinkTemplate: string | null;
}) {
  const range = buildInsightsRange(timeframe);
  // Tagesgranularität bei kurzen Zeiträumen (≤14 Tage), Wochenaggregation
  // bei längeren — sonst wäre die X-Achse z.B. bei "Letzte Woche" leer.
  const useDaily = range
    ? rangeDurationDays(range) <= 14
    : false;

  const [weekly, daily, stepDurations, longestRunning, durationMetrics, kwpStats] =
    await Promise.all([
      useDaily
        ? Promise.resolve([])
        : loadWeeklyThroughput(department, range ? { range } : undefined).catch(
            () => []
          ),
      useDaily && range
        ? loadDailyThroughput(department, range).catch(() => [])
        : Promise.resolve([]),
      loadStepDurations(department, range ? { range } : undefined).catch(
        () => []
      ),
      loadLongestRunning(department).catch(() => []),
      loadDurationMetrics(department, range ? { range } : undefined).catch(
        () => []
      ),
      loadKwpStats(department).catch(() => null),
    ]);

  return (
    <InsightsView
      department={department}
      weekly={weekly}
      daily={daily}
      throughputRange={range ?? null}
      stepDurations={stepDurations}
      longestRunning={longestRunning}
      durationMetrics={durationMetrics}
      kwpStats={kwpStats}
      timeframeLabel={getDashboardTimeframeLabel(timeframe)}
      pipeline={null}
      heroProjectLinkTemplate={heroProjectLinkTemplate}
    />
  );
}

function rangeDurationDays(range: InsightsRange): number {
  const from = new Date(range.fromIso).getTime();
  const to = new Date(range.toIso).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.round((to - from) / (24 * 60 * 60 * 1000));
}

async function PipelineTab({
  department,
  timeframe,
  heroProjectLinkTemplate,
}: {
  department: Department;
  timeframe: DashboardTimeframe;
  heroProjectLinkTemplate: string | null;
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
      heroProjectLinkTemplate={heroProjectLinkTemplate ?? null}
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
  const fromIso = `${range.from}T00:00:00+02:00`;
  const toIso = `${addOneDay(range.to)}T00:00:00+02:00`;
  return {
    fromIso,
    toIso,
    label: `${range.from} → ${range.to}`,
    direction: FUTURE_MODES.has(timeframe.mode) ? "future" : "past",
  };
}

function addOneDay(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
