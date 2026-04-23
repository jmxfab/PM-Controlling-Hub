import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DashboardProjectList } from "./dashboard-project-list";

const projectListProps = {
  departmentName: "Photovoltaik (PV)",
  heroProjectLinkTemplate: null,
  projects: [
    {
      id: "hero-project-1",
      projectNumber: "PV24-101",
      projectName: "PV Musterprojekt 101",
      status: "aktiv",
      department: "PV" as const,
      snapshotDate: "2026-04-16",
      measureShort: "Dachanlage",
      projectType: "Laufendes Projekt",
      customerName: "Musterkunde GmbH",
      customerContactName: "Max Mustermann",
      customerPhone: "+49 40 123456",
      customerEmail: "max@example.invalid",
      customerAddress: "Musterstraße 1, 20095 Hamburg",
      customerDocuments: [
        {
          id: "doc-1",
          documentNumber: "PV24-101-D1",
          type: "Projektakte",
          baseType: "document",
          value: 2500,
          statusText: "abgelegt",
          createdAt: "2026-04-15T10:00:00.000Z",
          fileUrl: "https://files.example.invalid/pv24-101-d1",
        },
      ],
    },
  ],
  source: "hero" as const,
  timeframe: {
    mode: "current" as const,
    from: null,
    to: null,
  },
};

describe("DashboardProjectList", () => {
  it("shows operational project context without template noise", () => {
    render(<DashboardProjectList {...projectListProps} />);

    expect(screen.queryByRole("link", { name: /Hero öffnen/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Template fehlt/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Kein Hero-Link-Template/i)).not.toBeInTheDocument();
    expect(screen.getByText("PV Musterprojekt 101")).toBeInTheDocument();
    expect(screen.getByText("Musterkunde GmbH")).toBeInTheDocument();
    expect(screen.getByText(/1 Dokument/)).toBeInTheDocument();
  });

  it("renders Hero links from the configured template", () => {
    render(
      <DashboardProjectList
        {...projectListProps}
        heroProjectLinkTemplate="https://hero.example/{department}/{projectNumber}?id={projectId}"
      />
    );

    const heroLink = screen.getByRole("link", { name: /Hero öffnen/i });

    expect(heroLink).toHaveAttribute(
      "href",
      "https://hero.example/PV/PV24-101?id=hero-project-1"
    );
    expect(screen.getByText("PV24-101")).toBeInTheDocument();
    expect(screen.queryByText(/Snapshot 16.04.2026/)).not.toBeInTheDocument();
  });

  it("reveals project details and linked documents on demand", () => {
    render(<DashboardProjectList {...projectListProps} />);

    fireEvent.click(
      screen.getByRole("button", { name: /Details zu PV Musterprojekt 101/i })
    );

    expect(screen.getByText("Kunde & Kontakt")).toBeInTheDocument();
    expect(screen.getByText("Dokumente (1)")).toBeInTheDocument();
    expect(screen.getAllByText("PV24-101-D1").length).toBeGreaterThan(0);
    expect(
      screen
        .getAllByRole("link", { name: /Datei/i })
        .some(
          (link) =>
            link.getAttribute("href") === "https://files.example.invalid/pv24-101-d1"
        )
    ).toBe(true);
  });
});
