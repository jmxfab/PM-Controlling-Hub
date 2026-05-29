# PROJ-2: Hero API Key UI Management

## Status: In Progress
**Created:** 2026-04-21
**Last Updated:** 2026-04-21

## Dependencies
- PROJ-1 (Controlling Dashboard Baseline) — provides the admin panel container and Hero client integration.

## User Stories
- As the product owner, I want to paste my Hero API key into the dashboard UI so that I can activate live Hero reads without editing `.env` files or redeploying.
- As an admin user, I want the dashboard to tell me clearly whether the Hero connection is currently configured so that I know if the displayed data comes from Hero or from the sample fallback.
- As an admin user, I want the stored key to stay hidden after saving (only a masked preview is shown) so that it does not leak from the UI or browser history.
- As the system, I want the saved key to take precedence over the environment variable so that manual overrides through the UI always win against stale deployment configuration.

## Acceptance Criteria
- [x] The dashboard renders a Hero admin panel that exposes the current Hero connection status.
- [x] The panel contains an input field for the Hero API key (masked, type=password).
- [x] The user can save a new key via a "Speichern" button. The key is transported over HTTPS only to the server.
- [x] After a successful save, the UI shows a success confirmation and a masked preview of the stored key (only the last 4 characters).
- [x] A GET endpoint returns `{ configured: boolean, maskedKey: string | null, updatedAt: string | null }` — but never the raw key.
- [x] A POST endpoint validates the key with Zod (min length 10 chars) and persists it in Supabase via the service-role client.
- [x] The Hero GraphQL client (`src/lib/hero/hero-client.ts`) reads the key from the DB first, and falls back to `process.env.HERO_API_KEY` when no DB value exists.
- [x] The `app_settings` table has Row Level Security enabled, with `service_role` as the only full-access role. Anonymous and authenticated clients have no direct access.
- [x] The raw Hero API key is never returned to the browser, never logged, and never embedded into server components.
- [x] The user can remove/clear the stored key via a "Entfernen" action, which deletes the row and reverts to env-variable behavior.
- [x] If the key is missing from both DB and env, the dashboard continues to render sample-data fallback (no regression to PROJ-1 behavior).

## Edge Cases
- Empty or whitespace-only input → rejected by Zod validation with a clear German error message.
- Key shorter than 10 characters → rejected as likely invalid.
- Network error when saving → toast with error message, loading state resets, input keeps the value so the user can retry.
- DB read fails at request time → log warning server-side, fall back to env variable, never crash the dashboard.
- Concurrent saves → last-write-wins via upsert on the `hero_api_key` key.

## Technical Requirements
- Secrets must never travel back to the client. The API only returns a masked preview + boolean + timestamp.
- Input validation uses Zod on the server. Client-side validation is a UX addition only.
- The admin panel lives on the main dashboard page (or a dedicated admin sub-area). It must be clearly visually separated from the read-only project data.
- The `app_settings` table stores key/value pairs so it can hold additional future settings (e.g. `HERO_PROJECT_URL_TEMPLATE`) without new migrations.
- Caching: the server-side key read is memoized per-request via `React.cache` to avoid N+1 DB hits during a single dashboard render.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
### Solution Overview
Introduce a minimal server-side settings store that lets an admin update the Hero API key via the dashboard UI. The key is stored in a new `app_settings` table (key/value, RLS deny-all except `service_role`) and read server-side by the Hero client, with graceful fallback to the existing `HERO_API_KEY` environment variable.

This is the first intentional *write path* in the project. It is explicitly scoped to configuration data only; business/project data remains read-only as per PRD.

### Component Architecture
Controlling Dashboard Page
├── Header + Sync button
├── Hero Admin Panel  (rendered near the top, visually separated)
│   ├── Status badges (Hero active / Link-template active)
│   ├── Security-hinweis Alert
│   ├── Connection info cards
│   └── **NEW**: Hero API Key form
│       ├── Password input
│       ├── Save button
│       ├── Clear button
│       └── Masked preview + updatedAt
└── Dashboard Shell + Tabs (unchanged)

### Data Flow
1. Admin types a new key → POST `/api/settings/hero` with `{ apiKey }`.
2. API route validates with Zod → upserts into `app_settings` via `service_role`.
3. API returns `{ configured: true, maskedKey: "****abcd", updatedAt }`.
4. UI refreshes panel state.
5. Next dashboard render: `hero-client.ts` calls `readHeroApiKey()` which:
   a. queries `app_settings` via service role,
   b. falls back to `process.env.HERO_API_KEY` if no row exists.
6. GraphQL calls use the resolved key.

### Data Model
`app_settings` table:
- `key` TEXT PRIMARY KEY
- `value` TEXT NOT NULL
- `updated_at` TIMESTAMPTZ DEFAULT now()

RLS: only `service_role` has any access. Browser clients cannot read the table even with the anon key.

### Technical Decisions
- **Key/value store, not dedicated columns:** keeps the migration minimal and allows us to add more settings (link template, feature flags) later without new migrations.
- **`service_role` only RLS:** no path from the browser to the secret. All reads and writes go through server code that holds the service-role key.
- **DB-first, env-fallback:** UI overrides always win over stale deployment config, but the env variable keeps working as a safety net and for local dev without Supabase.
- **Mask in transit:** GET never returns the raw secret; we return only the last 4 characters and a boolean flag. This protects against accidental DevTools / logging exposure.
- **`React.cache` memoization:** prevents duplicate DB lookups inside a single request when the Hero client is called multiple times (e.g. pagination loop).

### Backend / Integration Scope
- New migration: `app_settings` table + RLS.
- New API route: `GET/POST/DELETE /api/settings/hero`.
- Modified: `hero-client.ts` gains async key lookup.

### Dependencies
- Next.js App Router API routes
- Supabase service-role client (`getSupabaseAdmin`)
- Zod for input validation
- shadcn/ui: Input, Button, Card, Alert, Badge (all already installed)

### Delivery Notes
- Env variable `HERO_API_KEY` stays documented in `.env.local.example` as a fallback for local dev.
- Not exposing any new `NEXT_PUBLIC_*` variables.
- No new security headers needed; the existing project-wide headers apply.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
