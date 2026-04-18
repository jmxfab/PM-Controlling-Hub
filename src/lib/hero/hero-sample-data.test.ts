import { describe, expect, it } from "vitest";

import { buildHeroSampleDashboardData, buildHeroSampleTimeline } from "./hero-sample-data";

describe("hero sample data", () => {
  const referenceDate = new Date("2026-04-16T12:00:00.000Z");

  it("builds deterministic Hero-shaped timeline snapshots", () => {
    const timeline = buildHeroSampleTimeline(referenceDate);

    expect(timeline).toHaveLength(8);
    expect(timeline[0]?.snapshotDate).toBe("2026-02-26");
    expect(timeline.at(-1)?.projects.some((project) => project.project_number?.startsWith("PV"))).toBe(true);
    expect(timeline.at(-1)?.projects.some((project) => project.project_number?.startsWith("WÄP"))).toBe(true);
    expect(timeline.at(-1)?.projects.some((project) => project.project_number?.startsWith("HT"))).toBe(true);
  });

  it("derives non-empty dashboard data for all departments", () => {
    const gesamt = buildHeroSampleDashboardData("GESAMT", referenceDate);
    const pv = buildHeroSampleDashboardData("PV", referenceDate);
    const wp = buildHeroSampleDashboardData("WP", referenceDate);
    const haustechnik = buildHeroSampleDashboardData("HAUSTECHNIK", referenceDate);

    expect(gesamt.kpiData.activeProjects).toBeGreaterThan(pv.kpiData.activeProjects);
    expect(pv.kpiData.activeProjects).toBeGreaterThan(wp.kpiData.activeProjects);
    expect(wp.kpiData.activeProjects).toBeGreaterThan(haustechnik.kpiData.activeProjects);
    expect(gesamt.historicData).toHaveLength(8);
    expect(pv.historicData.at(-1)?.date).toBe("KW 16");
  });
});
