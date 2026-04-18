export const DASHBOARD_TIMEFRAME_MODES = ["current", "14d", "30d", "frei"] as const;

export type DashboardTimeframeMode = (typeof DASHBOARD_TIMEFRAME_MODES)[number];

export interface DashboardTimeframe {
  mode: DashboardTimeframeMode;
  from: string | null;
  to: string | null;
}

export interface DashboardTimeframeRange {
  from: string;
  to: string;
}

type SearchParamValue = string | string[] | undefined;
type SearchParamSource =
  | { get(name: string): string | null }
  | Record<string, SearchParamValue>
  | undefined;

const DEFAULT_CUSTOM_RANGE_DAYS = 14;

export const DEFAULT_DASHBOARD_TIMEFRAME: DashboardTimeframe = {
  mode: "current",
  from: null,
  to: null,
};

export function parseDashboardTimeframe(
  source: SearchParamSource,
  referenceDate: Date = new Date()
): DashboardTimeframe {
  const requestedMode = normalizeDashboardTimeframeMode(
    readSearchParam(source, "timeframe")
  );

  if (requestedMode !== "frei") {
    return {
      mode: requestedMode,
      from: null,
      to: null,
    };
  }

  const fallbackRange = getDefaultDashboardCustomRange(referenceDate);
  const parsedFrom = parseIsoDate(readSearchParam(source, "from"));
  const parsedTo = parseIsoDate(readSearchParam(source, "to"));

  if (!parsedFrom || !parsedTo) {
    return {
      mode: "frei",
      ...fallbackRange,
    };
  }

  return {
    mode: "frei",
    ...(parsedFrom <= parsedTo
      ? { from: parsedFrom, to: parsedTo }
      : { from: parsedTo, to: parsedFrom }),
  };
}

export function getDashboardTimeframeRange(
  timeframe: DashboardTimeframe,
  referenceDate: Date = new Date()
): DashboardTimeframeRange | null {
  if (timeframe.mode === "current") {
    return null;
  }

  if (timeframe.mode === "14d") {
    return getDefaultDashboardCustomRange(referenceDate);
  }

  if (timeframe.mode === "30d") {
    return getNextDashboardRange(referenceDate, 30);
  }

  if (timeframe.from && timeframe.to) {
    return {
      from: timeframe.from,
      to: timeframe.to,
    };
  }

  return getDefaultDashboardCustomRange(referenceDate);
}

export function getDefaultDashboardCustomRange(
  referenceDate: Date = new Date()
): DashboardTimeframeRange {
  const normalizedReference = atLocalNoon(referenceDate);
  const to = toIsoDate(normalizedReference);
  const from = toIsoDate(
    addDays(normalizedReference, -(DEFAULT_CUSTOM_RANGE_DAYS - 1))
  );

  return { from, to };
}

export function toDashboardTimeframeSearchParams(
  timeframe: DashboardTimeframe
): Record<string, string> {
  if (timeframe.mode === "frei" && timeframe.from && timeframe.to) {
    return {
      timeframe: timeframe.mode,
      from: timeframe.from,
      to: timeframe.to,
    };
  }

  return {
    timeframe: timeframe.mode,
  };
}

export function getDashboardTimeframeLabel(
  timeframe: DashboardTimeframe
): string {
  if (timeframe.mode === "current") {
    return "Aktueller Stand";
  }

  if (timeframe.mode === "14d") {
    return "Letzte 14 Tage";
  }

  if (timeframe.mode === "30d") {
    return "Nächste 30 Tage";
  }

  const range = getDashboardTimeframeRange(timeframe);

  if (!range) {
    return "Freier Zeitraum";
  }

  return `Frei: ${formatIsoDate(range.from)} – ${formatIsoDate(range.to)}`;
}

export function getDashboardSnapshotContextLabel(
  timeframe: DashboardTimeframe
): string {
  if (timeframe.mode === "current") {
    return "letzten verfügbaren Snapshot";
  }

  if (timeframe.mode === "14d") {
    return "letzten Snapshot der letzten 14 Tage";
  }

  if (timeframe.mode === "30d") {
    return "letzten Snapshot der nächsten 30 Tage";
  }

  return "letzten Snapshot im freien Zeitraum";
}

export function getDashboardHistoricDescription(
  timeframe: DashboardTimeframe
): string {
  if (timeframe.mode === "current") {
    return "Aggregiert aus den letzten Tages-Snapshots je Kalenderwoche";
  }

  return "Aggregiert aus verfügbaren Tages-Snapshots je Kalenderwoche im gewählten Zeitraum";
}

export function getNextDashboardRange(
  referenceDate: Date = new Date(),
  days: number = 30
): DashboardTimeframeRange {
  const normalizedReference = atLocalNoon(referenceDate);
  const from = toIsoDate(normalizedReference);
  const to = toIsoDate(addDays(normalizedReference, days - 1));

  return { from, to };
}

function normalizeDashboardTimeframeMode(
  value: string | null
): DashboardTimeframeMode {
  if (value && DASHBOARD_TIMEFRAME_MODES.includes(value as DashboardTimeframeMode)) {
    return value as DashboardTimeframeMode;
  }

  return DEFAULT_DASHBOARD_TIMEFRAME.mode;
}

function readSearchParam(source: SearchParamSource, key: string): string | null {
  if (!source) {
    return null;
  }

  if ("get" in source && typeof source.get === "function") {
    return source.get(key);
  }

  const value = (source as Record<string, SearchParamValue>)[key];
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function parseIsoDate(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const parsed = new Date(`${value}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return toIsoDate(parsed) === value ? value : null;
}

function formatIsoDate(isoDate: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00.000Z`));
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return atLocalNoon(nextDate);
}

function atLocalNoon(date: Date): Date {
  const normalizedDate = new Date(date);
  normalizedDate.setHours(12, 0, 0, 0);
  return normalizedDate;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
