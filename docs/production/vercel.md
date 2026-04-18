# Vercel Deployment Runbook

This project can be deployed to Vercel immediately in its current **Hero sample-data mode**. Live Hero/Supabase environment variables are only required for a later live-data rollout.

## Current Deployment Mode

- The currently shipped dashboard intentionally runs in **Hero sample mode**.
- Preview deployments are valid without Hero or Supabase credentials.
- The old Hero GraphQL path is not the active dashboard read path.
- Sync and write behavior remain disabled/read-only until a separate live integration is approved.

## Environment Variables

Configure these values in **Vercel → Project Settings → Environment Variables**.

### Production
- No required Hero/Supabase env vars for the current sample-mode baseline.
- `CRON_SECRET` remains optional unless you specifically test protected cron access.

### Preview
- No required Hero/Supabase env vars for the current sample-mode baseline.
- `CRON_SECRET` is only needed if you intentionally validate the protected cron `GET` route in preview.

> Note: Vercel preview deployments still run the app with `NODE_ENV=production`. The protected cron `GET` route therefore still expects `Authorization: Bearer <CRON_SECRET>` when that path is tested, even though the dashboard itself currently renders sample data.

## Cron Behavior

- Vercel Cron can call `GET /api/cron/sync-hero` on the production deployment.
- If `CRON_SECRET` is set, Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically.
- The current baseline keeps manual `POST` sync disabled, and the dashboard itself does not depend on a successful cron run.

## Pre-Deploy Checks

Run locally before pushing a production deployment:

```bash
npm run lint
npm test
npm run build
```

## Smoke Test After Deployment

1. Open the deployed dashboard.
2. Confirm the dashboard loads and shows the sample-mode notice.
3. Confirm the page renders the four dashboard tabs.
4. Confirm timeframe controls and project list still render correctly.
5. Only for future live mode: verify cron behavior, Supabase writes, and protected route auth.

## What the Automated Checks Cover

- `npm run lint` validates the current ESLint 9 setup.
- `npm test` covers dashboard service behavior and protected cron auth behavior.
- `npm run build` confirms the Next.js production build.
- `npm run test:e2e` is a smoke test for the dashboard shell only. It does **not** verify response headers, disabled production sync, or a real Vercel cron execution.

## Rollback

If a production deployment is broken:

1. Open **Vercel → Deployments**.
2. Promote the previous healthy deployment to production.
3. Keep the same environment variables unless the outage was caused by a bad value.

## Future Live Rollout

When the app is later moved from sample mode to real Hero/Supabase-backed data, add the necessary environment variables at that time:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SECRET_KEY` *(preferred)* or `SUPABASE_SERVICE_ROLE_KEY`
- `HERO_API_KEY`
- `CRON_SECRET`

## Notes

- `NEXT_PUBLIC_*` values are bundled into the client build. Treat them as public.
- Changing Vercel environment variables requires a new deployment before the app sees the new values.
- The current header setup is a strong baseline, but it does not yet include a Content-Security-Policy. Add CSP separately once you can test it safely in the deployed app.
