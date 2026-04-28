import { Suspense } from "react";
import type { Metadata } from "next";

import { DashboardInitialLoader } from "@/components/dashboard/dashboard-initial-loader";
import { DeckungsbeitragView } from "@/components/dashboard/deckungsbeitrag-view";
import { loadDeckungsbeitrag } from "@/lib/supabase/deckungsbeitrag-queries";
import {
  DASHBOARD_DEPARTMENTS,
  DASHBOARD_DEPARTMENT_NAMES,
  type Department,
  parseDashboardDepartmentParam,
} from "@/lib/dashboard/dashboard-types";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { parseDashboardTimeframe } from "@/lib/dashboard/dashboard-timeframe";

export const metadata: Metadata = {
  title: "Deckungsbeitrag",
  description:
    "Umsatz minus Materialkosten je abgeschlossenem Projekt. Kosten werden manuell erfasst.",
};

export const revalidate = 60;

interface PageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DeckungsbeitragPage({ searchParams }: PageProps) {
  const resolved = (await searchParams) ?? {};
  const department = parseDashboardDepartmentParam(resolved.department);
  const timeframe = parseDashboardTimeframe(resolved);
  const heroProjectLinkTemplate = process.env.HERO_PROJECT_URL_TEMPLATE ?? null;

  const tabContents = Object.fromEntries(
    DASHBOARD_DEPARTMENTS.map((dept) => [
      dept,
      dept === department ? (
        <Suspense key={department} fallback={<DashboardInitialLoader />}>
          <DeckungsbeitragTab
            department={department}
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
    <div className="flex-1 space-y-4 p-8 pt-6 max-w-[1600px] mx-auto min-h-screen">
      <DashboardShell
        department={department}
        departments={DASHBOARD_DEPARTMENTS}
        tabContents={tabContents}
        timeframe={timeframe}
      />
    </div>
  );
}

async function DeckungsbeitragTab({
  department,
  heroProjectLinkTemplate,
}: {
  department: Department;
  heroProjectLinkTemplate: string | null;
}) {
  const dto = await loadDeckungsbeitrag(department).catch(() => null);
  if (!dto) {
    return (
      <div className="text-sm text-destructive py-8 text-center">
        Fehler beim Laden der Deckungsbeitrag-Daten.
      </div>
    );
  }
  return (
    <DeckungsbeitragView
      department={department}
      dto={dto}
      heroProjectLinkTemplate={heroProjectLinkTemplate}
    />
  );
}
