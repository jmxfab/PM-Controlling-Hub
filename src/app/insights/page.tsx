import { Suspense } from "react";
import type { Metadata } from "next";

import { DashboardInitialLoader } from "@/components/dashboard/dashboard-initial-loader";
import { InsightsView } from "@/components/dashboard/insights-view";
import {
  loadWeeklyThroughput,
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

  const tabContents = Object.fromEntries(
    DASHBOARD_DEPARTMENTS.map((dept) => [
      dept,
      dept === department ? (
        <Suspense
          key={`${department}-${timeframe.mode}-${timeframe.from ?? ""}-${timeframe.to ?? ""}`}
          fallback={<DashboardInitialLoader />}
        >
          <InsightsTab
            department={department}
            timeframe={timeframe}
            heroProjectLinkTemplate={heroProjectLinkTemplate}
          />
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
  heroProjectLinkTemplate,
}: {
  department: Department;
  timeframe: DashboardTimeframe;
  heroProjectLinkTemplate: string | null;
}) {
  const range = buildInsightsRange(timeframe);
  const pipelineRange = buildPipelineRange(timeframe);
  const [
    weekly,
    stepDurations,
    longestRunning,
    durationMetrics,
    kwpStats,
    pipeline,
  ] = await Promise.all([
    loadWeeklyThroughput(department, range ? { range } : undefined).catch(
      () => []
    ),
    loadStepDurations(department, range ? { range } : undefined).catch(
      () => []
    ),
    loadLongestRunning(department).catch(() => []),
    loadDurationMetrics(department, range ? { range } : undefined).catch(
      () => []
    ),
    loadKwpStats(department).catch(() => null),
    // Operatives Pipeline-Panel: OFFENE STEPS ohne Cash/Rechnungs-Steps.
    loadHeroPipeline(department, pipelineRange, {
      excludeCashSteps: true,
    }).catch(() => null),
  ]);

  return (
    <InsightsView
      department={department}
      weekly={weekly}
      stepDurations={stepDurations}
      longestRunning={longestRunning}
      durationMetrics={durationMetrics}
      kwpStats={kwpStats}
      timeframeLabel={getDashboardTimeframeLabel(timeframe)}
      pipeline={pipeline}
      heroProjectLinkTemplate={heroProjectLinkTemplate}
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
  // Im Jetzt-Modus ohne expliziten Zeitraum: rollende letzte 14 Tage
  // für die Status-Bewegungs-Badges an jedem Step (Blau/Grün/Gelb/Rot).
  // So sehen User im Insights-Panel immer Bewegung pro Step, ohne dass
  // die Snapshot-Zahlen (Alle Offenen, Überfällig, …) dadurch kippen.
  if (timeframe.mode === "current") {
    const now = new Date();
    const to = new Date(now);
    to.setHours(0, 0, 0, 0);
    to.setDate(to.getDate() + 1); // exklusive Ende
    const from = new Date(to);
    from.setDate(from.getDate() - 14);
    return {
      fromIso: from.toISOString(),
      toIso: to.toISOString(),
      label: "Letzte 14 Tage",
      direction: "past",
    };
  }
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
