import { NextRequest, NextResponse } from "next/server";
import { loadAufgabenPage, loadAufgabenStats } from "@/lib/supabase/hero-aufgaben-queries";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") ?? undefined;
    const onlyUnread = searchParams.get("unread") === "1";
    const search = searchParams.get("search") ?? undefined;
    const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("page_size") ?? "50", 10)));

    const [pageResult, stats] = await Promise.all([
      loadAufgabenPage({ category, onlyUnread, search }, page, pageSize),
      loadAufgabenStats(),
    ]);

    return NextResponse.json({ entries: pageResult.entries, total: pageResult.total, page, pageSize, stats });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
