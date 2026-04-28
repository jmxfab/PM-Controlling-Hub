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

export default async function LogbuchPage() {
  const [pageResult, aggregations] = await Promise.all([
    loadLogbuchPage({}, 0, 100).catch(() => ({ entries: [], total: 0 })),
    loadLogbuchAggregations({}).catch(() => ({
      byUser: [],
      byProject: [],
      byEventType: [],
    })),
  ]);

  return (
    <div className="flex-1 space-y-4 p-6 md:p-8 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-xl font-semibold">Logbuch</h1>
        <p className="text-sm text-muted-foreground">
          Aktivitätsprotokoll aus Hero ERP — gefiltert nach Mitarbeiter,
          Projekt und Zeitraum.
        </p>
      </div>
      <LogbuchView
        initial={{
          entries: pageResult.entries,
          total: pageResult.total,
          aggregations,
        }}
      />
    </div>
  );
}
