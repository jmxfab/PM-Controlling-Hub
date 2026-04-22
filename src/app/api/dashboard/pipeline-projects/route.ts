import { NextRequest, NextResponse } from "next/server";

import {
  DASHBOARD_DEPARTMENTS,
  type Department,
} from "@/lib/dashboard/dashboard-types";
import { loadProjectsForSteps } from "@/lib/supabase/hero-pipeline-queries";

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

    const stepIds = stepsParam
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    const projects = await loadProjectsForSteps(
      department as Department,
      stepIds
    );

    return NextResponse.json({ projects });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
