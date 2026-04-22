import { NextRequest, NextResponse } from "next/server";

import {
  DASHBOARD_DEPARTMENTS,
  type Department,
} from "@/lib/dashboard/dashboard-types";
import {
  loadKpiProjects,
  type PipelineKpi,
  type TimeframeRangeIso,
} from "@/lib/supabase/hero-pipeline-queries";

export const runtime = "nodejs";
export const maxDuration = 10;

const VALID_KPIS: PipelineKpi[] = [
  "all_open",
  "overdue",
  "accounting_open",
  "completed_last_week",
  "new_this_week",
  "reopens",
  "delta_new",
  "delta_completed",
  "delta_accounting",
  "delta_rework",
  "delta_reopens",
  "delta_overdue_became",
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get("department") ?? "GESAMT";
    const kpi = searchParams.get("kpi") ?? "";

    if (!DASHBOARD_DEPARTMENTS.includes(department as Department)) {
      return NextResponse.json(
        { error: `unknown department: ${department}` },
        { status: 400 }
      );
    }
    if (!VALID_KPIS.includes(kpi as PipelineKpi)) {
      return NextResponse.json(
        { error: `unknown kpi: ${kpi}` },
        { status: 400 }
      );
    }

    const rangeFromIso = searchParams.get("rangeFrom");
    const rangeToIso = searchParams.get("rangeTo");
    const rangeDirection = searchParams.get("rangeDirection");
    const timeframeRange: TimeframeRangeIso | undefined =
      rangeFromIso && rangeToIso && rangeDirection
        ? {
            fromIso: rangeFromIso,
            toIso: rangeToIso,
            label: "",
            direction: rangeDirection === "future" ? "future" : "past",
          }
        : undefined;

    const projects = await loadKpiProjects(
      department as Department,
      kpi as PipelineKpi,
      timeframeRange ? { timeframeRange } : undefined
    );

    return NextResponse.json({ projects });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
