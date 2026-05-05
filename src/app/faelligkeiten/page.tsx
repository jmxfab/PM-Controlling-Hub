import type { Metadata } from "next";

import { UpcomingView, type UpcomingWindow } from "@/components/dashboard/upcoming-view";
import { loadUpcomingProjects } from "@/lib/supabase/hero-maturity-queries";
import {
  type Department,
  parseDashboardDepartmentParam,
} from "@/lib/dashboard/dashboard-types";
import type { DataErrorEntry } from "@/components/dashboard/data-error-banner";

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
  "frei",
];

function parseWindow(raw: string | string[] | undefined): UpcomingWindow {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v && VALID_WINDOWS.includes(v as UpcomingWindow)) return v as UpcomingWindow;
  return "next7d";
}

function parseIsoDate(raw: string | string[] | undefined): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return v;
}

function buildRange(
  win: UpcomingWindow,
  fromParam: string | null,
  toParam: string | null
): { fromIso: string; toIso: string } {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const addDays = (d: Date, n: number) => {
    const c = new Date(d);
    c.setDate(c.getDate() + n);
    return c;
  };

  if (win === "frei") {
    // Frei-Modus: from/to-Parameter aus URL. Default-Fallback = nächste 14 Tage.
    const from = fromParam
      ? new Date(`${fromParam}T00:00:00`)
      : today;
    const to = toParam
      ? addDays(new Date(`${toParam}T00:00:00`), 1) // toIso ist exklusiv
      : addDays(from, 14);
    return { fromIso: from.toISOString(), toIso: to.toISOString() };
  }

  if (win === "overdue") {
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
  return { fromIso: today.toISOString(), toIso: addDays(today, 30).toISOString() };
}

interface PageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function FaelligkeitenPage({ searchParams }: PageProps) {
  const resolved = (await searchParams) ?? {};
  // GESAMT in Geplant unterstuetzt — der Loader filtert auf
  // GESAMT_DEPARTMENT_KEYS_ARR (= PV+WP) ab. Nutzer kann ueber den
  // Sparten-Tab auf eine einzelne Sparte einschraenken.
  const department: Department = parseDashboardDepartmentParam(
    resolved.department
  );
  const win = parseWindow(resolved.window);
  const fromParam = parseIsoDate(resolved.from);
  const toParam = parseIsoDate(resolved.to);
  const { fromIso, toIso } = buildRange(win, fromParam, toParam);

  const result = await loadUpcomingProjects(department, fromIso, toIso).then(
    (v) => ({ ok: true as const, projects: v }),
    (err: unknown) => ({
      ok: false as const,
      reason: err instanceof Error ? err.message : String(err),
    })
  );
  const projects = result.ok ? result.projects : [];
  const loadErrors: DataErrorEntry[] = result.ok
    ? []
    : [
        {
          source: "Geplant — Faelligkeitsdaten",
          detail: result.reason,
        },
      ];
  const heroProjectLinkTemplate = process.env.HERO_PROJECT_URL_TEMPLATE ?? null;

  return (
    <div className="flex-1 space-y-4 p-8 pt-6 max-w-[1600px] mx-auto min-h-screen">
      <UpcomingView
        department={department}
        window={win}
        from={fromParam}
        to={toParam}
        projects={projects}
        heroProjectLinkTemplate={heroProjectLinkTemplate}
        loadErrors={loadErrors}
      />
    </div>
  );
}
