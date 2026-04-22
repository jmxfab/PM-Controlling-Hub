import { Suspense } from "react";
import type { Metadata } from "next";

import { DashboardInitialLoader } from "@/components/dashboard/dashboard-initial-loader";
import { CashflowView } from "@/components/dashboard/cashflow-view";
import { loadCashflow } from "@/lib/supabase/hero-insights-queries";
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
  title: "Cash",
  description:
    "Offene Rechnungen, Forderungs-Aging, Pipeline-Umsatz und Abrechnungsquote.",
};

export const revalidate = 60;

interface PageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CashPage({ searchParams }: PageProps) {
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
          <CashTab
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
        <h1 className="text-3xl font-bold tracking-tight">Cash</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Offene Rechnungen, Forderungs-Aging und Abrechnungsquote für{" "}
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

async function CashTab({
  department,
  timeframe,
  heroProjectLinkTemplate,
}: {
  department: Department;
  timeframe: DashboardTimeframe;
  heroProjectLinkTemplate: string | null;
}) {
  const pipelineRange = buildPipelineRange(timeframe);
  const [dtoResult, pipelineResult] = await Promise.allSettled([
    loadCashflow(department),
    // Cash-Pipeline-Panel: NUR Abrechnungs-Steps (Abschluss-/Teil-/Kundenrechnung).
    loadHeroPipeline(department, pipelineRange, { onlyCashSteps: true }),
  ]);

  const dto = dtoResult.status === "fulfilled" ? dtoResult.value : null;
  const pipeline =
    pipelineResult.status === "fulfilled" ? pipelineResult.value : null;

  // Wenn beide leer sind → klare Fehlermeldung. Wenn mindestens eines da ist,
  // rendern wir die Seite partiell statt den User auf einen toten Screen zu schicken.
  if (!dto && !pipeline) {
    return (
      <div className="text-sm text-destructive py-8 text-center">
        Fehler beim Laden der Cash-Daten. Bitte Admin prüfen lassen.
      </div>
    );
  }
  return (
    <CashflowView
      department={department}
      dto={dto}
      pipeline={pipeline}
      heroProjectLinkTemplate={heroProjectLinkTemplate}
    />
  );
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
