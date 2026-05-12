import { NextRequest, NextResponse } from "next/server";
import {
  loadMailTasksPage,
  heroToMailItem,
  type MailTabFilter,
  type MailTaskFilters,
} from "@/lib/supabase/mail-tasks-queries";
import { loadHeroComments } from "@/lib/supabase/hero-comments-queries";

export const runtime = "nodejs";
export const maxDuration = 30;

function parseTab(v: string | null): MailTabFilter {
  if (v === "kritisch" || v === "infos" || v === "inbox" || v === "rechnungen") return v;
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

    const mailResult = await loadMailTasksPage(tab, page, pageSize, filters);

    // Hero-Kommentare nur in 'aufgaben' und 'infos' mischen
    let combinedEntries = mailResult.entries;
    let combinedTotal = mailResult.total;

    if (tab === "aufgaben" || tab === "infos") {
      const heroItems = await loadHeroComments(tab, 200).catch(() => []);
      const heroAsMail = heroItems.map((h) => heroToMailItem(h, tab));

      // Filter angewendet: nur unread Hero-Items wenn status='open' (Default)
      const filteredHero = heroAsMail.filter((item) => {
        if (filters.status === "done") return item.status === "done";
        if (filters.status === "open" || filters.status === undefined) return item.status !== "done";
        return true;
      });

      const all = [...mailResult.entries, ...filteredHero];
      all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const offset = page * pageSize;
      combinedEntries = all.slice(offset, offset + pageSize);
      combinedTotal = mailResult.total + filteredHero.length;
    }

    return NextResponse.json({
      entries: combinedEntries,
      total: combinedTotal,
      page,
      pageSize,
      filter: tab,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
