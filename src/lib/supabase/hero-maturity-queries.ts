import "server-only";

import { cache } from "react";
import { createClient } from "@supabase/supabase-js";

import {
  HERO_TYPE_ID_TO_DEPARTMENT,
  type Department,
  type ProjectDepartment,
} from "@/lib/dashboard/dashboard-types";
import { cleanProjectTitle } from "@/lib/hero/project-title";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase creds");
  return createClient(url, key);
}

export interface UpcomingProject {
  id: string;
  projectNumber: string | null;
  projectName: string | null;
  customerName: string | null;
  stepName: string | null;
  maturityDate: string | null;
  department: ProjectDepartment | null;
  isOverdue: boolean;
  daysUntilDue: number;
}

/**
 * Projekte deren maturity_date in einem Zeitfenster liegt — sortiert nach
 * Fälligkeit (überfällig und heute zuerst). Für die Planungsansicht.
 */
export const loadUpcomingProjects = cache(
  async (
    department: Department,
    fromIso: string,
    toIso: string
  ): Promise<UpcomingProject[]> => {
    const supabase = supabaseAdmin();
    const typeIds =
      department === "GESAMT"
        ? Object.keys(HERO_TYPE_ID_TO_DEPARTMENT)
        : Object.entries(HERO_TYPE_ID_TO_DEPARTMENT)
            .filter(([, d]) => d === department)
            .map(([id]) => id);

    let query = supabase
      .from("hero_dashboard_projects")
      .select("id, project_number, project_name, customer_name, step_name, maturity_date, department_key, is_finished")
      .eq("is_finished", false)
      .not("maturity_date", "is", null)
      .gte("maturity_date", fromIso)
      .lt("maturity_date", toIso);

    if (department !== "GESAMT") {
      query = query.eq("department_key", department);
    } else {
      query = query.in("department_key", typeIds.map(() => "").filter((_, i) => i === 0)
        ? ["PV", "PV_GEWERBE", "WP", "KLIMA", "GEBAEUDETECHNIK"]
        : ["PV", "PV_GEWERBE", "WP", "KLIMA", "GEBAEUDETECHNIK"]);
    }

    const { data, error } = await query
      .order("maturity_date", { ascending: true })
      .limit(500);

    if (error) return [];

    const now = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();

    return ((data ?? []) as Array<{
      id: string;
      project_number: string | null;
      project_name: string | null;
      customer_name: string | null;
      step_name: string | null;
      maturity_date: string | null;
      department_key: string | null;
    }>).map((r) => {
      const dueTs = r.maturity_date ? Date.parse(r.maturity_date) : null;
      const isOverdue = dueTs != null && dueTs < now;
      const daysUntilDue =
        dueTs != null ? Math.round((dueTs - todayTs) / 86400000) : 0;
      return {
        id: r.id,
        projectNumber: r.project_number,
        projectName: cleanProjectTitle(r.project_name, {
          customerName: r.customer_name,
          projectNumber: r.project_number,
        }),
        customerName: r.customer_name,
        stepName: r.step_name,
        maturityDate: r.maturity_date,
        department: (r.department_key ?? null) as ProjectDepartment | null,
        isOverdue,
        daysUntilDue,
      };
    });
  }
);
