import type { Metadata } from "next";
import { loadHeizlastProjects } from "@/lib/supabase/hero-heizlast-queries";
import { HeizlastView } from "@/components/heizlast/heizlast-view";

export const metadata: Metadata = {
  title: "Heizlast",
  description: "WP-Projekte in Angebotsprüfung mit Dokumenten und Auftragsbestätigung.",
};

export const revalidate = 60;

export default async function HeizlastPage() {
  const projects = await loadHeizlastProjects().catch(() => []);
  const heroProjectLinkTemplate = process.env.HERO_PROJECT_URL_TEMPLATE ?? null;

  return (
    <div className="flex-1 space-y-4 p-8 pt-6 max-w-[1600px] mx-auto min-h-screen">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Heizlast</h1>
        <p className="text-muted-foreground text-sm mt-1">
          WP-Projekte in Angebotsprüfung — {projects.length} Projekt{projects.length !== 1 ? "e" : ""}
        </p>
      </div>
      <HeizlastView projects={projects} heroProjectLinkTemplate={heroProjectLinkTemplate} />
    </div>
  );
}
