import { NextRequest, NextResponse } from "next/server";

import {
  DASHBOARD_DEPARTMENTS,
  type Department,
} from "@/lib/dashboard/dashboard-types";
import { loadInvoicesByStatus } from "@/lib/supabase/hero-insights-queries";

export const runtime = "nodejs";
export const maxDuration = 10;

const VALID_STATUS_CODES = [0, 100, 200, 600, 1000] as const;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get("department") ?? "GESAMT";
    const statusRaw = searchParams.get("status") ?? "";
    const statusCode = Number.parseInt(statusRaw, 10);

    if (!DASHBOARD_DEPARTMENTS.includes(department as Department)) {
      return NextResponse.json(
        { error: `unknown department: ${department}` },
        { status: 400 }
      );
    }
    if (!VALID_STATUS_CODES.includes(statusCode as (typeof VALID_STATUS_CODES)[number])) {
      return NextResponse.json(
        { error: `unknown status_code: ${statusRaw}` },
        { status: 400 }
      );
    }

    const invoices = await loadInvoicesByStatus(
      department as Department,
      statusCode
    );
    return NextResponse.json({ invoices });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
