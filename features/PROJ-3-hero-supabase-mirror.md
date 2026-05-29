# PROJ-3 Hero → Supabase Mirror

**Status:** In Progress
**Created:** 2026-04-22
**Owner:** Fabian Wagenleitner

## Summary

Replace all live Hero GraphQL reads in the dashboard with a Supabase-backed mirror. A scheduled GitHub Actions workflow pulls every operational Hero entity into `public.hero_*` tables; the Next.js app reads exclusively from Supabase.

## Motivation

- Production (Vercel Hobby) times out on the live Hero dashboard render because the sequential monster-GraphQL query against 2000+ `project_matches` exceeds the 10 s function limit.
- Hero itself returns "Internal server error" on large aggregate queries (documented limitation).
- The dashboard must stay usable when Hero is slow or down.
- Future tools (n8n flows, reports, KPIs) need SQL-level access to all Hero data, not a single Next.js rendering path.

## Scope

### In scope (this feature)

- Supabase migration `hero_mirror_core`: infrastructure tables (`hero_sync_runs`, `hero_sync_cursors`) and five core entity tables (`hero_projects`, `hero_contacts`, `hero_customer_documents`, `hero_measures`, `hero_partners`).
- Sync engine (`scripts/sync/*`) that runs outside Vercel. Each entity is described once via `HeroEntitySync` and the generic engine handles pagination, cursors, upsert, logging.
- Scheduler: GitHub Actions workflow `sync-hero.yml` on a 15-min cron + `workflow_dispatch` for manual runs.
- Read path switch: dashboard reads from `hero_projects`; `page.tsx` moves from `dynamic = "force-dynamic"` to `revalidate = 30`.
- Empty-state banner when the mirror has no rows yet.
- Admin-side trigger route (`/api/admin/trigger-hero-sync`) that dispatches the GitHub Actions workflow (fits inside Vercel's 10 s limit because it only `fetch`es the GitHub API).
- Sync-status panel in the admin UI (entity table, row counts, last sync, status).

### Out of scope (future work)

- Remaining 14 entities (tasks, tracking_times, absences, histories, field_service_jobs, calendar_events, file_uploads, receipts, webhooks, project_types, document_types, company_branches, company, tracking_categories). Will ship as `hero_mirror_extended` follow-up commits.
- Hero write-back.
- Hero webhooks (push-based sync). Polling is the chosen approach for v1.
- n8n migration of the sync workflow. The entry point (`npx tsx scripts/sync/run-all.ts`) is reusable from n8n later without refactoring.

## Architecture

```
Hero GraphQL ─┐
              │ (read-only, API key)
              ▼
    GitHub Actions (cron */15, workflow_dispatch)
              │   npx tsx scripts/sync/run-all.ts
              ▼
    Supabase Postgres  (hero_* tables, RLS: auth=read, service_role=all)
              │
              ▼
    Next.js on Vercel (ISR revalidate=30, no Hero calls at render time)
```

Why GitHub Actions:

- Vercel Hobby: crons max 2, daily only; function `maxDuration` 10 s. Incompatible with a 2-min full sync every 15 min.
- GitHub Actions: 6 h timeout per job, sub-hourly cron, 2000 free minutes/month on private repos (unlimited on public). Runs the same TypeScript as the Next.js project (no Deno duplication).

## Data model

All mirror tables follow the same shape: hard ID primary key, indexed business columns, `raw JSONB` for future-proofing, `hero_modified_at` for incremental sync, `synced_at`, `is_deleted` soft-delete flag. RLS policies:

- `<table>_auth_read`: authenticated users may SELECT.
- `<table>_service_all`: service role may do anything.

Infrastructure:

- `hero_sync_runs (id, entity, run_id, started_at, finished_at, status, rows_upserted, rows_deleted, error_message, duration_ms)`
- `hero_sync_cursors (entity, last_modified_at, last_full_sync_at)`

## Acceptance criteria

- `SELECT count(*) FROM hero_projects` returns > 2000 after first successful run.
- The dashboard renders in < 1.5 s at p50 with no requests to `login.hero-software.de`.
- Dashboard survives a broken Hero API key in Vercel env (only sync fails; reads keep working).
- Manual sync button in the admin UI dispatches a GitHub Actions run and shows a link to it.
- `hero_sync_runs` has at least one `status='success'` row per entity within 24 h of deploying the workflow.

## Rollout plan (commit-by-commit)

1. **Core migration + engine skeleton + projects entity + GitHub workflow** (this commit).
2. Four more entities: contacts, customer_documents, measures, partners.
3. Extended migration + remaining 14 entities + daily master-data workflow.
4. Read-path switch: `dashboard-data.ts`, `page.tsx`, sync-in-progress banner.
5. Trigger route + SyncButton wiring + `GITHUB_SYNC_PAT` env var.
6. Sync-status panel + admin API.
7. Remove dead Hero-live code.

## Required configuration

GitHub Secrets on the repo:

- `HERO_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Vercel env (added in commit 5):

- `GITHUB_SYNC_PAT` (fine-grained PAT, `actions:write` scope, limited to this repo)

## Risks

- **Hero 500s on aggregate queries.** Mitigation: slim per-entity queries, no cross-entity nesting. Documents and status histories are separate entities.
- **Hero rate limits.** Start at `concurrency: 3`, fall back to 2 or 1 on 429.
- **GitHub Actions minutes.** 90 runs/day × ~3 min ≈ 8000 min/month. Private repo free tier is 2000; if this becomes a problem, reduce to 30 min cron or make the repo public.
- **Supabase storage.** 500 MB free tier; expected total mirror size < 500 MB. Upgrade to Pro if needed.
- **PAT rotation.** Fine-grained PAT expires after 90 days. Rotation is a manual task documented when commit 5 lands.

## Verification (MCP)

```sql
-- After first run
SELECT count(*) FROM hero_projects;
SELECT department, count(*) FROM hero_projects GROUP BY department;
SELECT entity, status, rows_upserted, duration_ms, started_at
  FROM hero_sync_runs ORDER BY started_at DESC LIMIT 5;
```

## Implementation notes

- Sync engine code lives in `scripts/sync/` (not `src/`) to keep it out of the Next.js bundle.
- A standalone `scripts/sync/hero-gql.ts` reads `HERO_API_KEY` directly from env. The Next.js `getActiveHeroApiKey()` helper remains unchanged and still serves the dashboard UI (Admin Panel).
- New table column `hero_projects.department` is computed at sync time (PV / WP / HAUSTECHNIK) so the dashboard can filter via index rather than per-row computation.
