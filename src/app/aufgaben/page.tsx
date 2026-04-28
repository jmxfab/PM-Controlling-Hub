import type { Metadata } from "next";
import { loadAufgabenPage, loadAufgabenStats } from "@/lib/supabase/hero-aufgaben-queries";
import { loadHeizlastProjects } from "@/lib/supabase/hero-heizlast-queries";
import { AufgabenView } from "@/components/aufgaben/aufgaben-view";

export const metadata: Metadata = {
  title: "Aufgaben | JMX",
  description: "Hero ERP Benachrichtigungen — Kommentare, Projektzuweisungen, Aufgaben.",
};

export const revalidate = 60;

export default async function AufgabenPage() {
  const heroProjectLinkTemplate = process.env.HERO_PROJECT_URL_TEMPLATE ?? null;
  const [pageResult, stats, heizlastProjects] = await Promise.all([
    loadAufgabenPage({ category: "info" }, 0, 50).catch(() => ({ entries: [], total: 0 })),
    loadAufgabenStats().catch(() => ({ total: 0, unread: 0, aufgaben: 0 })),
    loadHeizlastProjects().catch(() => []),
  ]);

  return (
    <div className="flex-1 space-y-4 p-6 md:p-8 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-xl font-semibold">Aufgaben</h1>
        <p className="text-sm text-muted-foreground">
          Hero ERP Benachrichtigungen — Kommentare, Projektzuweisungen, Aufgaben und Heizlast-Status.
        </p>
      </div>
      <AufgabenView
        initial={{ entries: pageResult.entries, total: pageResult.total, stats }}
        heizlastProjects={heizlastProjects}
        heroProjectLinkTemplate={heroProjectLinkTemplate}
      />
    </div>
  );
}
