import type { Metadata } from "next";
import { loadHeizlastProjects } from "@/lib/supabase/hero-heizlast-queries";
import { loadMailTaskCounts } from "@/lib/supabase/mail-tasks-queries";
import { AufgabenView } from "@/components/aufgaben/aufgaben-view";

export const metadata: Metadata = {
  title: "Aufgaben | JMX",
  description: "E-Mail-Aufgaben (n8n + Claude), Hero-Kommentare und Heizlast.",
};

export const revalidate = 60;

export default async function AufgabenPage() {
  const heroProjectLinkTemplate = process.env.HERO_PROJECT_URL_TEMPLATE ?? null;
  const [heizlastProjects, counts] = await Promise.all([
    loadHeizlastProjects().catch(() => []),
    loadMailTaskCounts().catch(() => ({ kritisch: 0, aufgaben: 0, infos: 0, inbox: 0 })),
  ]);

  return (
    <div className="flex-1 space-y-4 p-6 md:p-8 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-xl font-semibold">Aufgaben</h1>
        <p className="text-sm text-muted-foreground">
          E-Mail-Aufgaben (n8n + Claude), Hero-Kommentare und Heizlast.
        </p>
      </div>
      <AufgabenView
        heizlastProjects={heizlastProjects}
        heroProjectLinkTemplate={heroProjectLinkTemplate}
        initialAufgaben={{ entries: [], total: 0 }}
        counts={counts}
      />
    </div>
  );
}
