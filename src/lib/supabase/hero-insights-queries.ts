import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";

const CACHE_TTL_S = 300;

import {
  HERO_TYPE_ID_TO_DEPARTMENT,
  type Department,
} from "@/lib/dashboard/dashboard-types";
import { cleanProjectTitle } from "@/lib/hero/project-title";

/**
 * Zeitreihen- und Aggregations-Queries für den Insights-Tab.
 * Alles lesend aus den drei Materialized Views
 * (hero_dashboard_projects / hero_status_transitions / hero_step_weekly).
 */

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase creds");
  return createClient(url, key);
}

function typeIdsFor(department: Department): string[] {
  if (department === "GESAMT") return Object.keys(HERO_TYPE_ID_TO_DEPARTMENT);
  return Object.entries(HERO_TYPE_ID_TO_DEPARTMENT)
    .filter(([, d]) => d === department)
    .map(([id]) => id);
}

export interface WeeklyThroughputPoint {
  weekStart: string; // ISO date (Montag — date_trunc('week') gibt Montag)
  newProjects: number;
  completed: number;
  accounting: number;
  rework: number;
  reopens: number;
}

export interface InsightsRange {
  fromIso: string;
  toIso: string;
}

/**
 * Wöchentliche Flow-Raten pro Department, optional eingeschränkt auf
 * einen Zeitraum. Default: letzte 12 Wochen ab jetzt.
 */
const loadWeeklyThroughputInner = cache(
  async (
    department: Department,
    options?: { weeks?: number; range?: InsightsRange }
  ): Promise<WeeklyThroughputPoint[]> => {
    const supabase = supabaseAdmin();
    const { range, weeks = 12 } = options ?? {};
    const sinceIso =
      range?.fromIso ??
      (() => {
        const since = new Date();
        since.setDate(since.getDate() - weeks * 7);
        return since.toISOString();
      })();
    const untilIso = range?.toIso ?? null;

    const { data, error } = await supabase.rpc("compute_weekly_throughput", {
      p_department: department,
      p_from: sinceIso,
      p_to: untilIso,
    });
    if (error) throw new Error(`compute_weekly_throughput: ${error.message}`);

    const rows = (data ?? []) as Array<{
      week_start: string;
      new_projects: number;
      completed: number;
      accounting: number;
      rework: number;
      reopens: number;
    }>;

    return rows.map((r) => ({
      weekStart: r.week_start,
      newProjects: Number(r.new_projects) || 0,
      completed: Number(r.completed) || 0,
      accounting: Number(r.accounting) || 0,
      rework: Number(r.rework) || 0,
      reopens: Number(r.reopens) || 0,
    }));
  }
);

export const loadWeeklyThroughput = (
  department: Department,
  options?: { weeks?: number; range?: InsightsRange }
): Promise<WeeklyThroughputPoint[]> =>
  unstable_cache(
    () => loadWeeklyThroughputInner(department, options),
    [
      "loadWeeklyThroughput",
      department,
      String(options?.weeks ?? ""),
      options?.range?.fromIso ?? "",
      options?.range?.toIso ?? "",
    ],
    { revalidate: CACHE_TTL_S, tags: ["insights"] }
  )();

export interface DailyThroughputPoint {
  dayStart: string; // ISO date (YYYY-MM-DD, Europe/Berlin)
  newProjects: number;
  completed: number;
  accounting: number;
  rework: number;
  reopens: number;
}

const loadDailyThroughputInner = cache(
  async (
    department: Department,
    range: InsightsRange
  ): Promise<DailyThroughputPoint[]> => {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase.rpc("compute_daily_throughput", {
      p_department: department,
      p_from: range.fromIso,
      p_to: range.toIso,
    });
    if (error) throw new Error(`compute_daily_throughput: ${error.message}`);

    const rows = (data ?? []) as Array<{
      day_start: string;
      new_projects: number;
      completed: number;
      accounting: number;
      rework: number;
      reopens: number;
    }>;

    return rows.map((r) => ({
      dayStart: r.day_start,
      newProjects: Number(r.new_projects) || 0,
      completed: Number(r.completed) || 0,
      accounting: Number(r.accounting) || 0,
      rework: Number(r.rework) || 0,
      reopens: Number(r.reopens) || 0,
    }));
  }
);

export const loadDailyThroughput = (
  department: Department,
  range: InsightsRange
): Promise<DailyThroughputPoint[]> =>
  unstable_cache(
    () => loadDailyThroughputInner(department, range),
    ["loadDailyThroughput", department, range.fromIso, range.toIso],
    { revalidate: CACHE_TTL_S, tags: ["insights"] }
  )();

export interface StepDurationRow {
  stepId: string;
  stepName: string;
  avgDays: number;
  medianDays: number;
  sampleSize: number;
}

/**
 * Durchschnittliche + mediane Verweildauer pro Step, optional eingeschränkt
 * auf einen Zeitraum. Default: letzte 12 Monate.
 */
const loadStepDurationsInner = cache(
  async (
    department: Department,
    options?: { range?: InsightsRange }
  ): Promise<StepDurationRow[]> => {
    const supabase = supabaseAdmin();
    const { range } = options ?? {};
    const sinceIso =
      range?.fromIso ??
      (() => {
        const c = new Date();
        c.setFullYear(c.getFullYear() - 1);
        return c.toISOString();
      })();

    const { data, error } = await supabase.rpc("compute_step_durations", {
      p_department: department,
      p_from: sinceIso,
      p_to: range?.toIso ?? null,
    });
    if (error) throw new Error(`compute_step_durations: ${error.message}`);

    const rows = (data ?? []) as Array<{
      step_id: string;
      step_name: string;
      avg_days: number | string;
      median_days: number | string;
      sample_size: number;
    }>;

    return rows.map((r) => ({
      stepId: r.step_id,
      stepName: r.step_name,
      avgDays: Number(r.avg_days) || 0,
      medianDays: Number(r.median_days) || 0,
      sampleSize: Number(r.sample_size) || 0,
    }));
  }
);

export const loadStepDurations = (
  department: Department,
  options?: { range?: InsightsRange }
): Promise<StepDurationRow[]> =>
  unstable_cache(
    () => loadStepDurationsInner(department, options),
    [
      "loadStepDurations",
      department,
      options?.range?.fromIso ?? "",
      options?.range?.toIso ?? "",
    ],
    { revalidate: CACHE_TTL_S, tags: ["insights"] }
  )();

/**
 * Longest-running open projects (derzeit offene Projekte mit hohem Alter).
 *
 * Altersberechnung: wenn das Projekt schon einmal abgeschlossen war und
 * danach wieder aufgemacht wurde (was_reopened = true), wird das Alter ab
 * dem letzten Reopen-Zeitpunkt (last_rework_at, sonst last_finish_at)
 * gezählt statt ab created_at_hero. Sonst würde ein Reopen aus 2024 als
 * "3 Jahre alt" erscheinen, obwohl es operativ gerade erst wieder offen
 * ist. Die Liste holt sich daher alle offenen Projekte, rechnet das
 * effektive Alter in JS und sortiert danach.
 */
const loadLongestRunningInner = cache(
  async (department: Department, limit = 15): Promise<
    Array<{
      id: string;
      projectNumber: string | null;
      projectName: string | null;
      stepName: string | null;
      customerName: string | null;
      createdAtHero: string | null;
      ageDays: number;
      wasReopened: boolean;
    }>
  > => {
    const supabase = supabaseAdmin();
    const all: Array<{
      id: string;
      project_number: string | null;
      project_name: string | null;
      step_name: string | null;
      customer_name: string | null;
      created_at_hero: string | null;
      was_reopened: boolean | null;
      last_finish_at: string | null;
      last_rework_at: string | null;
    }> = [];
    for (let offset = 0; offset < 10000; offset += 1000) {
      let query = supabase
        .from("hero_dashboard_projects")
        .select(
          "id, project_number, project_name, step_name, customer_name, created_at_hero, was_reopened, last_finish_at, last_rework_at, department_key"
        )
        .eq("is_finished", false)
        .not("created_at_hero", "is", null);
      if (department !== "GESAMT") query = query.eq("department_key", department);
      else query = query.not("department_key", "is", null);
      const { data } = await query.range(offset, offset + 999);
      const rows = (data ?? []) as typeof all;
      all.push(...rows);
      if (rows.length < 1000) break;
    }

    const now = Date.now();
    const withAge = all.map((r) => {
      const wasReopened = r.was_reopened === true;
      // Startzeitpunkt fürs "offen seit" — beim Reopen der Zeitpunkt
      // der letzten Abschluss (last_finish_at), nicht der letzte
      // Nacharbeit-Eintrag. Die "wieder offen"-Uhr startet, wenn der
      // Abschluss gebrochen wurde. Fallback: last_rework_at, zuletzt
      // created_at_hero.
      const reopenStart = wasReopened
        ? r.last_finish_at ?? r.last_rework_at
        : null;
      const effectiveStart = reopenStart ?? r.created_at_hero;
      const ageMs = effectiveStart
        ? now - Date.parse(effectiveStart)
        : 0;
      return {
        id: r.id,
        projectNumber: r.project_number,
        projectName: cleanProjectTitle(r.project_name, {
          customerName: r.customer_name,
          projectNumber: r.project_number,
        }),
        stepName: r.step_name,
        customerName: r.customer_name,
        createdAtHero: r.created_at_hero,
        ageDays: ageMs > 0 ? Math.round(ageMs / 86400000) : 0,
        wasReopened,
      };
    });

    return withAge
      .sort((a, b) => b.ageDays - a.ageDays)
      .slice(0, limit);
  }
);

export const loadLongestRunning = (
  department: Department,
  limit = 15
): ReturnType<typeof loadLongestRunningInner> =>
  unstable_cache(
    () => loadLongestRunningInner(department, limit),
    ["loadLongestRunning", department, String(limit)],
    { revalidate: CACHE_TTL_S, tags: ["insights"] }
  )();

export { typeIdsFor };

// ---------------------------------------------------------------------------
// kWp / Anlagenleistung
// ---------------------------------------------------------------------------

export interface KwpStats {
  totalKwp: number;
  avgKwp: number | null;
  projectsWithKwp: number;
  projectsCompleted: number;
}

const loadKwpStatsInner = cache(
  async (department: Department): Promise<KwpStats> => {
    const supabase = supabaseAdmin();

    const { data, error } = await supabase.rpc("compute_kwp_stats", {
      p_department: department,
    });
    if (error) throw new Error(`compute_kwp_stats: ${error.message}`);

    const row = ((data ?? []) as Array<{
      total_kwp: number | string;
      avg_kwp: number | string | null;
      projects_with_kwp: number;
      projects_completed: number;
    }>)[0];

    if (!row) {
      return { totalKwp: 0, avgKwp: null, projectsWithKwp: 0, projectsCompleted: 0 };
    }

    return {
      totalKwp: Number(row.total_kwp) || 0,
      avgKwp: row.avg_kwp == null ? null : Number(row.avg_kwp),
      projectsWithKwp: Number(row.projects_with_kwp) || 0,
      projectsCompleted: Number(row.projects_completed) || 0,
    };
  }
);

export const loadKwpStats = (department: Department): Promise<KwpStats> =>
  unstable_cache(
    () => loadKwpStatsInner(department),
    ["loadKwpStats", department],
    { revalidate: CACHE_TTL_S, tags: ["insights"] }
  )();

// ---------------------------------------------------------------------------
// Zeit-Metriken (Durchlauf)
// ---------------------------------------------------------------------------

export interface DurationMetric {
  label: string;
  avgDays: number | null;
  medianDays: number | null;
  sampleSize: number;
  description: string;
}

/**
 * Durchlauf-Metriken:
 *   - Ramp-up      AB → Montage
 *   - Ausführung   Montage → Abschlussrechnung
 *   - Abrechnung   Abschlussrechnung → Abgeschlossen
 *   - Gesamt       created_at → Abgeschlossen
 *
 * Matching per Regex auf step_name (wir normalisieren per toLowerCase
 * und prüfen enthaltene Schlüsselwörter). Basis: hero_dashboard_projects
 * (ein Projekt pro Zeile, raw->project_match_statuses enthält alle Steps).
 */
const DURATION_METRIC_MAP: Record<
  string,
  { label: string; description: string; order: number }
> = {
  ramp_up: {
    label: "Ramp-up (AB → Montage)",
    description: "Von Auftragsbestätigung bis Start der Montage.",
    order: 0,
  },
  ausfuehrung: {
    label: "Ausführung (Montage → Abschlussrechnung)",
    description: "Wie lange dauert die Montage bis zur Abschlussrechnung.",
    order: 1,
  },
  abrechnung: {
    label: "Abrechnungsverzug (Abschlussrechnung → Abgeschlossen)",
    description:
      "Wie lange nach der Rechnungsstellung bis zum Abschluss des Projekts.",
    order: 2,
  },
  gesamt: {
    label: "Gesamtdurchlaufzeit (Anlage → Abgeschlossen)",
    description: "End-to-End: vom Anlegen in Hero bis Projekt abgeschlossen.",
    order: 3,
  },
};

const loadDurationMetricsInner = cache(
  async (
    department: Department,
    options?: { range?: InsightsRange }
  ): Promise<DurationMetric[]> => {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase.rpc("compute_duration_metrics", {
      p_department: department,
      p_from: options?.range?.fromIso ?? null,
      p_to: options?.range?.toIso ?? null,
    });
    if (error) throw new Error(`compute_duration_metrics: ${error.message}`);

    const rows = (data ?? []) as Array<{
      metric_key: string;
      avg_days: number | string | null;
      median_days: number | string | null;
      sample_size: number;
    }>;
    const byKey = new Map(rows.map((r) => [r.metric_key, r]));

    return Object.entries(DURATION_METRIC_MAP)
      .sort((a, b) => a[1].order - b[1].order)
      .map(([key, meta]) => {
        const r = byKey.get(key);
        const avg = r?.avg_days == null ? null : Number(r.avg_days);
        const median = r?.median_days == null ? null : Number(r.median_days);
        return {
          label: meta.label,
          description: meta.description,
          avgDays: avg != null && Number.isFinite(avg) ? avg : null,
          medianDays:
            median != null && Number.isFinite(median) ? median : null,
          sampleSize: r ? Number(r.sample_size) || 0 : 0,
        };
      });
  }
);

export const loadDurationMetrics = (
  department: Department,
  options?: { range?: InsightsRange }
): Promise<DurationMetric[]> =>
  unstable_cache(
    () => loadDurationMetricsInner(department, options),
    [
      "loadDurationMetrics",
      department,
      options?.range?.fromIso ?? "",
      options?.range?.toIso ?? "",
    ],
    { revalidate: CACHE_TTL_S, tags: ["insights"] }
  )();

// ---------------------------------------------------------------------------
// Cashflow / Forderungsmanagement
// ---------------------------------------------------------------------------

export interface AgingBucket {
  bucket: string;
  minDays: number;
  maxDays: number | null;
  count: number;
  totalEur: number;
}

export interface CashflowRevenueByDepartmentPoint {
  month: string; // YYYY-MM
  PV: number;
  PV_GEWERBE: number;
  WP: number;
  KLIMA: number;
  GEBAEUDETECHNIK: number;
}

export interface InvoiceStatusBucket {
  /** Hero status_code: 0 Entwurf · 100 Erstellt · 200 Versendet · 600 Storniert · 1000 Gelöscht */
  statusCode: number;
  /** Menschlich lesbares Label, inkl. Erläuterung */
  label: string;
  description: string;
  count: number;
  totalEur: number;
  /**
   * Stornorechnungen (type = reversal_invoice, negative Werte) innerhalb
   * dieses Buckets. Sind in count + totalEur bereits saldiert enthalten —
   * werden hier separat ausgewiesen, damit der User sieht wie viel Storno
   * die Netto-Summe schon abzieht.
   */
  reversalCount: number;
  reversalEur: number;
}

export interface CashflowForecastBucket {
  /** Label für die UI, z. B. "0-7 Tage" oder "Überfällig". */
  bucket: string;
  /** Inklusive Untergrenze in Tagen relativ zu heute (kann negativ sein). */
  minDays: number;
  /** Exklusive Obergrenze (Überfällig geht effektiv bis -∞, >90 Tage bis +∞). */
  maxDays: number;
  /** Anzahl offener Projekte deren maturity_date in diesem Fenster liegt. */
  projectCount: number;
  /** Summe der offenen Rechnungen dieser Projekte. */
  openEur: number;
}

export interface CashflowDto {
  aging: AgingBucket[];
  pipelineRevenueEur: number;
  pipelineRevenueInvoices: number;
  billingRate: { billed: number; completed: number; percent: number };
  revenueByMonth: CashflowRevenueByDepartmentPoint[];
  totalOpenEur: number;
  totalOpenCount: number;
  /** Verteilung der Rechnungen nach Hero-Status (was ist mit denen passiert). */
  statusBreakdown: InvoiceStatusBucket[];
  /**
   * Forecast: offene Rechnungssummen nach Projekt-Fälligkeit (maturity_date).
   * Buckets: Überfällig / 0-7 / 8-14 / 15-30 / 31-60 / 61-90 / >90 Tage.
   */
  forecast: CashflowForecastBucket[];
}

const INVOICE_STATUS_META: Record<number, { label: string; description: string }> = {
  0: {
    label: "Entwurf",
    description: "noch nicht freigegeben, intern in Bearbeitung",
  },
  100: {
    label: "Erstellt / freigegeben",
    description: "freigegeben, aber noch nicht an den Kunden raus",
  },
  200: {
    label: "Versendet",
    description: "an den Kunden geschickt",
  },
  600: {
    label: "Storniert",
    description: "aktiv storniert, Stornorechnung",
  },
  1000: {
    label: "Gelöscht",
    description: "aus Hero entfernt / archiviert",
  },
};

const loadCashflowInner = cache(
  async (department: Department): Promise<CashflowDto> => {
    const supabase = supabaseAdmin();

    const [summaryResp, statusResp, forecastResp] = await Promise.all([
      supabase.rpc("compute_cashflow_summary", { p_department: department }),
      supabase.rpc("compute_invoice_status_breakdown", {
        p_department: department,
      }),
      supabase.rpc("compute_cashflow_forecast", { p_department: department }),
    ]);
    const { data, error } = summaryResp;
    if (error) throw new Error(`compute_cashflow_summary: ${error.message}`);

    const dto = (data ?? {}) as Partial<{
      aging: Array<{
        bucket: string;
        minDays: number;
        maxDays: number | null;
        count: number | string;
        totalEur: number | string;
      }>;
      totalOpenEur: number | string;
      totalOpenCount: number | string;
      pipelineRevenueEur: number | string;
      pipelineRevenueInvoices: number | string;
      billingRate: {
        billed: number | string;
        completed: number | string;
        percent: number | string;
      };
      revenueByMonth: Array<{
        month: string;
        PV: number | string;
        PV_GEWERBE: number | string;
        WP: number | string;
        KLIMA: number | string;
        GEBAEUDETECHNIK: number | string;
      }>;
    }>;

    const num = (v: number | string | null | undefined): number =>
      v == null ? 0 : Number(v) || 0;

    const statusRows = (statusResp.data ?? []) as Array<{
      status_code: number;
      count: number | string;
      total_eur: number | string;
      reversal_count: number | string | null;
      reversal_eur: number | string | null;
    }>;
    const statusBreakdown: InvoiceStatusBucket[] = statusRows.map((row) => {
      const meta = INVOICE_STATUS_META[row.status_code] ?? {
        label: `Status ${row.status_code}`,
        description: "unbekannter Hero-Status",
      };
      return {
        statusCode: row.status_code,
        label: meta.label,
        description: meta.description,
        count: num(row.count),
        totalEur: num(row.total_eur),
        reversalCount: num(row.reversal_count),
        reversalEur: num(row.reversal_eur),
      };
    });

    const forecastRows = (forecastResp.data ?? []) as Array<{
      bucket: string;
      min_days: number;
      max_days: number;
      project_count: number | string;
      open_eur: number | string;
    }>;
    const forecast: CashflowForecastBucket[] = forecastRows.map((row) => ({
      bucket: row.bucket,
      minDays: Number(row.min_days) || 0,
      maxDays: Number(row.max_days) || 0,
      projectCount: num(row.project_count),
      openEur: num(row.open_eur),
    }));

    return {
      aging: (dto.aging ?? []).map((a) => ({
        bucket: a.bucket,
        minDays: Number(a.minDays) || 0,
        maxDays: a.maxDays == null ? null : Number(a.maxDays),
        count: num(a.count),
        totalEur: num(a.totalEur),
      })),
      totalOpenEur: num(dto.totalOpenEur),
      totalOpenCount: num(dto.totalOpenCount),
      pipelineRevenueEur: num(dto.pipelineRevenueEur),
      pipelineRevenueInvoices: num(dto.pipelineRevenueInvoices),
      billingRate: {
        billed: num(dto.billingRate?.billed),
        completed: num(dto.billingRate?.completed),
        percent: num(dto.billingRate?.percent),
      },
      revenueByMonth: (dto.revenueByMonth ?? []).map((r) => ({
        month: r.month,
        PV: num(r.PV),
        PV_GEWERBE: num(r.PV_GEWERBE),
        WP: num(r.WP),
        KLIMA: num(r.KLIMA),
        GEBAEUDETECHNIK: num(r.GEBAEUDETECHNIK),
      })),
      statusBreakdown,
      forecast,
    };
  }
);

// ---------------------------------------------------------------------------
// Invoice Drill-Down pro Status
// ---------------------------------------------------------------------------

export interface InvoiceDetailRow {
  invoiceId: string;
  invoiceNr: string | null;
  invoiceType: string | null;
  documentTypeName: string | null;
  documentDate: string | null;
  createdAtHero: string | null;
  value: number;
  projectMatchId: string | null;
  projectNumber: string | null;
  projectName: string | null;
  customerName: string | null;
}

/**
 * Einzelrechnungen zu einem Hero-Status. Drill-Down hinter der
 * Status-Breakdown-Tabelle im Cash-Tab.
 */
export async function loadInvoicesByStatus(
  department: Department,
  statusCode: number,
  limit = 500
): Promise<InvoiceDetailRow[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.rpc("load_invoices_by_status", {
    p_department: department,
    p_status_code: statusCode,
    p_limit: limit,
  });
  if (error) {
    console.warn(
      `[hero-insights-queries] load_invoices_by_status failed: ${error.message}`
    );
    return [];
  }
  type DbRow = {
    invoice_id: string;
    invoice_nr: string | null;
    invoice_type: string | null;
    document_type_name: string | null;
    document_date: string | null;
    created_at_hero: string | null;
    value: number | string | null;
    project_match_id: string | null;
    project_number: string | null;
    project_name: string | null;
    customer_name: string | null;
  };
  const rows = (data ?? []) as DbRow[];
  return rows.map((r) => ({
    invoiceId: r.invoice_id,
    invoiceNr: r.invoice_nr,
    invoiceType: r.invoice_type,
    documentTypeName: r.document_type_name,
    documentDate: r.document_date,
    createdAtHero: r.created_at_hero,
    value: Number(r.value ?? 0) || 0,
    projectMatchId: r.project_match_id,
    projectNumber: r.project_number,
    projectName: cleanProjectTitle(r.project_name, {
      customerName: r.customer_name,
      projectNumber: r.project_number,
    }),
    customerName: r.customer_name,
  }));
}

export interface InvoiceAgingRow extends InvoiceDetailRow {
  ageDays: number;
  statusCode: number;
}

/**
 * Offene Rechnungen in einem Alters-Bucket (z. B. 30-60 Tage).
 * Drill-Down hinter der Forderungs-Aging-Tabelle im Cash-Tab.
 */
export async function loadInvoicesByAgingBucket(
  department: Department,
  minDays: number,
  maxDays: number | null,
  limit = 500
): Promise<InvoiceAgingRow[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.rpc("load_invoices_by_aging_bucket", {
    p_department: department,
    p_min_days: minDays,
    p_max_days: maxDays,
    p_limit: limit,
  });
  if (error) {
    console.warn(
      `[hero-insights-queries] load_invoices_by_aging_bucket failed: ${error.message}`
    );
    return [];
  }
  type DbRow = {
    invoice_id: string;
    invoice_nr: string | null;
    invoice_type: string | null;
    document_type_name: string | null;
    document_date: string | null;
    created_at_hero: string | null;
    age_days: number | null;
    status_code: number | null;
    value: number | string | null;
    project_match_id: string | null;
    project_number: string | null;
    project_name: string | null;
    customer_name: string | null;
  };
  const rows = (data ?? []) as DbRow[];
  return rows.map((r) => ({
    invoiceId: r.invoice_id,
    invoiceNr: r.invoice_nr,
    invoiceType: r.invoice_type,
    documentTypeName: r.document_type_name,
    documentDate: r.document_date,
    createdAtHero: r.created_at_hero,
    value: Number(r.value ?? 0) || 0,
    ageDays: Number(r.age_days ?? 0) || 0,
    statusCode: Number(r.status_code ?? 0) || 0,
    projectMatchId: r.project_match_id,
    projectNumber: r.project_number,
    projectName: cleanProjectTitle(r.project_name, {
      customerName: r.customer_name,
      projectNumber: r.project_number,
    }),
    customerName: r.customer_name,
  }));
}

export const loadCashflow = (department: Department): Promise<CashflowDto> =>
  unstable_cache(
    () => loadCashflowInner(department),
    ["loadCashflow", department],
    { revalidate: CACHE_TTL_S, tags: ["cash"] }
  )();

// ---------------------------------------------------------------------------
// Forecast-Drill-Down — Projekte hinter einem Forecast-Bucket
// ---------------------------------------------------------------------------

export interface ForecastProjectRow {
  projectMatchId: string;
  projectNumber: string | null;
  projectName: string | null;
  customerName: string | null;
  stepName: string | null;
  maturityDate: string | null;
  daysUntil: number;
  openAmount: number;
  openCount: number;
}

/**
 * Projekte in einem Forecast-Bucket (definiert durch Tage-Intervall).
 * min_days kann negativ sein (Überfällig-Bucket). max_days ist exklusiv.
 */
export async function loadForecastProjects(
  department: Department,
  minDays: number,
  maxDays: number,
  limit = 500
): Promise<ForecastProjectRow[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.rpc("load_forecast_projects", {
    p_department: department,
    p_min_days: minDays,
    p_max_days: maxDays,
    p_limit: limit,
  });
  if (error) {
    console.warn(
      `[hero-insights-queries] load_forecast_projects failed: ${error.message}`
    );
    return [];
  }
  type DbRow = {
    project_match_id: string;
    project_number: string | null;
    project_name: string | null;
    customer_name: string | null;
    step_name: string | null;
    maturity_date: string | null;
    days_until: number | string | null;
    open_amount: number | string | null;
    open_count: number | string | null;
  };
  const rows = (data ?? []) as DbRow[];
  return rows.map((r) => ({
    projectMatchId: r.project_match_id,
    projectNumber: r.project_number,
    projectName: cleanProjectTitle(r.project_name, {
      customerName: r.customer_name,
      projectNumber: r.project_number,
    }),
    customerName: r.customer_name,
    stepName: r.step_name,
    maturityDate: r.maturity_date,
    daysUntil: Number(r.days_until ?? 0) || 0,
    openAmount: Number(r.open_amount ?? 0) || 0,
    openCount: Number(r.open_count ?? 0) || 0,
  }));
}
