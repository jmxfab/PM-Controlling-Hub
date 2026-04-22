import { afterEach, describe, expect, it, vi } from "vitest";

import type { DashboardTimeframe } from "@/lib/dashboard/dashboard-timeframe";
import { filterHeroProjectsByTimeframe } from "./dashboard-live-filter";

const currentTimeframe: DashboardTimeframe = {
  mode: "current",
  from: null,
  to: null,
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

function stubSupabaseEnv() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
}

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
  it("returns empty state when HERO_API_KEY is missing", async () => {
    stubSupabaseEnv();

    const { getDashboardTabData } = await import("./dashboard-data");
    const data = await getDashboardTabData("GESAMT", currentTimeframe);

    expect(data.source).toBe("empty");
    expect(data.projectList).toHaveLength(0);
    expect(data.notice).toContain("API-Key ist nicht konfiguriert");
  });

  it("prefers live Hero data when the GraphQL read succeeds", async () => {
    stubSupabaseEnv();
    vi.stubEnv("HERO_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            project_matches: [
              {
                id: 101,
                project_nr: "PV24-101",
                project_title: "PV Live Projekt",
                project_type: "Photovoltaik",
                created: "2026-04-09T10:00:00+00:00",
                modified: "2026-04-15T14:00:00+00:00",
                measure: {
                  short: "Dachanlage",
                  name: "PV Komplettpaket",
                },
                customer: {
                  company_name: "JMX Solar GmbH",
                  email: "kontakt@example.invalid",
                },
                contact: {
                  first_name: "Max",
                  last_name: "Solar",
                  email: "max@example.invalid",
                  phone_home: "+49 40 123456",
                },
                address: {
                  street: "Musterstraße 1",
                  zipcode: "20095",
                  city: "Hamburg",
                },
                customer_documents: [
                  {
                    id: 501,
                    nr: "PV24-101-D1",
                    type: "invoice",
                    status_code: 100,
                    status_name: "Offen",
                    value: 2400,
                    created: "2026-04-15T16:00:00+00:00",
                    file_upload: {
                      url: "https://files.example.invalid/PV24-101-D1.pdf",
                    },
                    document_type: {
                      base_type: "invoice",
                      name: "Rechnung",
                    },
                  },
                ],
                current_project_match_status: {
                  name: "Aktiv",
                  maturity_date: "2026-04-20T00:00:00+00:00",
                },
              },
              {
                id: 202,
                project_nr: "PV24-202",
                project_title: "PV Altes Projekt",
                created: "2026-03-01T10:00:00+00:00",
                modified: "2026-03-05T14:00:00+00:00",
                current_project_match_status: {
                  name: "Aktiv",
                },
              },
            ],
          },
        }),
      })
    );

    const { getDashboardTabData } = await import("./dashboard-data");
    const data = await getDashboardTabData("PV", {
      mode: "frei",
      from: "2026-04-01",
      to: "2026-04-30",
    });

    expect(data.source).toBe("hero");
    expect(data.historicData).toEqual([]);
    expect(data.projectList).toHaveLength(1);
    expect(data.projectList[0]).toMatchObject({
      id: "101",
      projectNumber: "PV24-101",
      projectName: "PV Live Projekt",
      department: "PV",
      customerName: "JMX Solar GmbH",
      customerContactName: "Max Solar",
    });
    expect(data.projectList[0]?.customerDocuments).toMatchObject([
      {
        documentNumber: "PV24-101-D1",
        baseType: "invoice",
        fileName: "PV24-101-D1.pdf",
      },
    ]);
    expect(data.kpiData.activeProjects).toBe(1);
    expect(data.kpiProjectGroups.activeProjects.map((project) => project.id)).toEqual(
      data.projectList.map((project) => project.id)
    );
  });

  it("returns empty state when the live Hero read fails", async () => {
    stubSupabaseEnv();
    vi.stubEnv("HERO_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      })
    );

    const { getDashboardTabData } = await import("./dashboard-data");
    const data = await getDashboardTabData("PV", currentTimeframe);

    expect(data.source).toBe("empty");
    expect(data.projectList).toHaveLength(0);
    expect(data.notice).toContain("Hero Live-Daten nicht verfügbar");
    expect(data.notice).toContain("Hero API request failed: 401 Unauthorized");
  });
});
