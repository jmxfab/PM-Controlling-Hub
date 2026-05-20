import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  loadMailTasksPage,
  heroToMailItem,
  type MailTabFilter,
  type MailTaskFilters,
} from "@/lib/supabase/mail-tasks-queries";
import { loadHeroComments } from "@/lib/supabase/hero-comments-queries";

const VALID_CATEGORY = new Set([
  "info",
  "aufgabe",
  "dringend",
  "kritisch",
  "inbox",
  "rechnung",
  "bestellung",
  "pl_aufgabe",
  "gf_aufgabe",
]);
const VALID_PRIORITY = new Set(["urgent", "high", "medium", "low"]);

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

export const runtime = "nodejs";
export const maxDuration = 30;

/** Wenn Hero gemischt wird: alle relevanten Mails + Hero ziehen,
 *  damit die Sortierung+Pagination ueber den combined-Pool stimmt.
 *  500 reicht praktisch immer (Aufgaben-Tab hat selten >500 offene Items).
 *  Hot Path -> bewusst limitiert um Latenz + Payload klein zu halten. */
const COMBINED_LIMIT = 500;

function parseTab(v: string | null): MailTabFilter {
  if (
    v === "my_day" ||
    v === "kritisch" ||
    v === "infos" ||
    v === "inbox" ||
    v === "rechnungen" ||
    v === "aufgeschoben" ||
    v === "pl" ||
    v === "gf"
  )
    return v;
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
      age: (searchParams.get("age") as MailTaskFilters["age"]) ?? undefined,
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

    return NextResponse.json(
      {
        entries: combinedEntries,
        total: combinedTotal,
        page,
        pageSize,
        filter: tab,
      },
      {
        headers: {
          // Browser-Cache: 15s frische Daten, 60s stale-while-revalidate.
          // Bei Tab-zurueck oder Hard-Refresh innerhalb 15s = kein Server-Hit.
          // Innerhalb 60s = stale Content sofort + Refresh in Background.
          "Cache-Control":
            "private, max-age=30, stale-while-revalidate=120",
        },
      },
    );
  } catch (error) {
    return NextResponse.json({ error: errMsg(error) }, { status: 500 });
  }
}

/**
 * POST: Erstellt eine manuelle Aufgabe (vom User, nicht vom n8n-Workflow).
 * Body: { title, description?, mail_category, priority?, due_date?, assigned_to?, remind_at? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      title?: string;
      description?: string;
      mail_category?: string;
      priority?: string;
      due_date?: string | null;
      assigned_to?: string | null;
      remind_at?: string | null;
    };

    const title = (body.title ?? "").trim();
    if (title.length === 0) {
      return NextResponse.json({ error: "title required" }, { status: 400 });
    }
    if (title.length > 200) {
      return NextResponse.json({ error: "title max 200 chars" }, { status: 400 });
    }

    const category = body.mail_category ?? "aufgabe";
    if (!VALID_CATEGORY.has(category)) {
      return NextResponse.json({ error: `Invalid mail_category: ${category}` }, { status: 400 });
    }

    const priority = body.priority ?? "medium";
    if (!VALID_PRIORITY.has(priority)) {
      return NextResponse.json({ error: `Invalid priority: ${priority}` }, { status: 400 });
    }

    const row: Record<string, unknown> = {
      title,
      description: (body.description ?? "").slice(0, 4000),
      mail_category: category,
      priority,
      status: "open",
      is_user_created: true,
      is_automated: false,
      subtasks: [],
    };

    if (body.due_date) {
      const d = new Date(body.due_date);
      if (!Number.isNaN(d.getTime())) row.due_date = d.toISOString();
    }
    if (body.assigned_to && typeof body.assigned_to === "string") {
      row.assigned_to = body.assigned_to.trim().slice(0, 200);
    }
    if (body.remind_at) {
      const d = new Date(body.remind_at);
      if (!Number.isNaN(d.getTime())) row.remind_at = d.toISOString();
    }

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("tasks")
      .insert(row)
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: errMsg(error) }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data?.id });
  } catch (error) {
    return NextResponse.json({ error: errMsg(error) }, { status: 500 });
  }
}
