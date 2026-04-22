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

/**
 * Wöchentliche Flow-Raten pro Department für die letzten 12 Wochen.
 * Basiert auf hero_status_transitions (mit finished_before für Reopens).
 */
export const loadWeeklyThroughput = cache(
  async (department: Department, weeks = 12): Promise<WeeklyThroughputPoint[]> => {
    const supabase = supabaseAdmin();
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - weeks * 7);
    const sinceIso = sinceDate.toISOString();

    let query = supabase
      .from("hero_status_transitions")
      .select("project_match_id, step_name, entered_at, history_index, department_key")
      .gte("entered_at", sinceIso);

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
 * Durchschnittliche + mediane Verweildauer pro Step (letzte 12 Monate).
 * Für Bottleneck-Analyse.
 */
export const loadStepDurations = cache(
  async (department: Department): Promise<StepDurationRow[]> => {
    const supabase = supabaseAdmin();
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);

    let query = supabase
      .from("hero_status_transitions")
      .select("step_id, step_name, duration_seconds, department_key")
      .gte("entered_at", cutoff.toISOString())
      .not("duration_seconds", "is", null)
      .not("step_name", "is", null);

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
