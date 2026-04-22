import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { HeroAdminPanel } from "@/components/dashboard/hero-admin-panel";
import { SyncButton } from "@/components/dashboard/sync-button";
import { DashboardTabContent } from "@/components/dashboard/dashboard-tab-content";
import { parseDashboardTimeframe } from "@/lib/dashboard/dashboard-timeframe";
import {
  DASHBOARD_DEPARTMENTS,
  type Department,
  parseDashboardDepartmentParam,
} from "@/lib/dashboard/dashboard-types";
import { getHeroApiKeyStatus } from "@/lib/settings/hero-settings";

export const metadata: Metadata = {
  title: "Controlling Dashboard | JMX",
  description:
    "Projektcontrolling für PV, Wärmepumpen und Haustechnik mit Live-Lesezugriff auf Hero und sicherem Sample-Fallback",
};

export const dynamic = "force-dynamic";

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
  const heroApiKeyStatus = await getHeroApiKeyStatus().catch(() => ({
    configured: Boolean(process.env.HERO_API_KEY?.trim()),
    maskedKey: null,
    source: "none" as const,
    updatedAt: null,
    supabaseConfigured: false,
  }));
  const liveHeroAvailable = heroApiKeyStatus.configured;
  const liveHeroDisabledReason = liveHeroAvailable
    ? undefined
    : "Live-Hero-Daten können erst geladen werden, wenn ein Hero API Key hinterlegt ist.";

  const tabContents = {
    GESAMT: (
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardTabContent
          department="GESAMT"
          heroProjectLinkTemplate={heroProjectLinkTemplate}
          timeframe={timeframe}
        />
      </Suspense>
    ),
    PV: (
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardTabContent
          department="PV"
          heroProjectLinkTemplate={heroProjectLinkTemplate}
          timeframe={timeframe}
        />
      </Suspense>
    ),
    WP: (
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardTabContent
          department="WP"
          heroProjectLinkTemplate={heroProjectLinkTemplate}
          timeframe={timeframe}
        />
      </Suspense>
    ),
    HAUSTECHNIK: (
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardTabContent
          department="HAUSTECHNIK"
          heroProjectLinkTemplate={heroProjectLinkTemplate}
          timeframe={timeframe}
        />
      </Suspense>
    ),
  } satisfies Record<Department, ReactNode>;

  return (
    <div className="flex-1 space-y-4 p-8 pt-6 max-w-[1200px] mx-auto min-h-screen">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Controlling Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Operativer Überblick über Projekte, Status, Dokumente und Verlauf.
          </p>
        </div>
        <SyncButton
          liveHeroAvailable={liveHeroAvailable}
          disabledReason={liveHeroDisabledReason}
        />
      </div>

      <HeroAdminPanel
        heroReadOnlyConfigured={heroApiKeyStatus.configured}
        heroProjectLinkTemplateConfigured={Boolean(heroProjectLinkTemplate)}
        initialStatus={heroApiKeyStatus}
      />

      <DashboardShell
        department={department}
        departments={DASHBOARD_DEPARTMENTS}
        tabContents={tabContents}
        timeframe={timeframe}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4 mt-6 animate-pulse">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="h-32 rounded-xl bg-muted/60" />
        ))}
      </div>
      <div className="h-[400px] rounded-xl bg-muted/60 mt-6" />
      <div className="h-[320px] rounded-xl bg-muted/60 mt-6" />
    </div>
  );
}
