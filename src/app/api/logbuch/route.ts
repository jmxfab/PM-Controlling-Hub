import { NextRequest, NextResponse } from "next/server";
import {
  loadLogbuchPage,
  loadLogbuchAggregations,
  type LogbuchFilters,
} from "@/lib/supabase/hero-logbuch-queries";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const filters: LogbuchFilters = {
      userEmail: searchParams.get("user_email") ?? undefined,
      projectId: searchParams.get("project_id") ?? undefined,
      eventType: searchParams.get("event_type") ?? undefined,
      dateFrom: searchParams.get("date_from") ?? undefined,
      dateTo: searchParams.get("date_to") ?? undefined,
    };

    const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10));
    const pageSize = Math.min(
      200,
      Math.max(1, parseInt(searchParams.get("page_size") ?? "100", 10))
    );

    const [pageResult, aggregations] = await Promise.all([
      loadLogbuchPage(filters, page, pageSize),
      loadLogbuchAggregations(filters),
    ]);

    return NextResponse.json({
      entries: pageResult.entries,
      total: pageResult.total,
      page,
      pageSize,
      aggregations,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
