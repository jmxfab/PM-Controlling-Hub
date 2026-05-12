import { NextRequest, NextResponse } from "next/server";
import { loadMailTasksPage } from "@/lib/supabase/mail-tasks-queries";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? "";
    const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("page_size") ?? "50", 10)));

    const pageResult = await loadMailTasksPage(page, pageSize, search);

    return NextResponse.json({ entries: pageResult.entries, total: pageResult.total, page, pageSize });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
