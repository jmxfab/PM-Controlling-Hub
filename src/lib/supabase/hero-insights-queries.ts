import "server-only";

import { cache } from "react";
import { createClient } from "@supabase/supabase-js";

import {
  HERO_TYPE_ID_TO_DEPARTMENT,
  type Department,
} from "@/lib/dashboard/dashboard-types";

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
export const loadWeeklyThroughput = cache(
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
    const untilIso = range?.toIso;

    let query = supabase
      .from("hero_status_transitions")
      .select("project_match_id, step_name, entered_at, history_index, department_key")
      .gte("entered_at", sinceIso);
    if (untilIso) query = query.lt("entered_at", untilIso);

    if (department !== "GESAMT") {
      query = query.eq("department_key", department);
    } else {
      query = query.not("department_key", "is", null);
    }

    const rows: Array<{
      project_match_id: string;
      step_name: string | null;
      entered_at: string;
      history_index: number;
    }> = [];
    for (let offset = 0; offset < 20000; offset += 1000) {
      const { data, error } = await query
        .range(offset, offset + 999)
        .order("entered_at", { ascending: true });
      if (error) break;
      const chunk = (data ?? []) as typeof rows;
      rows.push(...chunk);
      if (chunk.length < 1000) break;
    }

    // Für Reopen-Erkennung: welche Projekte hatten VOR der ersten Transition
    // im Fenster bereits ein last_finish_at.
    const { data: finishedPriorList } = await supabase
      .from("hero_dashboard_projects")
      .select("id, last_finish_at")
      .lt("last_finish_at", sinceIso);
    const finishedBefore = new Set<string>(
      ((finishedPriorList ?? []) as Array<{ id: string; last_finish_at: string | null }>)
        .filter((r) => r.last_finish_at)
        .map((r) => r.id)
    );

    const weekKeys = new Map<string, WeeklyThroughputPoint>();

    function weekKeyFor(iso: string): string {
      // Montag-Start (ISO week), konsistent zu date_trunc('week')
      const d = new Date(iso);
      const day = d.getDay(); // 0=So
      const diffToMonday = (day + 6) % 7;
      d.setDate(d.getDate() - diffToMonday);
      d.setHours(0, 0, 0, 0);
      return d.toISOString().slice(0, 10);
    }

    for (const t of rows) {
      if (!t.step_name) continue;
      const key = weekKeyFor(t.entered_at);
      const bucket =
        weekKeys.get(key) ??
        {
          weekStart: key,
          newProjects: 0,
          completed: 0,
          accounting: 0,
          rework: 0,
          reopens: 0,
        };
      const n = t.step_name.toLowerCase();
      if (t.history_index === 1) bucket.newProjects += 1;
      if (/abgeschlossen|archiviert/.test(n)) bucket.completed += 1;
      if (/abschlussrechnung|kundenrechnung|schlussrechnung|teil-rg|teilrechnung/.test(n)) {
        bucket.accounting += 1;
      }
      if (/nacharbeit|reklamation/.test(n)) {
        bucket.rework += 1;
        if (finishedBefore.has(t.project_match_id)) bucket.reopens += 1;
      }
      weekKeys.set(key, bucket);
    }

    return Array.from(weekKeys.values()).sort((a, b) =>
      a.weekStart.localeCompare(b.weekStart)
    );
  }
);

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
export const loadStepDurations = cache(
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

    let query = supabase
      .from("hero_status_transitions")
      .select("step_id, step_name, duration_seconds, department_key")
      .gte("entered_at", sinceIso)
      .not("duration_seconds", "is", null)
      .not("step_name", "is", null);
    if (range?.toIso) query = query.lt("entered_at", range.toIso);

    if (department !== "GESAMT") {
      query = query.eq("department_key", department);
    } else {
      query = query.not("department_key", "is", null);
    }

    const rows: Array<{
      step_id: string | null;
      step_name: string | null;
      duration_seconds: number | null;
    }> = [];
    for (let offset = 0; offset < 30000; offset += 1000) {
      const { data, error } = await query.range(offset, offset + 999);
      if (error) break;
      const chunk = (data ?? []) as typeof rows;
      rows.push(...chunk);
      if (chunk.length < 1000) break;
    }

    const grouped = new Map<string, { name: string; durations: number[] }>();
    for (const r of rows) {
      if (r.step_id == null || r.step_name == null || r.duration_seconds == null) continue;
      const entry = grouped.get(r.step_id) ?? {
        name: r.step_name,
        durations: [],
      };
      entry.durations.push(r.duration_seconds / 86400); // Tage
      grouped.set(r.step_id, entry);
    }

    const out: StepDurationRow[] = [];
    for (const [id, { name, durations }] of grouped) {
      if (durations.length === 0) continue;
      const sorted = [...durations].sort((a, b) => a - b);
      const avg = durations.reduce((s, v) => s + v, 0) / durations.length;
      const median = sorted[Math.floor(sorted.length / 2)];
      out.push({
        stepId: id,
        stepName: name,
        avgDays: Math.round(avg * 10) / 10,
        medianDays: Math.round(median * 10) / 10,
        sampleSize: durations.length,
      });
    }
    return out.sort((a, b) => b.avgDays - a.avgDays);
  }
);

/**
 * Longest-running open projects (derzeit offene Projekte mit hohem Alter).
 */
export const loadLongestRunning = cache(
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
      projectName: r.project_name,
      stepName: r.step_name,
      customerName: r.customer_name,
      createdAtHero: r.created_at_hero,
      ageDays: r.created_at_hero
        ? Math.round((now - Date.parse(r.created_at_hero)) / 86400000)
        : 0,
    }));
  }
);

export { typeIdsFor };

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
export const loadDurationMetrics = cache(
  async (
    department: Department,
    options?: { range?: InsightsRange }
  ): Promise<DurationMetric[]> => {
    const supabase = supabaseAdmin();
    let query = supabase
      .from("hero_dashboard_projects")
      .select("id, created_at_hero, completion_date, raw, department_key");

    if (department !== "GESAMT") query = query.eq("department_key", department);
    else query = query.not("department_key", "is", null);

    const rows: Array<{
      id: string;
      created_at_hero: string | null;
      completion_date: string | null;
      raw: Record<string, unknown> | null;
    }> = [];
    for (let offset = 0; offset < 10000; offset += 1000) {
      const { data, error } = await query.range(offset, offset + 999);
      if (error) break;
      const chunk = (data ?? []) as typeof rows;
      rows.push(...chunk);
      if (chunk.length < 1000) break;
    }

    const fromTs = options?.range?.fromIso
      ? new Date(options.range.fromIso).getTime()
      : null;
    const toTs = options?.range?.toIso
      ? new Date(options.range.toIso).getTime()
      : null;

    // Per Projekt: aus raw.project_match_statuses die earliest entered_at für
    // AB / Montage / Abschlussrechnung extrahieren, dann 4 Differenzen bilden.
    const rampUps: number[] = [];
    const ausfuehrungen: number[] = [];
    const abrechnungen: number[] = [];
    const gesamt: number[] = [];

    for (const r of rows) {
      const raw = r.raw ?? {};
      const statuses =
        ((raw as Record<string, unknown>).project_match_statuses as
          | Array<{ step?: { name?: string | null }; created?: string | null }>
          | undefined) ?? [];

      // erste Transition in jeweiligen Step — Keywords tolerant
      const first = (re: RegExp): number | null => {
        for (const s of statuses) {
          const name = s.step?.name?.toLowerCase() ?? "";
          if (re.test(name) && s.created) {
            const ts = Date.parse(s.created);
            if (Number.isFinite(ts)) return ts;
          }
        }
        return null;
      };

      const tAB = first(/auftragsbestätigung|^ab$|\bab\b/);
      const tMontage = first(
        /montage|zählermontage|projektvorbereitung|umsetzungsbeginn|projektplanung|heizlastberechnung/
      );
      const tAbschluss = first(/abschlussrechnung|kundenrechnung|schlussrechnung/);
      const tCreate = r.created_at_hero ? Date.parse(r.created_at_hero) : null;
      const tDone = r.completion_date ? Date.parse(r.completion_date) : null;

      // Range-Filter auf completion_date (abgeschlossene Projekte)
      if (tDone != null) {
        if (fromTs != null && tDone < fromTs) continue;
        if (toTs != null && tDone >= toTs) continue;
      } else if (fromTs != null) {
        // noch offen → im Zeitraum nicht abgeschlossen → skip
        continue;
      }

      if (tAB != null && tMontage != null && tMontage > tAB)
        rampUps.push((tMontage - tAB) / 86400000);
      if (tMontage != null && tAbschluss != null && tAbschluss > tMontage)
        ausfuehrungen.push((tAbschluss - tMontage) / 86400000);
      if (tAbschluss != null && tDone != null && tDone > tAbschluss)
        abrechnungen.push((tDone - tAbschluss) / 86400000);
      if (tCreate != null && tDone != null && tDone > tCreate)
        gesamt.push((tDone - tCreate) / 86400000);
    }

    const stat = (arr: number[]) => {
      if (arr.length === 0) return { avg: null, median: null, n: 0 };
      const sorted = [...arr].sort((a, b) => a - b);
      const avg = arr.reduce((s, v) => s + v, 0) / arr.length;
      const median = sorted[Math.floor(sorted.length / 2)];
      return {
        avg: Math.round(avg * 10) / 10,
        median: Math.round(median * 10) / 10,
        n: arr.length,
      };
    };

    const mk = (
      label: string,
      description: string,
      arr: number[]
    ): DurationMetric => {
      const s = stat(arr);
      return {
        label,
        avgDays: s.avg,
        medianDays: s.median,
        sampleSize: s.n,
        description,
      };
    };

    return [
      mk(
        "Ramp-up (AB → Montage)",
        "Von Auftragsbestätigung bis Start der Montage.",
        rampUps
      ),
      mk(
        "Ausführung (Montage → Abschlussrechnung)",
        "Wie lange dauert die Montage bis zur Abschlussrechnung.",
        ausfuehrungen
      ),
      mk(
        "Abrechnungsverzug (Abschlussrechnung → Abgeschlossen)",
        "Wie lange nach der Rechnungsstellung bis zum Abschluss des Projekts.",
        abrechnungen
      ),
      mk(
        "Gesamtdurchlaufzeit (Anlage → Abgeschlossen)",
        "End-to-End: vom Anlegen in Hero bis Projekt abgeschlossen.",
        gesamt
      ),
    ];
  }
);

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

const BUCKET_DEFS: Array<{ label: string; min: number; max: number | null }> = [
  { label: "0–14 Tage", min: 0, max: 14 },
  { label: "14–30 Tage", min: 14, max: 30 },
  { label: "30–60 Tage", min: 30, max: 60 },
  { label: "60–90 Tage", min: 60, max: 90 },
  { label: "> 90 Tage", min: 90, max: null },
];

export const loadCashflow = cache(
  async (department: Department): Promise<CashflowDto> => {
    const supabase = supabaseAdmin();

    // 1. Alle offenen Rechnungen (status_code 100/200) mit Zeitstempel
    let docQuery = supabase
      .from("hero_customer_documents")
      .select(
        "project_match_id, value, status_code, created_at_hero, hero_modified_at, type, document_type_name, document_base_type"
      )
      .eq("is_deleted", false)
      .in("status_code", [100, 200])
      .not("value", "is", null)
      .not("project_match_id", "is", null);

    const docRows: Array<{
      project_match_id: string;
      value: number | null;
      created_at_hero: string | null;
      type: string | null;
      document_type_name: string | null;
      document_base_type: string | null;
    }> = [];
    for (let offset = 0; offset < 30000; offset += 1000) {
      const { data, error } = await docQuery.range(offset, offset + 999);
      if (error) break;
      const chunk = (data ?? []) as typeof docRows;
      docRows.push(...chunk);
      if (chunk.length < 1000) break;
    }
    void docQuery;

    // 2. Join mit Department + Step (aus hero_dashboard_projects)
    let projQuery = supabase
      .from("hero_dashboard_projects")
      .select("id, department_key, step_name, is_finished, is_accounting_open");
    if (department !== "GESAMT") projQuery = projQuery.eq("department_key", department);
    else projQuery = projQuery.not("department_key", "is", null);

    const projRows: Array<{
      id: string;
      department_key: string | null;
      step_name: string | null;
      is_finished: boolean;
      is_accounting_open: boolean;
    }> = [];
    for (let offset = 0; offset < 20000; offset += 1000) {
      const { data, error } = await projQuery.range(offset, offset + 999);
      if (error) break;
      const chunk = (data ?? []) as typeof projRows;
      projRows.push(...chunk);
      if (chunk.length < 1000) break;
    }
    const projMap = new Map(projRows.map((p) => [p.id, p]));

    // Nur Invoices zu Projekten aus dem aktuellen Department behalten.
    const relevantDocs = docRows.filter((d) => projMap.has(d.project_match_id));

    // 3. Invoice-Filter: nur echte Rechnungen (invoice/rechnung keyword)
    const invoiceDocs = relevantDocs.filter((d) => {
      const t = `${d.type ?? ""} ${d.document_type_name ?? ""} ${d.document_base_type ?? ""}`.toLowerCase();
      return t.includes("invoice") || t.includes("rechnung");
    });

    // 4. Aging Buckets
    const now = Date.now();
    const buckets: AgingBucket[] = BUCKET_DEFS.map((b) => ({
      bucket: b.label,
      minDays: b.min,
      maxDays: b.max,
      count: 0,
      totalEur: 0,
    }));
    let totalOpenEur = 0;
    let totalOpenCount = 0;
    for (const d of invoiceDocs) {
      if (d.value == null) continue;
      const created = d.created_at_hero ? Date.parse(d.created_at_hero) : null;
      if (!created || !Number.isFinite(created)) continue;
      const ageDays = (now - created) / 86400000;
      totalOpenEur += d.value;
      totalOpenCount += 1;
      const b =
        buckets.find(
          (x) =>
            ageDays >= x.minDays &&
            (x.maxDays == null || ageDays < x.maxDays)
        ) ?? buckets[buckets.length - 1];
      b.count += 1;
      b.totalEur += d.value;
    }

    // 5. Pipeline-Umsatz: Projekte die aktuell in Abschluss-/Montage-Step stehen
    const pipelineProjectIds = new Set(
      projRows
        .filter((p) => {
          const n = (p.step_name ?? "").toLowerCase();
          return (
            p.is_accounting_open ||
            /montage|zählermontage|umsetzungsbeginn/.test(n)
          );
        })
        .map((p) => p.id)
    );
    let pipelineRevenueEur = 0;
    let pipelineRevenueInvoices = 0;
    for (const d of invoiceDocs) {
      if (pipelineProjectIds.has(d.project_match_id) && d.value != null) {
        pipelineRevenueEur += d.value;
        pipelineRevenueInvoices += 1;
      }
    }

    // 6. Abrechnungsquote: Anteil abgeschlossener Projekte die mindestens
    //    eine Invoice haben (Status unabhängig).
    const completedProjects = projRows.filter((p) => p.is_finished);
    const projectsWithInvoice = new Set(
      relevantDocs.map((d) => d.project_match_id)
    );
    const completedWithInvoice = completedProjects.filter((p) =>
      projectsWithInvoice.has(p.id)
    );
    const billingRate = {
      billed: completedWithInvoice.length,
      completed: completedProjects.length,
      percent:
        completedProjects.length === 0
          ? 0
          : Math.round(
              (completedWithInvoice.length / completedProjects.length) * 1000
            ) / 10,
    };

    // 7. Umsatz nach Department + Monat — über ALLE Invoices (auch historisch).
    //    Wir nutzen hierzu alle invoiceDocs incl. der Department-Zuordnung.
    const monthMap = new Map<string, CashflowRevenueByDepartmentPoint>();
    for (const d of invoiceDocs) {
      const created = d.created_at_hero ? new Date(d.created_at_hero) : null;
      if (!created || Number.isNaN(created.getTime())) continue;
      const month = created.toISOString().slice(0, 7);
      const dept = projMap.get(d.project_match_id)?.department_key;
      if (!dept) continue;
      const bucket =
        monthMap.get(month) ??
        ({
          month,
          PV: 0,
          PV_GEWERBE: 0,
          WP: 0,
          KLIMA: 0,
          GEBAEUDETECHNIK: 0,
        } as CashflowRevenueByDepartmentPoint);
      (bucket as unknown as Record<string, number>)[dept] += d.value ?? 0;
      monthMap.set(month, bucket);
    }
    const revenueByMonth = Array.from(monthMap.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);

    return {
      aging: buckets,
      pipelineRevenueEur,
      pipelineRevenueInvoices,
      billingRate,
      revenueByMonth,
      totalOpenEur,
      totalOpenCount,
    };
  }
);
