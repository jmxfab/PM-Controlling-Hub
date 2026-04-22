import "server-only";

import { createClient } from "@supabase/supabase-js";

export interface EntitySyncSummary {
  entity: string;
  rows: number;
  lastRunStatus: "success" | "error" | "running" | null;
  lastRunAt: string | null;
  lastDurationMs: number | null;
  lastError: string | null;
}

export interface HeroSyncStatusDto {
  entities: EntitySyncSummary[];
  latestRunAt: string | null;
  activeRuns: number;
}

/**
 * Aggregates hero_sync_runs + row counts across every mirror table the engine
 * registers. Used by both the admin API and the server-rendered status panel.
 */
export async function getHeroSyncStatusDetails(): Promise<HeroSyncStatusDto> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  const supabase = createClient(url, key);

  const entityTable: Record<string, string> = {
    projects: "hero_projects",
    contacts: "hero_contacts",
    customer_documents: "hero_customer_documents",
    measures: "hero_measures",
    partners: "hero_partners",
  };
  const entities = Object.keys(entityTable);

  const [runsResponse, countResponses] = await Promise.all([
    supabase
      .from("hero_sync_runs")
      .select("entity, status, started_at, finished_at, duration_ms, error_message")
      .order("started_at", { ascending: false })
      .limit(200),
    Promise.all(
      entities.map((name) =>
        supabase
          .from(entityTable[name])
          .select("id", { count: "exact", head: true })
          .eq("is_deleted", false)
      )
    ),
  ]);

  const rowsByEntity = new Map<string, number>();
  entities.forEach((name, index) => {
    const { count, error } = countResponses[index];
    if (error) {
      rowsByEntity.set(name, 0);
    } else {
      rowsByEntity.set(name, count ?? 0);
    }
  });

  const latestByEntity = new Map<
    string,
    {
      status: EntitySyncSummary["lastRunStatus"];
      startedAt: string | null;
      finishedAt: string | null;
      durationMs: number | null;
      errorMessage: string | null;
    }
  >();

  for (const row of runsResponse.data ?? []) {
    if (latestByEntity.has(row.entity)) continue;
    latestByEntity.set(row.entity, {
      status: (row.status as EntitySyncSummary["lastRunStatus"]) ?? null,
      startedAt: row.started_at ?? null,
      finishedAt: row.finished_at ?? null,
      durationMs: row.duration_ms ?? null,
      errorMessage: row.error_message ?? null,
    });
  }

  const summaries: EntitySyncSummary[] = entities.map((name) => {
    const latest = latestByEntity.get(name);
    return {
      entity: name,
      rows: rowsByEntity.get(name) ?? 0,
      lastRunStatus: latest?.status ?? null,
      lastRunAt: latest?.finishedAt ?? latest?.startedAt ?? null,
      lastDurationMs: latest?.durationMs ?? null,
      lastError: latest?.errorMessage ?? null,
    };
  });

  const latestRunAt = summaries
    .map((summary) => summary.lastRunAt)
    .filter((value): value is string => !!value)
    .sort()
    .reverse()[0] ?? null;

  const activeRuns = (runsResponse.data ?? []).filter(
    (row) => row.status === "running"
  ).length;

  return { entities: summaries, latestRunAt, activeRuns };
}
