import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

export type MailTaskStatus = "open" | "in_progress" | "waiting" | "done" | "cancelled";
export type MailTaskPriority = "urgent" | "high" | "medium" | "low";
export type MailCategory = "aufgabe" | "dringend" | "info" | "inbox";

export interface MailTask {
  id: string;
  title: string;
  description: string | null;
  status: MailTaskStatus;
  priority: MailTaskPriority | null;
  due_date: string | null;
  created_at: string;
  /** Microsoft Graph Email-ID — null bei alten Tasks vor dem Reply-Feature */
  source_email_id: string | null;
  /** Microsoft Graph webLink — oeffnet die Original-Mail in Outlook (Desktop oder Web) */
  source_email_web_link: string | null;
  /** Claude-Klassifikation: aufgabe / dringend = "Aufgaben"-Tab, info = "Infos"-Tab, inbox = unklar */
  mail_category: MailCategory | null;
  /** Extracted from description prefix "Von: ..." */
  sender: string | null;
  /** description without "Von: ..." prefix */
  body: string | null;
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

export interface MailTaskCounts {
  aufgaben: number;
  infos: number;
  inbox: number;
}

export async function loadMailTaskCounts(): Promise<MailTaskCounts> {
  const supabase = supabaseAdmin();
  async function count(filter: string[]): Promise<number> {
    const { count, error } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("is_automated", true)
      .neq("status", "done")
      .in("mail_category", filter);
    if (error) return 0;
    return count ?? 0;
  }
  const [aufgaben, infos, inbox] = await Promise.all([
    count(["aufgabe", "dringend"]),
    count(["info"]),
    count(["inbox"]),
  ]);
  return { aufgaben, infos, inbox };
}

export async function loadMailTasksPage(
  filter: "aufgaben" | "infos" | "inbox",
  page = 0,
  pageSize = 50,
  search = "",
): Promise<MailTasksPage> {
  const supabase = supabaseAdmin();
  const offset = page * pageSize;

  const categories =
    filter === "aufgaben" ? ["aufgabe", "dringend"] : filter === "infos" ? ["info"] : ["inbox"];

  let query = supabase
    .from("tasks")
    .select("id, title, description, status, priority, due_date, created_at, source_email_id, source_email_web_link, mail_category", { count: "exact" })
    .eq("is_automated", true)
    .in("mail_category", categories)
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
  }

  const { data, count, error } = await query.range(offset, offset + pageSize - 1);
  if (error) throw error;

  const entries: MailTask[] = (data ?? []).map((row) => {
    const { sender, body } = parseSenderAndBody(row.description);
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status as MailTaskStatus,
      priority: row.priority as MailTaskPriority | null,
      due_date: row.due_date,
      created_at: row.created_at,
      source_email_id: row.source_email_id ?? null,
      source_email_web_link: row.source_email_web_link ?? null,
      mail_category: (row.mail_category as MailCategory | null) ?? null,
      sender,
      body,
    };
  });

  return { entries, total: count ?? 0 };
}
