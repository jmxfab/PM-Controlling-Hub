import {
  getDashboardTimeframeRange,
  type DashboardTimeframe,
} from "@/lib/dashboard/dashboard-timeframe";
import type { HeroProject } from "@/lib/hero/hero-client";

export function filterHeroProjectsByTimeframe(
  projects: HeroProject[],
  timeframe: DashboardTimeframe
): HeroProject[] {
  if (timeframe.mode === "current") {
    return projects;
  }

  const range = getDashboardTimeframeRange(timeframe);

  if (!range) {
    return projects;
  }

  return projects.filter((project) => {
    const relevantDates = [
      extractIsoDate(project.created_at),
      extractIsoDate(project.modified_at),
      extractIsoDate(project.maturity_date),
    ].filter((value): value is string => !!value);

    if (relevantDates.length === 0) {
      return false;
    }

    return relevantDates.some(
      (date) => date >= range.from && date <= range.to
    );
  });
}

function extractIsoDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value.slice(0, 10);
}
