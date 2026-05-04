import "server-only";

import { cache } from "react";
import { createClient } from "@supabase/supabase-js";

import {
  GESAMT_DEPARTMENT_KEYS_ARR,
  type Department,
} from "@/lib/dashboard/dashboard-types";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase creds");
  return createClient(url, key);
}

export interface DeckungsbeitragRow {
  projectMatchId: string;
  projectNumber: string | null;
  projectName: string | null;
  customerName: string | null;
  departmentKey: string | null;
  revenue: number;
  costs: number;
  marginEur: number;
  marginPct: number | null;
}

export interface DeckungsbeitragDto {
  rows: DeckungsbeitragRow[];
  totalRevenue: number;
  totalCosts: number;
  totalMarginEur: number;
  totalMarginPct: number | null;
  projectsWithCosts: number;
  projectsWithRevenue: number;
}

export const loadDeckungsbeitrag = cache(
  async (department: Department): Promise<DeckungsbeitragDto> => {
    const supabase = supabaseAdmin();

    // 1. Projects with their accounting_amount (= invoiced revenue)
    let projQuery = supabase
      .from("hero_dashboard_projects")
      .select("id, project_number, project_name, customer_name, department_key, accounting_amount")
      .eq("is_finished", true);

    if (department !== "GESAMT") projQuery = projQuery.eq("department_key", department);
    else projQuery = projQuery.in("department_key", GESAMT_DEPARTMENT_KEYS_ARR);

    const projRows: Array<{
      id: string;
      project_number: string | null;
      project_name: string | null;
      customer_name: string | null;
      department_key: string | null;
      accounting_amount: number | null;
    }> = [];
    for (let offset = 0; offset < 20000; offset += 1000) {
      const { data, error } = await projQuery.range(offset, offset + 999);
      if (error) break;
      const chunk = (data ?? []) as typeof projRows;
      projRows.push(...chunk);
      if (chunk.length < 1000) break;
    }

    const projectIds = projRows.map((p) => p.id);
    if (projectIds.length === 0) {
      return {
        rows: [],
        totalRevenue: 0,
        totalCosts: 0,
        totalMarginEur: 0,
        totalMarginPct: null,
        projectsWithCosts: 0,
        projectsWithRevenue: 0,
      };
    }

    // 2. Cost entries — gracefully handle missing table
    const costMap = new Map<string, number>();
    try {
      const { data: costData, error: costError } = await supabase
        .from("material_cost_entries")
        .select("project_match_id, cost_amount")
        .in("project_match_id", projectIds);

      if (!costError && costData) {
        for (const c of costData as Array<{
          project_match_id: string;
          cost_amount: number;
        }>) {
          costMap.set(
            c.project_match_id,
            (costMap.get(c.project_match_id) ?? 0) + c.cost_amount
          );
        }
      }
    } catch {
      // table not yet migrated — show revenue-only view
    }

    // 3. Build rows
    const rows: DeckungsbeitragRow[] = projRows
      .filter((p) => (p.accounting_amount ?? 0) > 0 || costMap.has(p.id))
      .map((p) => {
        const revenue = p.accounting_amount ?? 0;
        const costs = costMap.get(p.id) ?? 0;
        const marginEur = revenue - costs;
        const marginPct =
          revenue > 0 ? Math.round((marginEur / revenue) * 1000) / 10 : null;
        return {
          projectMatchId: p.id,
          projectNumber: p.project_number,
          projectName: p.project_name,
          customerName: p.customer_name,
          departmentKey: p.department_key,
          revenue,
          costs,
          marginEur,
          marginPct,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
    const totalCosts = rows.reduce((s, r) => s + r.costs, 0);
    const totalMarginEur = totalRevenue - totalCosts;
    const totalMarginPct =
      totalRevenue > 0
        ? Math.round((totalMarginEur / totalRevenue) * 1000) / 10
        : null;

    return {
      rows,
      totalRevenue,
      totalCosts,
      totalMarginEur,
      totalMarginPct,
      projectsWithCosts: rows.filter((r) => r.costs > 0).length,
      projectsWithRevenue: rows.filter((r) => r.revenue > 0).length,
    };
  }
);
