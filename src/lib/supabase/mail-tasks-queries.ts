import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

export type MailTaskStatus = "open" | "in_progress" | "waiting" | "done" | "cancelled";
export type MailTaskPriority = "urgent" | "high" | "medium" | "low";

export interface MailTask {
  id: string;
  title: string;
  description: string | null;
  status: MailTaskStatus;
  priority: MailTaskPriority | null;
  due_date: string | null;
  created_at: string;
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

export async function loadMailTasksPage(
  page = 0,
  pageSize = 50,
  search = "",
): Promise<MailTasksPage> {
  const supabase = supabaseAdmin();
  const offset = page * pageSize;

  let query = supabase
    .from("tasks")
    .select("id, title, description, status, priority, due_date, created_at", { count: "exact" })
    .eq("is_automated", true)
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
      sender,
      body,
    };
  });

  return { entries, total: count ?? 0 };
}
