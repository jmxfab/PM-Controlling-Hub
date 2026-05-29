import { NextRequest, NextResponse } from "next/server";

import {
  DASHBOARD_DEPARTMENTS,
  type Department,
} from "@/lib/dashboard/dashboard-types";
import { loadForecastProjects } from "@/lib/supabase/hero-insights-queries";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get("department") ?? "GESAMT";
    const minDaysRaw = searchParams.get("minDays") ?? "";
    const maxDaysRaw = searchParams.get("maxDays") ?? "";

    if (!DASHBOARD_DEPARTMENTS.includes(department as Department)) {
      return NextResponse.json(
        { error: `unknown department: ${department}` },
        { status: 400 }
      );
    }
    const minDays = Number.parseInt(minDaysRaw, 10);
    const maxDays = Number.parseInt(maxDaysRaw, 10);
    if (!Number.isFinite(minDays) || !Number.isFinite(maxDays)) {
      return NextResponse.json(
        { error: `invalid minDays/maxDays: ${minDaysRaw}/${maxDaysRaw}` },
        { status: 400 }
      );
    }
    if (maxDays <= minDays) {
      return NextResponse.json(
        { error: "maxDays must be greater than minDays" },
        { status: 400 }
      );
    }

    const projects = await loadForecastProjects(
      department as Department,
      minDays,
      maxDays
    );
    return NextResponse.json({ projects });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
