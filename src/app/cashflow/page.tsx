import { Suspense } from "react";
import type { Metadata } from "next";

import { DashboardInitialLoader } from "@/components/dashboard/dashboard-initial-loader";
import { CashflowView } from "@/components/dashboard/cashflow-view";
import { loadCashflow } from "@/lib/supabase/hero-insights-queries";
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
} from "@/lib/dashboard/dashboard-timeframe";

export const metadata: Metadata = {
  title: "Cashflow",
  description:
    "Forderungs-Aging, Pipeline-Umsatz, Abrechnungsquote und Umsatz pro Sparte.",
};

export const revalidate = 60;

interface PageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CashflowPage({ searchParams }: PageProps) {
  const resolved = (await searchParams) ?? {};
  const department = parseDashboardDepartmentParam(resolved.department);
  const timeframe = parseDashboardTimeframe(resolved);

  const tabContents = Object.fromEntries(
    DASHBOARD_DEPARTMENTS.map((dept) => [
      dept,
      dept === department ? (
        <Suspense
          key={department}
          fallback={<DashboardInitialLoader />}
        >
          <CashflowTab department={department} />
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
        <h1 className="text-3xl font-bold tracking-tight">Cashflow</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Forderungs-Aging, Pipeline-Umsatz und Abrechnungsquote für{" "}
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

async function CashflowTab({ department }: { department: Department }) {
  const dto = await loadCashflow(department).catch(() => null);
  if (!dto) {
    return (
      <div className="text-sm text-destructive py-8 text-center">
        Fehler beim Laden der Cashflow-Daten.
      </div>
    );
  }
  return <CashflowView department={department} dto={dto} />;
}
