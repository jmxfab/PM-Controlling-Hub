/**
 * CLI entry for the Hero → Supabase sync.
 *
 * Usage:
 *   npx tsx scripts/sync/run-all.ts                       # all entities
 *   npx tsx scripts/sync/run-all.ts --entities projects   # subset
 *   npx tsx scripts/sync/run-all.ts --entities all
 *
 * Env vars required (provided by GitHub Actions secrets in production):
 *   HERO_API_KEY
 *   SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)
 *
 * Optional:
 *   GITHUB_RUN_ID — persisted on hero_sync_runs for correlation.
 */

import { ALL_ENTITIES, findEntity } from "./entities";
import { runEntitySync } from "./sync-engine";
import { getSyncSupabaseAdmin } from "./supabase-admin";

function parseArgs(argv: string[]): { entities: string[] } {
  const entitiesArg =
    argv.find((a) => a.startsWith("--entities="))?.split("=")[1] ??
    (() => {
      const idx = argv.indexOf("--entities");
      return idx >= 0 ? argv[idx + 1] : undefined;
    })();

  if (!entitiesArg || entitiesArg === "all") {
    return { entities: ALL_ENTITIES.map((entity) => entity.name) };
  }
  return {
    entities: entitiesArg
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  };
}

async function main() {
  const { entities } = parseArgs(process.argv.slice(2));
  const runId = process.env.GITHUB_RUN_ID;

  console.log(
    `[sync] starting entities=${entities.join(",")}${
      runId ? ` run_id=${runId}` : ""
    }`
  );

  let hadError = false;

  for (const name of entities) {
    const entity = findEntity(name);
    if (!entity) {
      console.error(`[sync] unknown entity: ${name}`);
      hadError = true;
      continue;
    }

    console.log(`[sync:${entity.name}] begin`);
    const result = await runEntitySync(entity, { runId });

    if (result.status === "success") {
      console.log(
        `[sync:${entity.name}] done rows=${result.rowsUpserted} in ${result.durationMs}ms`
      );
    } else {
      hadError = true;
      console.error(
        `[sync:${entity.name}] FAILED after ${result.durationMs}ms — ${result.errorMessage}`
      );
    }
  }

  // Refresh the dashboard materialized view so fresh data is visible
  // without waiting for the Next.js data-cache TTL to expire. Failures
  // are logged but not fatal — the view will self-heal on the next run
  // or a manual REFRESH MATERIALIZED VIEW call.
  const refreshEntities = new Set([
    "projects",
    "customer_documents",
    "project_types",
  ]);
  const refreshTriggered = entities.some((name) => refreshEntities.has(name));
  if (refreshTriggered) {
    try {
      const supabase = getSyncSupabaseAdmin();
      const { error } = await supabase.rpc("refresh_hero_dashboard_projects");
      if (error) {
        console.warn(`[sync] view refresh warning: ${error.message}`);
      } else {
        console.log("[sync] hero_dashboard_projects refreshed");
      }
    } catch (error) {
      console.warn(
        "[sync] view refresh failed:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  if (hadError) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[sync] fatal:", error);
  process.exit(1);
});
