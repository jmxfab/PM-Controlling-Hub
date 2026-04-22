import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DashboardKpiDialog } from "./dashboard-kpi-dialog";

const activeProject = {
  id: "hero-project-active",
  projectNumber: "PV24-101",
  projectName: "PV Aktives Projekt",
  status: "aktiv",
  department: "PV" as const,
  snapshotDate: "2026-04-16",
  measureShort: "Dachanlage",
  projectType: "Laufendes Projekt",
  customerName: "Aktivkunde GmbH",
  customerContactName: "Max Aktiv",
  customerPhone: "+49 40 111111",
  customerEmail: "aktiv@example.invalid",
  customerAddress: "Musterstraße 1, 20095 Hamburg",
  customerDocuments: [
    {
      id: "doc-active-1",
      documentNumber: "PV24-101-D1",
      type: "Projektakte",
      baseType: "document",
      value: 1500,
      statusText: "abgelegt",
      createdAt: "2026-04-15T10:00:00.000Z",
      fileUrl: "https://files.example.invalid/pv24-101-d1",
    },
  ],
};

const reworkProject = {
  id: "hero-project-rework",
  projectNumber: "PV24-202",
  projectName: "PV Nacharbeit 202",
  status: "nacharbeit",
  department: "PV" as const,
  snapshotDate: "2026-04-16",
  measureShort: "Dachanlage",
  projectType: "Nacharbeit",
  maturityDate: "2026-04-18",
  customerName: "Nacharbeit AG",
  customerContactName: "Nina Nacharbeit",
  customerPhone: "+49 40 222222",
  customerEmail: "nacharbeit@example.invalid",
  customerAddress: "Musterstraße 2, 20095 Hamburg",
  customerDocuments: [],
};

describe("DashboardKpiDialog", () => {
  it("opens an in-place dialog with the matching KPI project rows", () => {
    render(
      <DashboardKpiDialog
        data={{
          activeProjects: 1,
          completedProjectsWeek: 0,
          accountingTransferredCount: 0,
          accountingTransferredAmount: 0,
          openReworks: 1,
          scheduledReworks: 1,
          openCustomerCommitments: 0,
          scheduledClosings: 0,
          bewertungspoolCount: 0,
        }}
        departmentName="Photovoltaik (PV)"
        snapshotContextLabel="aktuellen Hero-Stand"
        heroProjectLinkTemplate={null}
        kpiProjectGroups={{
          activeProjects: [activeProject],
          completedProjectsWeek: [],
          accountingTransferredCount: [],
          openReworks: [reworkProject],
          scheduledReworks: [reworkProject],
          openCustomerCommitments: [],
          scheduledClosings: [],
          bewertungspoolCount: [],
        }}
        source="sample"
        timeframe={{
          mode: "current",
          from: null,
          to: null,
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Aktive Projekte/i }));

    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getByText("Aktive Projekte")).toBeInTheDocument();
    expect(within(dialog).getByText(/1 passendes Projekt/i)).toBeInTheDocument();
    expect(within(dialog).getByText("PV Aktives Projekt")).toBeInTheDocument();
    expect(within(dialog).queryByText("PV Nacharbeit 202")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Projekte im Überblick")).not.toBeInTheDocument();

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: /Details zu PV Aktives Projekt/i,
      })
    );

    expect(within(dialog).getByText("Kunde & Kontakt")).toBeInTheDocument();
    expect(within(dialog).getAllByText("PV24-101-D1").length).toBeGreaterThan(0);
  });
});
