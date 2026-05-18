import { createClient } from "@supabase/supabase-js";
import { cleanProjectName } from "@/lib/hero/project-title";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

export interface AufgabeEntry {
  id: string;
  title: string | null;
  body: string | null;
  is_read: boolean | null;
  category: string | null;
  notification_date: string | null;
  target_id: string | null;
  project_number: string | null;
  project_name: string | null;
}

export interface AufgabenFilters {
  category?: string;
  onlyUnread?: boolean;
  search?: string;
}

export interface AufgabenPage {
  entries: AufgabeEntry[];
  total: number;
}

export async function loadAufgabenPage(
  filters: AufgabenFilters = {},
  page = 0,
  pageSize = 50
): Promise<AufgabenPage> {
  const supabase = supabaseAdmin();
  const offset = page * pageSize;

  let query = supabase
    .from("hero_notifications")
    .select("id, title, body, is_read, category, notification_date, target_id", { count: "exact" })
    .eq("is_deleted", false)
    .order("notification_date", { ascending: false, nullsFirst: false })
    .range(offset, offset + pageSize - 1);

  if (filters.category) query = query.eq("category", filters.category);
  if (filters.onlyUnread) query = query.eq("is_read", false);
  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,body.ilike.%${filters.search}%`);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  const entries = data ?? [];
  const projectIds = [...new Set(entries.map((e) => e.target_id).filter(Boolean) as string[])];

  let projectMap: Record<string, { project_number: string | null; project_name: string | null }> = {};
  if (projectIds.length > 0) {
    const { data: projects } = await supabaseAdmin()
      .from("hero_projects")
      .select("id, project_number, project_name")
      .in("id", projectIds);
    for (const p of projects ?? []) {
      projectMap[p.id] = { project_number: p.project_number ?? null, project_name: p.project_name ?? null };
    }
  }

  return {
    entries: entries.map((e) => ({
      id: e.id,
      title: e.title ?? null,
      body: e.body ?? null,
      is_read: e.is_read ?? null,
      category: e.category ?? null,
      notification_date: e.notification_date ?? null,
      target_id: e.target_id ?? null,
      project_number: projectMap[e.target_id ?? ""]?.project_number ?? null,
      project_name: cleanProjectName(projectMap[e.target_id ?? ""]?.project_name),
    })),
    total: count ?? 0,
  };
}

export async function loadAufgabenStats(): Promise<{ total: number; unread: number; aufgaben: number }> {
  const supabase = supabaseAdmin();
  const [total, unread, aufgaben] = await Promise.all([
    supabase.from("hero_notifications").select("id", { count: "exact", head: true }).eq("is_deleted", false),
    supabase.from("hero_notifications").select("id", { count: "exact", head: true }).eq("is_deleted", false).eq("is_read", false),
    supabase.from("hero_notifications").select("id", { count: "exact", head: true }).eq("is_deleted", false).eq("category", "aufgabe").eq("is_read", false),
  ]);
  return {
    total: total.count ?? 0,
    unread: unread.count ?? 0,
    aufgaben: aufgaben.count ?? 0,
  };
}
