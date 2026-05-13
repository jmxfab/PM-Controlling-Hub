import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

export type MailTaskStatus = "open" | "in_progress" | "waiting" | "done" | "cancelled";
export type MailTaskPriority = "urgent" | "high" | "medium" | "low";
export type MailCategory = "aufgabe" | "dringend" | "kritisch" | "info" | "inbox" | "rechnung" | "bestellung";
export type ItemSource = "mail" | "hero";

/** Auto-generierte Subtask aus Mail-Body via Claude. */
export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface MailTask {
  id: string;
  source: ItemSource;
  title: string;
  description: string | null;
  status: MailTaskStatus;
  priority: MailTaskPriority | null;
  due_date: string | null;
  created_at: string;
  /** Microsoft Graph Email-ID — null bei alten Tasks vor dem Reply-Feature */
  source_email_id: string | null;
  /** Microsoft Graph restImmutableEntryId — stabile ID fuer ms-outlook:// Desktop Deep-Link */
  source_email_entry_id: string | null;
  /** Microsoft Graph webLink — oeffnet die Original-Mail in Outlook (Desktop oder Web) */
  source_email_web_link: string | null;
  /** Claude-Klassifikation: aufgabe / dringend = "Aufgaben"-Tab, info = "Infos"-Tab, inbox = unklar */
  mail_category: MailCategory | null;
  /** Extracted from description prefix "Von: ..." */
  sender: string | null;
  /** description without "Von: ..." prefix */
  body: string | null;
  /** Hero-spezifisch: Projekt-Nummer falls Hero-Notification an einem Projekt haengt */
  hero_project_number?: string | null;
  hero_project_name?: string | null;
  /** Hero-spezifisch: ungelesen-Flag */
  hero_is_read?: boolean | null;
  /** Auto-generierte Subtasks (Checkliste) — leer wenn noch nicht generiert. */
  subtasks: Subtask[];
}

export interface MailTasksPage {
  entries: MailTask[];
  total: number;
}

function parseSenderAndBody(description: string | null): { sender: string | null; body: string | null } {
  if (!description) return { sender: null, body: null };
  const match = description.match(/^Von:\s*([^\n]+)\n+([\s\S]*)$/);
  if (match) return { sender: match[1].trim(), body: match[2].trim() };
  return { sender: null, body: description };
}

export type MailTabFilter = "kritisch" | "aufgaben" | "infos" | "inbox" | "rechnungen";

const CATEGORIES_PER_TAB: Record<MailTabFilter, string[]> = {
  kritisch: ["kritisch"],
  aufgaben: ["aufgabe", "dringend"],
  infos: ["info"],
  inbox: ["inbox"],
  rechnungen: ["rechnung", "bestellung"],
};

export interface MailTaskCounts {
  kritisch: number;
  aufgaben: number;
  infos: number;
  inbox: number;
  rechnungen: number;
}

export async function loadMailTaskCounts(): Promise<MailTaskCounts> {
  const supabase = supabaseAdmin();
  async function countMail(filter: string[]): Promise<number> {
    const { count, error } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("is_automated", true)
      .neq("status", "done")
      .in("mail_category", filter);
    if (error) return 0;
    return count ?? 0;
  }
  // Hero-Comments mit Domenic-Bezug -> Aufgaben, Rest -> Infos
  // countHeroCommentsBoth() macht 1 Roundtrip fuer BEIDE Tabs statt 2 separate
  const { countHeroCommentsBoth } = await import("./hero-comments-queries");
  const [kritisch, aufgabenMail, infosMail, inbox, rechnungen, heroCounts] = await Promise.all([
    countMail(CATEGORIES_PER_TAB.kritisch),
    countMail(CATEGORIES_PER_TAB.aufgaben),
    countMail(CATEGORIES_PER_TAB.infos),
    countMail(CATEGORIES_PER_TAB.inbox),
    countMail(CATEGORIES_PER_TAB.rechnungen),
    countHeroCommentsBoth().catch(() => ({ aufgaben: 0, infos: 0 })),
  ]);
  return {
    kritisch,
    aufgaben: aufgabenMail + heroCounts.aufgaben,
    infos: infosMail + heroCounts.infos,
    inbox,
    rechnungen,
  };
}

export interface MailTaskFilters {
  search?: string;
  status?: "all" | "open" | "done";
  priority?: "all" | "urgent" | "high" | "medium" | "low";
}

export async function loadMailTasksPage(
  filter: MailTabFilter,
  page = 0,
  pageSize = 50,
  filters: MailTaskFilters = {},
): Promise<MailTasksPage> {
  const supabase = supabaseAdmin();
  const offset = page * pageSize;

  const categories = CATEGORIES_PER_TAB[filter];

  let query = supabase
    .from("tasks")
    .select("id, title, description, status, priority, due_date, created_at, source_email_id, source_email_entry_id, source_email_web_link, mail_category, subtasks", { count: "exact" })
    .eq("is_automated", true)
    .in("mail_category", categories)
    .order("created_at", { ascending: false });

  if (filters.status === "open") query = query.neq("status", "done");
  if (filters.status === "done") query = query.eq("status", "done");
  if (filters.priority && filters.priority !== "all") query = query.eq("priority", filters.priority);
  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  const { data, count, error } = await query.range(offset, offset + pageSize - 1);
  if (error) throw error;

  // Description ist bis 2000 Zeichen — fuer die List-Card brauchen wir nur
  // ein Preview. Truncaten halbiert die Wire-Payload bei vielen Tasks.
  // Search-Filter laeuft auf der vollen DB-description (oben in der Query),
  // also gehen keine Treffer verloren.
  const DESC_PREVIEW_MAX = 800;
  const entries: MailTask[] = (data ?? []).map((row) => {
    const truncated =
      (row.description ?? "").length > DESC_PREVIEW_MAX
        ? `${(row.description ?? "").slice(0, DESC_PREVIEW_MAX)}…`
        : row.description;
    const { sender, body } = parseSenderAndBody(truncated);
    return {
      id: row.id,
      source: "mail",
      title: row.title,
      description: truncated,
      status: row.status as MailTaskStatus,
      priority: row.priority as MailTaskPriority | null,
      due_date: row.due_date,
      created_at: row.created_at,
      source_email_id: row.source_email_id ?? null,
      source_email_entry_id: row.source_email_entry_id ?? null,
      source_email_web_link: row.source_email_web_link ?? null,
      mail_category: (row.mail_category as MailCategory | null) ?? null,
      sender,
      body,
      subtasks: Array.isArray(row.subtasks) ? (row.subtasks as Subtask[]) : [],
    };
  });

  return { entries, total: count ?? 0 };
}

/**
 * Konvertiert Hero-Notifications in das MailTask-Schema fuer das gemeinsame UI.
 * Hero-Notifications werden als pseudo-Tasks dargestellt (read-only),
 * mit source='hero'. Mail-spezifische Felder sind leer.
 */
export function heroToMailItem(
  hero: import("./hero-comments-queries").HeroCommentItem,
  tab: "aufgaben" | "infos",
): MailTask {
  const category: MailCategory = tab === "aufgaben" ? "aufgabe" : "info";
  return {
    id: `hero-${hero.id}`,
    source: "hero",
    title: hero.title ?? "(Kein Titel)",
    description: hero.body,
    status: hero.is_read ? "done" : "open",
    priority: null,
    due_date: null,
    created_at: hero.notification_date ?? new Date().toISOString(),
    source_email_id: null,
    source_email_entry_id: null,
    source_email_web_link: null,
    mail_category: category,
    sender: null,
    body: hero.body,
    hero_project_number: hero.project_number,
    hero_project_name: hero.project_name,
    hero_is_read: hero.is_read,
    subtasks: [],
  };
}
