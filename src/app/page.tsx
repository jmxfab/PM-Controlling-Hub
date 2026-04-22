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
  title: "Controlling Dashboard | JMX",
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
        <Suspense fallback={<DashboardInitialLoader />}>
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
    <div className="flex-1 space-y-4 p-8 pt-6 max-w-[1200px] mx-auto min-h-screen">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Controlling Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Operativer Überblick über Projekte, Status, Dokumente und Verlauf.
        </p>
      </div>

      <Suspense fallback={null}>
        <SyncInProgressBanner />
      </Suspense>

      <DashboardShell
        department={department}
        departments={DASHBOARD_DEPARTMENTS}
        tabContents={tabContents}
        timeframe={timeframe}
      />
    </div>
  );
}

