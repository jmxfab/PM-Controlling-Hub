import { describe, expect, it } from "vitest";

import { aggregateSnapshotsByWeek } from "./dashboard-historic";

describe("aggregateSnapshotsByWeek", () => {
  it("keeps the latest snapshot of each ISO week", () => {
    const result = aggregateSnapshotsByWeek([
      {
        snapshot_date: "2026-04-07",
        active_projects: 10,
        completed_projects_week: 3,
        accounting_transferred_count: 2,
      },
      {
        snapshot_date: "2026-04-09",
        active_projects: 12,
        completed_projects_week: 4,
        accounting_transferred_count: 3,
      },
      {
        snapshot_date: "2026-04-15",
        active_projects: 16,
        completed_projects_week: 5,
        accounting_transferred_count: 4,
      },
    ]);

    expect(result).toEqual([
      {
        date: "KW 15",
        active: 12,
        completed: 4,
        accounting: 3,
      },
      {
        date: "KW 16",
        active: 16,
        completed: 5,
        accounting: 4,
      },
    ]);
  });
});
