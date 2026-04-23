import { NextRequest, NextResponse } from "next/server";

import {
  DASHBOARD_DEPARTMENTS,
  type Department,
} from "@/lib/dashboard/dashboard-types";
import { loadInvoicesByAgingBucket } from "@/lib/supabase/hero-insights-queries";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get("department") ?? "GESAMT";
    const minDaysRaw = searchParams.get("minDays") ?? "0";
    const maxDaysRaw = searchParams.get("maxDays");

    if (!DASHBOARD_DEPARTMENTS.includes(department as Department)) {
      return NextResponse.json(
        { error: `unknown department: ${department}` },
        { status: 400 }
      );
    }
    const minDays = Number.parseInt(minDaysRaw, 10);
    if (!Number.isFinite(minDays) || minDays < 0) {
      return NextResponse.json(
        { error: `invalid minDays: ${minDaysRaw}` },
        { status: 400 }
      );
    }
    let maxDays: number | null = null;
    if (maxDaysRaw !== null && maxDaysRaw !== "") {
      const parsed = Number.parseInt(maxDaysRaw, 10);
      if (!Number.isFinite(parsed) || parsed <= minDays) {
        return NextResponse.json(
          { error: `invalid maxDays: ${maxDaysRaw}` },
          { status: 400 }
        );
      }
      maxDays = parsed;
    }

    const invoices = await loadInvoicesByAgingBucket(
      department as Department,
      minDays,
      maxDays
    );
    return NextResponse.json({ invoices });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
