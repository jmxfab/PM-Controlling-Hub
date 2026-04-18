import { HistoricDataPoint } from "@/components/dashboard/dashboard-charts";

export interface HistoricSnapshotRow {
  snapshot_date: string;
  active_projects: number;
  completed_projects_week: number;
  accounting_transferred_count: number;
}

export function aggregateSnapshotsByWeek(
  rows: HistoricSnapshotRow[]
): HistoricDataPoint[] {
  const latestByWeek = new Map<string, HistoricSnapshotRow>();

  for (const row of [...rows].sort((a, b) =>
    a.snapshot_date.localeCompare(b.snapshot_date)
  )) {
    latestByWeek.set(getIsoWeekKey(row.snapshot_date), row);
  }

  return [...latestByWeek.values()].map((row) => ({
    date: formatDateLabel(row.snapshot_date),
    active: row.active_projects,
    completed: row.completed_projects_week,
    accounting: row.accounting_transferred_count,
  }));
}

function getIsoWeekKey(isoDate: string): string {
  const d = new Date(isoDate);
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const year = date.getUTCFullYear();
  const week = getWeekNumber(new Date(isoDate));
  return `${year}-${week}`;
}

function formatDateLabel(isoDate: string): string {
  const d = new Date(isoDate);
  const weekNum = getWeekNumber(d);
  return `KW ${weekNum}`;
}

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
