import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SyncInProgressBanner } from "@/components/dashboard/sync-in-progress-banner";
import { DashboardTabContent } from "@/components/dashboard/dashboard-tab-content";
import { DashboardInitialLoader } from "@/components/dashboard/dashboard-initial-loader";
import { parseDashboardTimeframe } from "@/lib/dashboard/dashboard-timeframe";
import {
  DASHBOARD_DEPARTMENTS,
  type Department,
  parseDashboardDepartmentParam,
} from "@/lib/dashboard/dashboard-types";

export const metadata: Metadata = {
  title: "Controlling | JMX",
  description:
    "Projektcontrolling für PV, PV Gewerbe, Wärmepumpen, Klima und Gebäudetechnik — liest aus der Supabase-Hero-Mirror.",
};

export const revalidate = 30;

interface DashboardPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const department = parseDashboardDepartmentParam(
    resolvedSearchParams.department
  );
  const timeframe = parseDashboardTimeframe(resolvedSearchParams);
  const heroProjectLinkTemplate = process.env.HERO_PROJECT_URL_TEMPLATE ?? null;

  const tabContents = Object.fromEntries(
    DASHBOARD_DEPARTMENTS.map((dept) => [
      dept,
      (
        <Suspense key={dept} fallback={<DashboardInitialLoader />}>
          <DashboardTabContent
            department={dept}
            heroProjectLinkTemplate={heroProjectLinkTemplate}
            timeframe={timeframe}
          />
        </Suspense>
      ),
    ])
  ) as Record<Department, ReactNode>;

  return (
    <div className="flex-1 space-y-6 p-6 md:p-8 max-w-[1600px] mx-auto min-h-screen">
      <Suspense fallback={null}>
        <SyncInProgressBanner />
      </Suspense>

      <header className="relative overflow-hidden rounded-2xl border bg-card/40 backdrop-blur-sm p-6 md:p-8">
        {/* Dezenter Gradient-Akzent rechts */}
        <div
          className="absolute -right-32 -top-32 w-96 h-96 rounded-full blur-3xl opacity-30 bg-gradient-to-br from-blue-400/60 to-violet-400/60 dark:from-blue-600/40 dark:to-violet-600/40 -z-0 pointer-events-none"
          aria-hidden
        />
        <div className="relative space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/60 dark:bg-blue-950/40 text-[11px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300 ring-1 ring-blue-200/50 dark:ring-blue-900/50">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-subtle-glow" />
            Hero Live
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Controlling
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Projektcontrolling für PV, PV Gewerbe, Wärmepumpen, Klima und Gebäudetechnik — Live aus Hero ERP.
          </p>
        </div>
      </header>

      <DashboardShell
        department={department}
        departments={DASHBOARD_DEPARTMENTS}
        tabContents={tabContents}
        timeframe={timeframe}
      />
    </div>
  );
}

