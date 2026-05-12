import { NextRequest, NextResponse } from "next/server";
import { loadMailTasksPage, type MailTabFilter, type MailTaskFilters } from "@/lib/supabase/mail-tasks-queries";

export const runtime = "nodejs";
export const maxDuration = 30;

function parseTab(v: string | null): MailTabFilter {
  if (v === "kritisch" || v === "infos" || v === "inbox") return v;
  return "aufgaben";
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tab = parseTab(searchParams.get("filter"));
    const filters: MailTaskFilters = {
      search: searchParams.get("search") ?? undefined,
      status: (searchParams.get("status") as MailTaskFilters["status"]) ?? undefined,
      priority: (searchParams.get("priority") as MailTaskFilters["priority"]) ?? undefined,
    };
    const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("page_size") ?? "50", 10)));

    const pageResult = await loadMailTasksPage(tab, page, pageSize, filters);

    return NextResponse.json({ entries: pageResult.entries, total: pageResult.total, page, pageSize, filter: tab });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
