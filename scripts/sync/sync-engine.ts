/**
 * Generic Hero → Supabase sync engine.
 *
 * Each entity describes itself via `HeroEntitySync`. The engine:
 *  1. Loads the cursor (`hero_sync_cursors`) and opens a run log entry.
 *  2. Pages through Hero with bounded concurrency.
 *  3. Normalizes and upserts rows into the target Supabase table.
 *  4. Advances the cursor to the largest `hero_modified_at` it saw.
 *  5. Closes the run log with success/error status and duration.
 *
 * The engine knows nothing about individual Hero queries — all entity-specific
 * details live in `scripts/sync/entities/*.ts`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { heroGraphQLWithRetry } from "./hero-gql";
import { getSyncSupabaseAdmin } from "./supabase-admin";

export interface SyncContext {
  /** Cursor value loaded from hero_sync_cursors (last successful run). */
  lastModifiedAt: string | null;
  /** Pagination window size the engine wants this page. */
  first: number;
  /** Zero-based page offset. */
  offset: number;
}

export interface HeroEntitySync<TRaw, TRow extends { id: string }> {
  /** Short identifier (e.g. "projects") used in logs and cursor rows. */
  name: string;
  /** Target Supabase table. */
  table: string;
  /** GraphQL query with `$first: Int!, $offset: Int!` variables. */
  query: string;
  /** Build GraphQL variables. The engine injects `first` and `offset`. */
  variables?: (ctx: SyncContext) => Record<string, unknown>;
  /** Extract the array of raw entities from the GraphQL response. */
  extract: (data: unknown) => TRaw[];
  /** Normalize one raw entity to the Supabase row shape (must include `id`). */
  normalize: (raw: TRaw) => TRow;
  /** Page size sent to Hero (default 100). */
  pageSize?: number;
  /**
   * Parallel page requests (default 3). Reduce to 1 on 429 errors. The engine
   * fires N pages in parallel, then checks whether any came back short.
   */
  concurrency?: number;
  /** Abort after this many fetched rows (safety net, default 50 000). */
  maxRows?: number;
  /**
   * Compare `hero_modified_at` to advance the cursor. Defaults to the built-in
   * ISO-string comparison on `row.hero_modified_at`.
   */
  rowModifiedAt?: (row: TRow) => string | null | undefined;
  /**
   * True for entities that return the full result set in a single request
   * (e.g. `company { measures }`). The engine runs exactly one page and
   * ignores `first` / `offset` semantics.
   */
  isUnpaginated?: boolean;
}

interface RunResult {
  entity: string;
  rowsUpserted: number;
  durationMs: number;
  status: "success" | "error";
  errorMessage?: string;
}

const BATCH_SIZE = 500;

export async function runEntitySync<TRaw, TRow extends { id: string }>(
  entity: HeroEntitySync<TRaw, TRow>,
  opts: { runId?: string } = {}
): Promise<RunResult> {
  const supabase = getSyncSupabaseAdmin();
  const startedAt = Date.now();
  const pageSize = entity.pageSize ?? 100;
  const concurrency = entity.isUnpaginated
    ? 1
    : Math.max(1, entity.concurrency ?? 3);
  const maxRows = entity.maxRows ?? 50_000;

  const { data: cursorRow } = await supabase
    .from("hero_sync_cursors")
    .select("last_modified_at")
    .eq("entity", entity.name)
    .maybeSingle();

  const lastModifiedAt = cursorRow?.last_modified_at ?? null;

  const { data: runInsert, error: runInsertError } = await supabase
    .from("hero_sync_runs")
    .insert({
      entity: entity.name,
      run_id: opts.runId ?? null,
      status: "running",
    })
    .select("id")
    .single();

  if (runInsertError || !runInsert) {
    throw new Error(
      `Failed to open hero_sync_runs row for ${entity.name}: ${runInsertError?.message}`
    );
  }
  const runRowId = runInsert.id as string;

  let rowsUpserted = 0;
  let maxObservedModifiedAt = lastModifiedAt;
  let offset = 0;
  let done = false;

  try {
    while (!done) {
      if (rowsUpserted >= maxRows) {
        console.warn(
          `[sync:${entity.name}] reached maxRows=${maxRows} — stopping early`
        );
        break;
      }

      const pages = await Promise.all(
        Array.from({ length: concurrency }, (_, i) => {
          const ctx: SyncContext = {
            lastModifiedAt,
            first: pageSize,
            offset: offset + i * pageSize,
          };
          const vars = entity.isUnpaginated
            ? entity.variables
              ? entity.variables(ctx)
              : {}
            : {
                first: ctx.first,
                offset: ctx.offset,
                ...(entity.variables ? entity.variables(ctx) : {}),
              };
          return heroGraphQLWithRetry(entity.query, vars);
        })
      );

      const normalizedPages = pages.map((data) =>
        entity.extract(data).map(entity.normalize)
      );

      for (const normalized of normalizedPages) {
        if (normalized.length === 0) continue;
        await upsertBatched(supabase, entity.table, normalized);
        rowsUpserted += normalized.length;

        for (const row of normalized) {
          const rowModifiedAt =
            entity.rowModifiedAt?.(row) ??
            (row as unknown as { hero_modified_at?: string | null })
              .hero_modified_at;
          if (
            rowModifiedAt &&
            (!maxObservedModifiedAt || rowModifiedAt > maxObservedModifiedAt)
          ) {
            maxObservedModifiedAt = rowModifiedAt;
          }
        }
      }

      if (entity.isUnpaginated) {
        done = true;
      } else {
        const lastPageLen =
          normalizedPages[normalizedPages.length - 1]?.length ?? 0;
        if (lastPageLen < pageSize) {
          done = true;
        }
        offset += concurrency * pageSize;
      }
    }

    await supabase
      .from("hero_sync_cursors")
      .upsert(
        {
          entity: entity.name,
          last_modified_at: maxObservedModifiedAt,
          last_full_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "entity" }
      );

    const durationMs = Date.now() - startedAt;
    await supabase
      .from("hero_sync_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: "success",
        rows_upserted: rowsUpserted,
        duration_ms: durationMs,
      })
      .eq("id", runRowId);

    return {
      entity: entity.name,
      rowsUpserted,
      durationMs,
      status: "success",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const durationMs = Date.now() - startedAt;
    await supabase
      .from("hero_sync_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: "error",
        rows_upserted: rowsUpserted,
        duration_ms: durationMs,
        error_message: message.slice(0, 2000),
      })
      .eq("id", runRowId);

    return {
      entity: entity.name,
      rowsUpserted,
      durationMs,
      status: "error",
      errorMessage: message,
    };
  }
}

async function upsertBatched(
  supabase: SupabaseClient,
  table: string,
  rows: Array<{ id: string }>
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from(table)
      .upsert(batch, { onConflict: "id" });
    if (error) {
      throw new Error(
        `Upsert into ${table} failed (batch ${i}..${i + batch.length}): ${error.message}`
      );
    }
  }
}
