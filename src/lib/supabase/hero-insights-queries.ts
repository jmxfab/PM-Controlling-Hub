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
    }>
  > => {
    const supabase = supabaseAdmin();
    let query = supabase
      .from("hero_dashboard_projects")
      .select("id, project_number, project_name, step_name, customer_name, created_at_hero, department_key, is_finished")
      .eq("is_finished", false)
      .not("created_at_hero", "is", null);
    if (department !== "GESAMT") query = query.eq("department_key", department);
    else query = query.not("department_key", "is", null);

    const { data } = await query.order("created_at_hero", { ascending: true }).limit(limit);
    const rows = (data ?? []) as Array<{
      id: string;
      project_number: string | null;
      project_name: string | null;
      step_name: string | null;
      customer_name: string | null;
      created_at_hero: string | null;
    }>;
    const now = Date.now();
    return rows.map((r) => ({
      id: r.id,
      projectNumber: r.project_number,
      projectName: cleanProjectTitle(r.project_name, {
        customerName: r.customer_name,
        projectNumber: r.project_number,
      }),
      stepName: r.step_name,
      customerName: r.customer_name,
      createdAtHero: r.created_at_hero,
      ageDays: r.created_at_hero
        ? Math.round((now - Date.parse(r.created_at_hero)) / 86400000)
        : 0,
    }));
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

export interface CashflowDto {
  aging: AgingBucket[];
  pipelineRevenueEur: number;
  pipelineRevenueInvoices: number;
  billingRate: { billed: number; completed: number; percent: number };
  revenueByMonth: CashflowRevenueByDepartmentPoint[];
  totalOpenEur: number;
  totalOpenCount: number;
}

const loadCashflowInner = cache(
  async (department: Department): Promise<CashflowDto> => {
    const supabase = supabaseAdmin();

    const { data, error } = await supabase.rpc("compute_cashflow_summary", {
      p_department: department,
    });
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
    };
  }
);

export const loadCashflow = (department: Department): Promise<CashflowDto> =>
  unstable_cache(
    () => loadCashflowInner(department),
    ["loadCashflow", department],
    { revalidate: CACHE_TTL_S, tags: ["cash"] }
  )();
