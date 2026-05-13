import type { Metadata } from "next";
import {
  loadLogbuchPage,
  loadLogbuchAggregations,
} from "@/lib/supabase/hero-logbuch-queries";
import { LogbuchView } from "@/components/logbuch/logbuch-view";

export const metadata: Metadata = {
  title: "Logbuch",
  description: "Aktivitäts-Auswertung des Hero ERP Ereignisprotokolls.",
};

export const revalidate = 60;

export default async function LogbuchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const projectId = params.project_id ?? undefined;
  const filters = { projectId };

  const [pageResult, aggregations] = await Promise.all([
    loadLogbuchPage(filters, 0, 100).catch(() => ({ entries: [], total: 0 })),
    loadLogbuchAggregations(filters).catch(() => ({
      byUser: [],
      byProject: [],
      byEventType: [],
    })),
  ]);

  return (
    <div className="flex-1 space-y-6 p-6 md:p-8 max-w-[1600px] mx-auto">
      <header className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Logbuch
        </h1>
        <p className="text-sm text-muted-foreground">
          Aktivitätsprotokoll aus Hero ERP — gefiltert nach Mitarbeiter, Projekt und Zeitraum
        </p>
      </header>
      <LogbuchView
        initial={{
          entries: pageResult.entries,
          total: pageResult.total,
          aggregations,
        }}
        initialFilters={projectId ? { projectId } : undefined}
      />
    </div>
  );
}
