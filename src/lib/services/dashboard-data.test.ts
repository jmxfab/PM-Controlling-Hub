import { describe, expect, it, vi } from "vitest";

import type { DashboardTimeframe } from "@/lib/dashboard/dashboard-timeframe";
import { filterHeroProjectsByTimeframe } from "./dashboard-live-filter";

const currentTimeframe: DashboardTimeframe = {
  mode: "current",
  from: null,
  to: null,
};

describe("filterHeroProjectsByTimeframe", () => {
  const projects = [
    {
      id: "past",
      project_number: "PV-1",
      name: "Past project",
      status: "Aktiv",
      created_at: "2026-04-10T10:00:00+00:00",
      modified_at: "2026-04-11T10:00:00+00:00",
      maturity_date: null,
    },
    {
      id: "future",
      project_number: "WÄP-2",
      name: "Future project",
      status: "Auftragsvergabe",
      created_at: "2026-04-01T10:00:00+00:00",
      modified_at: "2026-04-01T10:00:00+00:00",
      maturity_date: "2026-05-04T00:00:00+00:00",
    },
    {
      id: "outside",
      project_number: "HT-3",
      name: "Outside project",
      status: "Aktiv",
      created_at: "2026-03-01T10:00:00+00:00",
      modified_at: "2026-03-01T10:00:00+00:00",
      maturity_date: null,
    },
  ];

  it("returns all projects for current timeframe", () => {
    expect(filterHeroProjectsByTimeframe(projects, currentTimeframe)).toHaveLength(
      3
    );
  });

  it("filters projects for the last 14 days using relevant Hero dates", () => {
    expect(
      filterHeroProjectsByTimeframe(projects, {
        mode: "14d",
        from: null,
        to: null,
      })
    ).toEqual([projects[0]]);
  });

  it("filters projects for the next 30 days using maturity dates", () => {
    expect(
      filterHeroProjectsByTimeframe(projects, {
        mode: "30d",
        from: null,
        to: null,
      })
    ).toEqual([projects[1]]);
  });

  it("filters custom ranges inclusively", () => {
    expect(
      filterHeroProjectsByTimeframe(projects, {
        mode: "frei",
        from: "2026-05-01",
        to: "2026-05-05",
      })
    ).toEqual([projects[1]]);
  });
});

describe("getDashboardTabData", () => {
  it("returns sample data even if a HERO_API_KEY is present", async () => {
    vi.stubEnv("HERO_API_KEY", "test-key");

    try {
      const { getDashboardTabData } = await import("./dashboard-data");
      const data = await getDashboardTabData("GESAMT", currentTimeframe);

      expect(data.source).toBe("sample");
      expect(data.projectList.length).toBeGreaterThan(0);
      expect(data.notice).toContain("Hero Live-Daten sind vorübergehend pausiert");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
