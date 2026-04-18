import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchAllHeroProjects, normalizeHeroProject } from "./hero-client";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("normalizeHeroProject", () => {
  it("maps documented Hero ProjectMatch fields into the internal project shape", () => {
    expect(
      normalizeHeroProject({
        id: 42,
        project_id: 777,
        project_nr: "PV24-101",
        project_title: "Musterprojekt",
        project_type: "Photovoltaik",
        created: "2026-04-16T10:00:00+00:00",
        modified: "2026-04-16T12:00:00+00:00",
        measure: { short: "PV" },
        current_project_match_status: {
          id: 5,
          name: "Aktiv",
          maturity_date: "2026-05-06T00:00:00+00:00",
        },
        customer: {
          id: 77,
          company_name: "JMX Beispiel GmbH",
          email: "kunde@example.com",
        },
        contact: {
          id: 88,
          first_name: "Max",
          last_name: "Mustermann",
          phone_home: "+491234",
        },
        address: {
          street: "Musterstraße 1",
          city: "Osnabrück",
          zipcode: "49074",
        },
        customer_documents: [
          {
            id: 99,
            nr: "RG-1001",
            type: "invoice",
            status_code: 100,
            status_name: "Offen",
            value: 1250,
            created: "2026-04-17T00:00:00+00:00",
            document_type: { base_type: "invoice", name: "Rechnung" },
            file_upload: { url: "https://hero.example/doc.pdf" },
          },
        ],
      })
    ).toMatchObject({
      id: "42",
      project_number: "PV24-101",
      name: "Musterprojekt",
      status: "Aktiv",
      project_type: "Photovoltaik",
      measure_short: "PV",
      measure_name: null,
      created_at: "2026-04-16T10:00:00+00:00",
      modified_at: "2026-04-16T12:00:00+00:00",
      maturity_date: "2026-05-06T00:00:00+00:00",
      customer_name: "JMX Beispiel GmbH",
      customer_contact_name: "Max Mustermann",
      customer_phone: "+491234",
      customer_email: "kunde@example.com",
      customer_address: "Musterstraße 1, 49074 Osnabrück",
      customerName: "JMX Beispiel GmbH",
      customerContactName: "Max Mustermann",
      customerPhone: "+491234",
      customerEmail: "kunde@example.com",
      customerAddress: "Musterstraße 1, 49074 Osnabrück",
      customer: {
        id: 77,
        company_name: "JMX Beispiel GmbH",
        email: "kunde@example.com",
      },
      contact: {
        id: 88,
        first_name: "Max",
        last_name: "Mustermann",
        phone_home: "+491234",
      },
      address: {
        street: "Musterstraße 1",
        city: "Osnabrück",
        zipcode: "49074",
      },
      customer_documents: [
        {
          id: 99,
          nr: "RG-1001",
          type: "invoice",
          status_code: 100,
          status_name: "Offen",
          value: 1250,
          created: "2026-04-17T00:00:00+00:00",
          document_type: { base_type: "invoice", name: "Rechnung" },
          file_upload: { url: "https://hero.example/doc.pdf" },
        },
      ],
      customerDocuments: [
        {
          id: 99,
          nr: "RG-1001",
        },
      ],
      completion_date: null,
      accounting_date: null,
      accounting_amount: 1250,
      rework_status: null,
      rework_scheduled_date: null,
      customer_commitment_status: null,
      closing_appointment_date: null,
    });
  });

  it("falls back gracefully when optional Hero fields are missing", () => {
    expect(
      normalizeHeroProject({
        id: "abc",
        project_nr: null,
        project_title: null,
        current_project_match_status: null,
      })
    ).toMatchObject({
      id: "abc",
      project_number: null,
      name: null,
      status: null,
      customer_documents: [],
      created_at: null,
      modified_at: null,
      maturity_date: null,
    });
  });

  it("paginates through all Hero projects instead of stopping at the first page", async () => {
    vi.stubEnv("HERO_API_KEY", "test-key");

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            project_matches: Array.from({ length: 100 }, (_, index) => ({
              id: index + 1,
              project_nr: `PV-${index + 1}`,
              project_title: `Projekt ${index + 1}`,
              current_project_match_status: { name: "Aktiv" },
            })),
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            project_matches: [
              {
                id: 101,
                project_nr: "PV-101",
                project_title: "Projekt 101",
                current_project_match_status: { name: "Aktiv" },
              },
            ],
          },
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const projects = await fetchAllHeroProjects();

    expect(projects).toHaveLength(101);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain('"offset":0');
    expect(fetchMock.mock.calls[1]?.[1]?.body).toContain('"offset":100');
  });
});
