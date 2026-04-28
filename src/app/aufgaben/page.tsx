import type { Metadata } from "next";
import { loadAufgabenPage, loadAufgabenStats } from "@/lib/supabase/hero-aufgaben-queries";
import { AufgabenView } from "@/components/aufgaben/aufgaben-view";

export const metadata: Metadata = {
  title: "Aufgaben | JMX",
  description: "Hero ERP Benachrichtigungen — Kommentare, Projektzuweisungen, Aufgaben.",
};

export const revalidate = 60;

export default async function AufgabenPage() {
  const [pageResult, stats] = await Promise.all([
    loadAufgabenPage({}, 0, 50).catch(() => ({ entries: [], total: 0 })),
    loadAufgabenStats().catch(() => ({ total: 0, unread: 0, aufgaben: 0 })),
  ]);

  return (
    <div className="flex-1 space-y-4 p-6 md:p-8 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-xl font-semibold">Aufgaben</h1>
        <p className="text-sm text-muted-foreground">
          Hero ERP Benachrichtigungen — Kommentare, Projektzuweisungen und Aufgaben.
        </p>
      </div>
      <AufgabenView initial={{ entries: pageResult.entries, total: pageResult.total, stats }} />
    </div>
  );
}
