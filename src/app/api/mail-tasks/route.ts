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

/** Wenn Hero gemischt wird: alle relevanten Mails + Hero ziehen,
 *  damit die Sortierung+Pagination ueber den combined-Pool stimmt.
 *  500 reicht praktisch immer (Aufgaben-Tab hat selten >500 offene Items).
 *  Hot Path -> bewusst limitiert um Latenz + Payload klein zu halten. */
const COMBINED_LIMIT = 500;

function parseTab(v: string | null): MailTabFilter {
  if (v === "kritisch" || v === "infos" || v === "inbox" || v === "rechnungen") return v;
  return "aufgaben";
}

/** Robuste Fehler-zu-String-Konvertierung — verhindert "[object Object]" */
function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object") {
    const obj = e as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.error === "string") return obj.error;
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }
  return String(e);
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
    const pageSize = Math.min(1000, Math.max(1, parseInt(searchParams.get("page_size") ?? "50", 10)));

    let combinedEntries;
    let combinedTotal;

    if (tab === "aufgaben" || tab === "infos") {
      // Hero-Mix: alle Mails + alle Hero laden, dann lokal sortieren+slicen
      const [mailResult, heroItems] = await Promise.all([
        loadMailTasksPage(tab, 0, COMBINED_LIMIT, filters),
        loadHeroComments(tab, COMBINED_LIMIT).catch(() => []),
      ]);

      const heroAsMail = heroItems.map((h) => heroToMailItem(h, tab));

      // Hero nach gewaehltem Status filtern (Hero hat kein DB-status,
      // wir mappen aus is_read).
      const filteredHero = heroAsMail.filter((item) => {
        if (filters.status === "done") return item.status === "done";
        if (filters.status === "open" || filters.status === undefined) return item.status !== "done";
        return true;
      });

      const all = [...mailResult.entries, ...filteredHero];
      all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const offset = page * pageSize;
      combinedEntries = all.slice(offset, offset + pageSize);
      combinedTotal = all.length;
    } else {
      const mailResult = await loadMailTasksPage(tab, page, pageSize, filters);
      combinedEntries = mailResult.entries;
      combinedTotal = mailResult.total;
    }

    return NextResponse.json({
      entries: combinedEntries,
      total: combinedTotal,
      page,
      pageSize,
      filter: tab,
    });
  } catch (error) {
    return NextResponse.json({ error: errMsg(error) }, { status: 500 });
  }
}
