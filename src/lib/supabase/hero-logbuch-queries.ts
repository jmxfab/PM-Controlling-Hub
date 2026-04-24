import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

export interface LogbuchEntry {
  id: string;
  entry_date: string | null;
  event_type: string | null;
  user_email: string | null;
  project_match_id: string | null;
  project_number: string | null;
  project_name: string | null;
  target_id: string | null;
  hero_modified_at: string | null;
  raw: Record<string, unknown> | null;
}

export interface LogbuchFilters {
  userEmail?: string;
  projectId?: string;
  eventType?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface LogbuchPage {
  entries: LogbuchEntry[];
  total: number;
}

export interface LogbuchAggregations {
  byUser: { email: string; count: number }[];
  byProject: {
    project_id: string;
    project_name: string | null;
    project_number: string | null;
    count: number;
  }[];
  byEventType: { type: string; count: number }[];
}

export async function loadLogbuchPage(
  filters: LogbuchFilters,
  page = 0,
  pageSize = 100
): Promise<LogbuchPage> {
  const supabase = supabaseAdmin();
  const offset = page * pageSize;

  let query = supabase
    .from("hero_histories")
    .select(
      "id, entry_date, event_type, user_email, project_match_id, target_id, hero_modified_at, raw",
      { count: "exact" }
    )
    .eq("is_deleted", false)
    .order("entry_date", { ascending: false, nullsFirst: false })
    .range(offset, offset + pageSize - 1);

  if (filters.userEmail)
    query = query.ilike("user_email", `%${filters.userEmail}%`);
  if (filters.projectId)
    query = query.eq("project_match_id", filters.projectId);
  if (filters.eventType) query = query.eq("event_type", filters.eventType);
  if (filters.dateFrom) query = query.gte("entry_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("entry_date", filters.dateTo);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  const entries = data ?? [];
  const projectIds = [
    ...new Set(
      entries.map((e) => e.project_match_id).filter(Boolean) as string[]
    ),
  ];

  let projectMap: Record<
    string,
    { project_number: string | null; project_name: string | null }
  > = {};
  if (projectIds.length > 0) {
    const { data: projects } = await supabaseAdmin()
      .from("hero_projects")
      .select("id, project_number, project_name")
      .in("id", projectIds);
    for (const p of projects ?? []) {
      projectMap[p.id] = {
        project_number: p.project_number ?? null,
        project_name: p.project_name ?? null,
      };
    }
  }

  return {
    entries: entries.map((e) => ({
      id: e.id,
      entry_date: e.entry_date ?? null,
      event_type: e.event_type ?? null,
      user_email: e.user_email ?? null,
      project_match_id: e.project_match_id ?? null,
      project_number:
        projectMap[e.project_match_id ?? ""]?.project_number ?? null,
      project_name:
        projectMap[e.project_match_id ?? ""]?.project_name ?? null,
      target_id: e.target_id ?? null,
      hero_modified_at: e.hero_modified_at ?? null,
      raw: (e.raw as Record<string, unknown> | null) ?? null,
    })),
    total: count ?? 0,
  };
}

export async function loadLogbuchAggregations(
  filters: LogbuchFilters
): Promise<LogbuchAggregations> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.rpc("logbuch_aggregations", {
    p_user_email: filters.userEmail ?? null,
    p_project_id: filters.projectId ?? null,
    p_event_type: filters.eventType ?? null,
    p_date_from: filters.dateFrom ?? null,
    p_date_to: filters.dateTo ?? null,
  });
  if (error) throw new Error(error.message);

  const result = (data ?? {}) as {
    byUser?: unknown[];
    byProject?: unknown[];
    byEventType?: unknown[];
  };

  return {
    byUser: (result.byUser ?? []) as LogbuchAggregations["byUser"],
    byProject: (result.byProject ??
      []) as LogbuchAggregations["byProject"],
    byEventType: (result.byEventType ??
      []) as LogbuchAggregations["byEventType"],
  };
}
