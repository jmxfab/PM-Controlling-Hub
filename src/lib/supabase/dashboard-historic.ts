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

/** ISO 8601 Wochen-Schluessel "YYYY-WW".
 *  Bug-Fix: vorher wurde year aus dem Thursday-shifted Date geholt aber
 *  week aus dem original Date — bei Jahresgrenzen (z.B. 2025-12-29 = KW1/2026)
 *  fuehrte das zu "2025-1" statt "2026-1". Jetzt kommen beide aus derselben
 *  shifted Date.
 */
function getIsoWeekKey(isoDate: string): string {
  const { isoYear, isoWeek } = getIsoYearAndWeek(new Date(isoDate));
  return `${isoYear}-${isoWeek}`;
}

function formatDateLabel(isoDate: string): string {
  const { isoWeek } = getIsoYearAndWeek(new Date(isoDate));
  return `KW ${isoWeek}`;
}

function getIsoYearAndWeek(d: Date): { isoYear: number; isoWeek: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const isoYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const isoWeek = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return { isoYear, isoWeek };
}
