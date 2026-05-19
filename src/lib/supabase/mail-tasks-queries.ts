import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

/**
 * Status-Werte fuer Mail-Tasks.
 * - open         : Standard, action required
 * - in_progress  : User arbeitet dran
 * - waiting      : Ball liegt beim Kunden / Externen (incl. Snooze)
 * - controlling  : Delegiert oder zur Kontrolle/Pruefung — nachzuverfolgen
 * - done         : Abgeschlossen
 * - cancelled    : Verworfen
 */
export type MailTaskStatus =
  | "open"
  | "in_progress"
  | "waiting"
  | "controlling"
  | "done"
  | "cancelled";
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
  /** Spiegelt Outlook-isRead: true wenn Domenic die Mail bereits in Outlook geoeffnet hat.
   *  Wird vom Sync-Workflow alle 10 Min refreshed solange der Task open ist. */
  source_email_is_read: boolean | null;
  /** Microsoft Graph conversationId — alle Mails einer Reply-Kette teilen denselben Wert. */
  source_email_conversation_id: string | null;
  /** Anzahl Mails in der Konversation (1 = Einzel-Mail). Wird vom Workflow inkrementiert. */
  thread_message_count: number;
  /** Timestamp der juengsten Mail in der Konversation — wird zum Sortieren benutzt damit
   *  Threads mit neuer Antwort wieder nach oben kommen. NULL bei Einzel-Mails / alten Tasks. */
  thread_last_message_at: string | null;
  /** Claude-Klassifikation: aufgabe / dringend = "Aufgaben"-Tab, info = "Infos"-Tab, inbox = unklar */
  mail_category: MailCategory | null;
  /** Extracted from description prefix "Von: ..." */
  sender: string | null;
  /** description without "Von: ..." prefix */
  body: string | null;
  /** Hero-spezifisch: Projekt-Nummer falls Hero-Notification an einem Projekt haengt */
  hero_project_number?: string | null;
  hero_project_name?: string | null;
  /** Hero-spezifisch: project_match_id fuer Cross-Link zur Projekt-Aktivitaet */
  hero_project_id?: string | null;
  /** Hero-spezifisch: ungelesen-Flag */
  hero_is_read?: boolean | null;
  /** Auto-generierte Subtasks (Checkliste) — leer wenn noch nicht generiert. */
  subtasks: Subtask[];
  /** Wem ist die Aufgabe zugewiesen (delegiert) — Name oder E-Mail. */
  assigned_to: string | null;
  /** Erinnerungszeitpunkt — wenn gesetzt, wird die Aufgabe beim Erreichen
   *  als anstehend markiert. */
  remind_at: string | null;
  /** true wenn manuell vom User angelegt (vs. automatisch klassifiziert). */
  is_user_created: boolean;
  /** Microsoft-To-Do-Style 'Mein Tag': NULL = nicht in Mein Tag.
   *  Sonst Timestamp wann hinzugefuegt. */
  in_my_day_at: string | null;
  /** Manueller Sortier-Wert fuer Drag-and-Drop. 0 = kein manueller Sort. */
  sort_order: number;
  /** MS-To-Do-Style Wichtig-Star: gepinnt nach oben + visuell hervorgehoben. */
  is_important: boolean;
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

export type MailTabFilter =
  | "my_day"
  | "kritisch"
  | "aufgaben"
  | "infos"
  | "inbox"
  | "rechnungen";

const CATEGORIES_PER_TAB: Record<MailTabFilter, string[]> = {
  my_day: [], // Mein Tag filtert NICHT nach Kategorie sondern in_my_day_at IS NOT NULL
  kritisch: ["kritisch"],
  aufgaben: ["aufgabe", "dringend"],
  infos: ["info"],
  inbox: ["inbox"],
  rechnungen: ["rechnung", "bestellung"],
};

export interface MailTaskCounts {
  /** Wie viele Tasks aktuell in Mein Tag stehen (alle Kategorien). */
  my_day: number;
  kritisch: number;
  aufgaben: number;
  infos: number;
  inbox: number;
  rechnungen: number;
}

export async function loadMailTaskCounts(): Promise<MailTaskCounts> {
  const supabase = supabaseAdmin();
  const { countHeroCommentsBoth } = await import("./hero-comments-queries");
  // Vorher: 5 sequentielle count:'exact' Queries (jede ist auf Postgres-Seite
  // ein Full-Scan + Count). Jetzt: 1 RPC mit FILTER-Aggregaten, parallel zu
  // den Hero-Counts.
  const [rpcRes, heroCounts] = await Promise.all([
    supabase.rpc("compute_mail_task_counts").single<{
      my_day: number;
      kritisch: number;
      aufgaben: number;
      infos: number;
      inbox: number;
      rechnungen: number;
    }>(),
    countHeroCommentsBoth().catch(() => ({ aufgaben: 0, infos: 0 })),
  ]);
  const mailCounts = rpcRes.data ?? {
    my_day: 0,
    kritisch: 0,
    aufgaben: 0,
    infos: 0,
    inbox: 0,
    rechnungen: 0,
  };
  return {
    my_day: Number(mailCounts.my_day) || 0,
    kritisch: Number(mailCounts.kritisch) || 0,
    aufgaben: (Number(mailCounts.aufgaben) || 0) + heroCounts.aufgaben,
    infos: (Number(mailCounts.infos) || 0) + heroCounts.infos,
    inbox: Number(mailCounts.inbox) || 0,
    rechnungen: Number(mailCounts.rechnungen) || 0,
  };
}

export interface MailTaskFilters {
  search?: string;
  status?: "all" | "open" | "done";
  priority?: "all" | "urgent" | "high" | "medium" | "low";
  /** Altersfilter: Tasks juenger als N Tage. 'all' = ohne Limit. Default 30. */
  age?: "30" | "90" | "all";
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
    .select("id, title, description, status, priority, due_date, created_at, source_email_id, source_email_entry_id, source_email_web_link, source_email_is_read, source_email_conversation_id, thread_message_count, thread_last_message_at, mail_category, subtasks, assigned_to, remind_at, is_user_created, in_my_day_at, sort_order, is_important", { count: "exact" })
    .or("is_automated.eq.true,is_user_created.eq.true");

  if (filter === "my_day") {
    // Mein Tag: alle Tasks mit in_my_day_at IS NOT NULL, unabhaengig von Kategorie.
    // Sort: is_important DESC (Wichtig-Star oben), dann sort_order (manuell via DnD),
    // dann in_my_day_at DESC.
    query = query
      .not("in_my_day_at", "is", null)
      .order("is_important", { ascending: false })
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("in_my_day_at", { ascending: false, nullsFirst: false });
  } else {
    // Standard Tabs nach Kategorie. is_important wins always.
    query = query
      .in("mail_category", categories)
      .order("is_important", { ascending: false })
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("thread_last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
  }

  if (filters.status === "open") query = query.neq("status", "done");
  if (filters.status === "done") query = query.eq("status", "done");
  if (filters.priority && filters.priority !== "all") query = query.eq("priority", filters.priority);
  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }
  // Altersfilter (Default 30 Tage, kann auf 90 oder 'alle' umgestellt werden).
  // Wirkt NICHT in Mein Tag (da entscheidet der User explizit).
  if (filter !== "my_day") {
    const ageMode = filters.age ?? "30";
    if (ageMode === "30" || ageMode === "90") {
      const cutoff = new Date(
        Date.now() - parseInt(ageMode, 10) * 24 * 60 * 60 * 1000,
      ).toISOString();
      query = query.gte("created_at", cutoff);
    }
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
      source_email_is_read:
        typeof row.source_email_is_read === "boolean"
          ? row.source_email_is_read
          : null,
      source_email_conversation_id: row.source_email_conversation_id ?? null,
      thread_message_count:
        typeof row.thread_message_count === "number"
          ? row.thread_message_count
          : 1,
      thread_last_message_at: row.thread_last_message_at ?? null,
      mail_category: (row.mail_category as MailCategory | null) ?? null,
      sender,
      body,
      subtasks: Array.isArray(row.subtasks) ? (row.subtasks as Subtask[]) : [],
      assigned_to: row.assigned_to ?? null,
      remind_at: row.remind_at ?? null,
      is_user_created: row.is_user_created ?? false,
      in_my_day_at: row.in_my_day_at ?? null,
      sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
      is_important: Boolean(row.is_important),
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
    source_email_is_read: null,
    source_email_conversation_id: null,
    thread_message_count: 1,
    thread_last_message_at: null,
    in_my_day_at: null,
    sort_order: 0,
    is_important: false,
    mail_category: category,
    sender: null,
    body: hero.body,
    hero_project_number: hero.project_number,
    hero_project_name: hero.project_name,
    hero_project_id: hero.target_id ?? null,
    hero_is_read: hero.is_read,
    subtasks: [],
    assigned_to: null,
    remind_at: null,
    is_user_created: false,
  };
}
