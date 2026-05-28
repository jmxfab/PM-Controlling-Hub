import type { Metadata } from "next";
import { loadHeizlastProjects } from "@/lib/supabase/hero-heizlast-queries";
import {
  loadMailTaskCounts,
  loadMailTasksPage,
  heroToMailItem,
  type MailTabFilter,
  type MailTasksPage,
} from "@/lib/supabase/mail-tasks-queries";
import { loadHeroComments } from "@/lib/supabase/hero-comments-queries";
import { AufgabenView } from "@/components/aufgaben/aufgaben-view";
import { NewTaskDialog } from "@/components/aufgaben/new-task-dialog";
import { VoiceTaskDialog } from "@/components/aufgaben/voice-task-dialog";

export const metadata: Metadata = {
  title: "Aufgaben | JMX",
  description: "E-Mail-Aufgaben (n8n + Claude), Hero-Kommentare und Heizlast.",
};

export const revalidate = 60;

/** Server-seitig die Default-Tab-Daten laden (kritisch oder aufgaben) damit
 *  der initial render schon Daten zeigt statt Skeleton. */
async function loadInitialTab(tab: MailTabFilter): Promise<MailTasksPage> {
  try {
    const mailResult = await loadMailTasksPage(tab, 0, 500, { status: "open" });
    if (tab !== "aufgaben" && tab !== "infos") return mailResult;
    // Hero items fuer aufgaben/infos auch mitziehen
    const heroItems = await loadHeroComments(tab, 500).catch(() => []);
    const filteredHero = heroItems
      .map((h) => heroToMailItem(h, tab))
      .filter((i) => i.status !== "done");
    const all = [...mailResult.entries, ...filteredHero];
    all.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    return { entries: all.slice(0, 500), total: all.length };
  } catch {
    return { entries: [], total: 0 };
  }
}

export default async function AufgabenPage() {
  const heroProjectLinkTemplate = process.env.HERO_PROJECT_URL_TEMPLATE ?? null;
  // ALLES parallel laden — auch beide moegliche Default-Tabs.
  // Statt counts -> default-tab -> loadInitialTab (2 sequenzielle RTTs) jetzt
  // alles in EINEM Promise.all (1 RTT). Spart ~150-400ms.
  const [heizlastProjects, counts, kritischData, aufgabenData] = await Promise.all([
    loadHeizlastProjects().catch(() => []),
    loadMailTaskCounts().catch(() => ({
      my_day: 0,
      kritisch: 0,
      aufgaben: 0,
      infos: 0,
      inbox: 0,
      rechnungen: 0,
      aufgeschoben: 0,
      pl: 0,
      gf: 0,
      controlling: 0,
    })),
    loadInitialTab("kritisch"),
    loadInitialTab("aufgaben"),
  ]);

  // Default-Tab: kritisch wenn was drin, sonst aufgaben
  const defaultTab: MailTabFilter = counts.kritisch > 0 ? "kritisch" : "aufgaben";
  const initialData = defaultTab === "kritisch" ? kritischData : aufgabenData;

  return (
    {/* overflow-x-clip statt -hidden: verhindert horizontalen Scroll OHNE
     *  einen Scroll-Container zu erzeugen — sonst bricht position:sticky
     *  des Detail-Panes (es wuerde am Container statt am Viewport kleben). */}
    <div className="flex-1 space-y-6 p-3 sm:p-6 md:p-8 min-w-0 overflow-x-clip">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Aufgaben
          </h1>
          <p className="text-sm text-muted-foreground">
            E-Mail-Aufgaben automatisch klassifiziert von Claude · Hero-Kommentare · Heizlast-Projekte
          </p>
        </div>
        <div className="flex items-center gap-2">
          <VoiceTaskDialog />
          <NewTaskDialog />
        </div>
      </header>
      <AufgabenView
        heizlastProjects={heizlastProjects}
        heroProjectLinkTemplate={heroProjectLinkTemplate}
        initialAufgaben={initialData}
        initialTab={defaultTab}
        counts={counts}
      />
    </div>
  );
}
