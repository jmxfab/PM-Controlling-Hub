import type { Metadata } from "next";

import { UpcomingView, type UpcomingWindow } from "@/components/dashboard/upcoming-view";
import { loadUpcomingProjects } from "@/lib/supabase/hero-maturity-queries";
import {
  type Department,
  parseDashboardDepartmentParam,
} from "@/lib/dashboard/dashboard-types";

export const metadata: Metadata = {
  title: "Geplant",
  description:
    "Projekte deren Fälligkeitsdatum in einem wählbaren Fenster liegt — Überfällig, Heute, Morgen, Nächste Woche, 30 Tage.",
};

export const revalidate = 60;

const VALID_WINDOWS: UpcomingWindow[] = [
  "overdue",
  "today",
  "tomorrow",
  "next3d",
  "next7d",
  "next30d",
];

function parseWindow(raw: string | string[] | undefined): UpcomingWindow {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v && VALID_WINDOWS.includes(v as UpcomingWindow)) return v as UpcomingWindow;
  return "next7d";
}

function buildRange(win: UpcomingWindow): { fromIso: string; toIso: string } {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const addDays = (d: Date, n: number) => {
    const c = new Date(d);
    c.setDate(c.getDate() + n);
    return c;
  };

  if (win === "overdue") {
    // "überfällig" = maturity_date in Vergangenheit, aber nicht älter als 1 Jahr (Sanity-Limit)
    const from = addDays(today, -365);
    return { fromIso: from.toISOString(), toIso: today.toISOString() };
  }
  if (win === "today") {
    return { fromIso: today.toISOString(), toIso: addDays(today, 1).toISOString() };
  }
  if (win === "tomorrow") {
    return {
      fromIso: addDays(today, 1).toISOString(),
      toIso: addDays(today, 2).toISOString(),
    };
  }
  if (win === "next3d") {
    return { fromIso: today.toISOString(), toIso: addDays(today, 3).toISOString() };
  }
  if (win === "next7d") {
    return { fromIso: today.toISOString(), toIso: addDays(today, 7).toISOString() };
  }
  // next30d
  return { fromIso: today.toISOString(), toIso: addDays(today, 30).toISOString() };
}

interface PageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function FaelligkeitenPage({ searchParams }: PageProps) {
  const resolved = (await searchParams) ?? {};
  const department: Department = parseDashboardDepartmentParam(
    resolved.department
  );
  const win = parseWindow(resolved.window);
  const { fromIso, toIso } = buildRange(win);

  const projects = await loadUpcomingProjects(department, fromIso, toIso).catch(
    () => []
  );
  const heroProjectLinkTemplate = process.env.HERO_PROJECT_URL_TEMPLATE ?? null;

  return (
    <div className="flex-1 space-y-4 p-8 pt-6 max-w-[1200px] mx-auto min-h-screen">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Geplant</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Projekte mit Fälligkeitsdatum in einem wählbaren Zukunftsfenster —
          was steht operativ an, was ist überfällig. Basis:{" "}
          <code className="font-mono">current_project_match_status.maturity_date</code>{" "}
          aus Hero, nur offene Projekte.
        </p>
      </div>

      <UpcomingView
        department={department}
        window={win}
        projects={projects}
        heroProjectLinkTemplate={heroProjectLinkTemplate}
      />
    </div>
  );
}
