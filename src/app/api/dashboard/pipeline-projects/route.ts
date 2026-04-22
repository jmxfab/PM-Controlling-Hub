import { NextRequest, NextResponse } from "next/server";

import {
  DASHBOARD_DEPARTMENTS,
  type Department,
} from "@/lib/dashboard/dashboard-types";
import {
  loadProjectsForSteps,
  type TimeframeRangeIso,
} from "@/lib/supabase/hero-pipeline-queries";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get("department") ?? "GESAMT";
    const stepsParam = searchParams.get("steps") ?? "";

    if (!DASHBOARD_DEPARTMENTS.includes(department as Department)) {
      return NextResponse.json(
        { error: `unknown department: ${department}` },
        { status: 400 }
      );
    }

    // Steps are separated by `||` because step_group values may contain
    // commas (e.g. "Nacharbeiten, nicht terminiert"). Legacy comma input
    // still works for single-step selections.
    const stepKeys = stepsParam
      .split(stepsParam.includes("||") ? "||" : ",")
      .map((value) => value.trim())
      .filter(Boolean);

    // Optional: Timeframe mitgeben damit pro Projekt "neu im Zeitraum" /
    // "abgeschlossen im Zeitraum" Flags gesetzt werden.
    const rangeFromIso = searchParams.get("rangeFrom");
    const rangeToIso = searchParams.get("rangeTo");
    const rangeDirection = searchParams.get("rangeDirection");
    const timeframeRange: TimeframeRangeIso | undefined =
      rangeFromIso && rangeToIso && rangeDirection
        ? {
            fromIso: rangeFromIso,
            toIso: rangeToIso,
            label: "",
            direction:
              rangeDirection === "future" ? "future" : "past",
          }
        : undefined;

    const projects = await loadProjectsForSteps(
      department as Department,
      stepKeys,
      timeframeRange ? { timeframeRange } : undefined
    );

    return NextResponse.json({ projects });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
