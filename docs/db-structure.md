# Supabase Datenbank-Struktur (public-Schema)

_Stand: 2026-04-30 · Projekt: Jumax Controlling Hub_

## Übersicht

- **31 Tables**, 3 Materialized Views
- Hero-Mirror-Tabellen (Prefix `hero_`): 19 Tables + 3 MVs
- App-eigene Tabellen: `app_settings`, `audit_log`, `emails_processed`, `invoice_snoozes`, `kpi_snapshots`, `profiles`, `workspaces`, `workspace_memberships`, `workspace_invitations`
- Auth: `profiles` + `workspaces` + `workspace_memberships` + `workspace_invitations` (Supabase-Auth-basiert)

## Tabellen

### `app_settings`
**Kind:** TABLE

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `key` | `text` | NO | |
| `value` | `text` | NO | |
| `updated_at` | `timestamp with time zone` | NO | `timezone('utc'::text, now())` |

### `audit_log`
**Kind:** TABLE

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `workspace_id` | `uuid` | YES | |
| `actor_user_id` | `uuid` | YES | |
| `entity_type` | `text` | NO | |
| `entity_id` | `text` | YES | |
| `action` | `text` | NO | |
| `before` | `jsonb` | YES | |
| `after` | `jsonb` | YES | |
| `metadata` | `jsonb` | NO | `'{}'::jsonb` |
| `ip_address` | `inet` | YES | |
| `user_agent` | `text` | YES | |
| `created_at` | `timestamp with time zone` | NO | `timezone('utc'::text, now())` |

### `emails_processed`
**Kind:** TABLE

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `message_id` | `text` | NO | |
| `subject` | `text` | YES | |
| `sender_email` | `text` | YES | |
| `sender_name` | `text` | YES | |
| `received_at` | `timestamp with time zone` | YES | |
| `body_preview` | `text` | YES | |
| `full_body` | `text` | YES | |
| `category` | `text` | YES | |
| `extracted_title` | `text` | YES | |
| `extracted_summary` | `text` | YES | |
| `extracted_due_date` | `date` | YES | |
| `status` | `text` | YES | `'pending'::text` |
| `notion_page_id` | `text` | YES | |
| `created_at` | `timestamp with time zone` | NO | `timezone('utc'::text, now())` |

### `hero_absences`
**Kind:** TABLE

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | `text` | NO | |
| `raw` | `jsonb` | NO | |
| `hero_modified_at` | `timestamp with time zone` | YES | |
| `synced_at` | `timestamp with time zone` | NO | `now()` |
| `is_deleted` | `boolean` | NO | `false` |

### `hero_calendar_events`
**Kind:** TABLE

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | `text` | NO | |
| `raw` | `jsonb` | NO | |
| `hero_modified_at` | `timestamp with time zone` | YES | |
| `synced_at` | `timestamp with time zone` | NO | `now()` |
| `is_deleted` | `boolean` | NO | `false` |
| `title` | `text` | YES | |
| `description` | `text` | YES | |
| `event_start` | `timestamp with time zone` | YES | |
| `event_end` | `timestamp with time zone` | YES | |
| `all_day` | `boolean` | YES | |
| `is_done` | `boolean` | YES | |
| `project_match_id` | `text` | YES | |
| `category_id` | `integer` | YES | |
| `category_name` | `text` | YES | |
| `original_event_start` | `timestamp with time zone` | YES | |
| `reminder_at` | `timestamp with time zone` | YES | |
| `reminder_note` | `text` | YES | |
| `created_at` | `timestamp with time zone` | YES | |

### `hero_company`
**Kind:** TABLE

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | `text` | NO | |
| `raw` | `jsonb` | NO | |
| `hero_modified_at` | `timestamp with time zone` | YES | |
| `synced_at` | `timestamp with time zone` | NO | `now()` |
| `is_deleted` | `boolean` | NO | `false` |

### `hero_company_branches`
**Kind:** TABLE

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | `text` | NO | |
| `raw` | `jsonb` | NO | |
| `hero_modified_at` | `timestamp with time zone` | YES | |
| `synced_at` | `timestamp with time zone` | NO | `now()` |
| `is_deleted` | `boolean` | NO | `false` |

### `hero_contacts`
**Kind:** TABLE

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | `text` | NO | |
| `nr` | `text` | YES | |
| `full_name` | `text` | YES | |
| `company_name` | `text` | YES | |
| `email` | `text` | YES | |
| `phone_home` | `text` | YES | |
| `phone_mobile` | `text` | YES | |
| `category` | `text` | YES | |
| `parent_customer_id` | `text` | YES | |
| `hero_modified_at` | `timestamp with time zone` | YES | |
| `raw` | `jsonb` | NO | |
| `synced_at` | `timestamp with time zone` | NO | `now()` |
| `is_deleted` | `boolean` | NO | `false` |

### `hero_customer_documents`
**Kind:** TABLE

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | `text` | NO | |
| `nr` | `text` | YES | |
| `type` | `text` | YES | |
| `document_type_name` | `text` | YES | |
| `document_base_type` | `text` | YES | |
| `status_code` | `integer` | YES | |
| `status_name` | `text` | YES | |
| `value` | `numeric` | YES | |
| `vat` | `numeric` | YES | |
| `currency` | `text` | YES | |
| `project_match_id` | `text` | YES | |
| `customer_id` | `text` | YES | |
| `partner_id` | `text` | YES | |
| `document_date` | `date` | YES | |
| `created_at_hero` | `timestamp with time zone` | YES | |
| `hero_modified_at` | `timestamp with time zone` | YES | |
| `raw` | `jsonb` | NO | |
| `synced_at` | `timestamp with time zone` | NO | `now()` |
| `is_deleted` | `boolean` | NO | `false` |
| `booking_is_open` | `boolean` | YES | |
| `booking_paid_date` | `date` | YES | |
| `booking_due_date` | `date` | YES | |
| `booking_balance` | `numeric` | YES | |

### `hero_document_types`
**Kind:** TABLE

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | `text` | NO | |
| `raw` | `jsonb` | NO | |
| `hero_modified_at` | `timestamp with time zone` | YES | |
| `synced_at` | `timestamp with time zone` | NO | `now()` |
| `is_deleted` | `boolean` | NO | `false` |

### `hero_field_service_jobs`
**Kind:** TABLE

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | `text` | NO | |
| `raw` | `jsonb` | NO | |
| `hero_modified_at` | `timestamp with time zone` | YES | |
| `synced_at` | `timestamp with time zone` | NO | `now()` |
| `is_deleted` | `boolean` | NO | `false` |
| `project_match_id` | `text` | YES | |
| `partner_id` | `text` | YES | |
| `planned_date` | `date` | YES | |
| `status` | `text` | YES | |
| `done` | `boolean` | YES | |
| `duration_minutes` | `integer` | YES | |
| `type` | `text` | YES | |
| `title` | `text` | YES | |

### `hero_file_uploads`
**Kind:** TABLE

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | `text` | NO | |
| `raw` | `jsonb` | NO | |
| `hero_modified_at` | `timestamp with time zone` | YES | |
| `synced_at` | `timestamp with time zone` | NO | `now()` |
| `is_deleted` | `boolean` | NO | `false` |

### `hero_histories`
**Kind:** TABLE

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | `text` | NO | |
| `raw` | `jsonb` | NO | |
| `hero_modified_at` | `timestamp with time zone` | YES | |
| `synced_at` | `timestamp with time zone` | NO | `now()` |
| `is_deleted` | `boolean` | NO | `false` |
| `project_match_id` | `text` | YES | |
| `user_id_col` | `text` | YES | |
| `user_email` | `text` | YES | |
| `target_id` | `text` | YES | |
| `event_type` | `text` | YES | |
| `entry_date` | `timestamp with time zone` | YES | |
| `custom_title` | `text` | YES | |
| `custom_text` | `text` | YES | |
| `author_name` | `text` | YES | |
| `target` | `text` | YES | |
| `type_code` | `integer` | YES | |
| `role_visibility` | `text` | YES | |

### `hero_measures`
**Kind:** TABLE

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | `text` | NO | |
| `name` | `text` | YES | |
| `short` | `text` | YES | |
| `parent_measure_id` | `text` | YES | |
| `hero_modified_at` | `timestamp with time zone` | YES | |
| `raw` | `jsonb` | NO | |
| `synced_at` | `timestamp with time zone` | NO | `now()` |
| `is_deleted` | `boolean` | NO | `false` |

### `hero_notifications`
**Kind:** TABLE

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | `text` | NO | |
| `raw` | `jsonb` | NO | |
| `hero_modified_at` | `timestamp with time zone` | YES | |
| `synced_at` | `timestamp with time zone` | NO | `now()` |
| `is_deleted` | `boolean` | NO | `false` |
| `title` | `text` | YES | |
| `body` | `text` | YES | |
| `is_read` | `boolean` | YES | |
| `target_id` | `text` | YES | |
| `hero_user_id` | `text` | YES | |
| `notification_date` | `timestamp with time zone` | YES | |
| `category` | `text` | YES | |

### `hero_partners`
**Kind:** TABLE

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | `text` | NO | |
| `full_name` | `text` | YES | |
| `first_name` | `text` | YES | |
| `last_name` | `text` | YES | |
| `email` | `text` | YES | |
| `role` | `text` | YES | |
| `status` | `text` | YES | |
| `user_id` | `text` | YES | |
| `company_id` | `text` | YES | |
| `hero_modified_at` | `timestamp with time zone` | YES | |
| `raw` | `jsonb` | NO | |
| `synced_at` | `timestamp with time zone` | NO | `now()` |
| `is_deleted` | `boolean` | NO | `false` |

### `hero_project_types`
**Kind:** TABLE

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | `text` | NO | |
| `raw` | `jsonb` | NO | |
| `hero_modified_at` | `timestamp with time zone` | YES | |
| `synced_at` | `timestamp with time zone` | NO | `now()` |
| `is_deleted` | `boolean` | NO | `false` |

### `hero_projects`
**Kind:** TABLE

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | `text` | NO | |
| `project_number` | `text` | YES | |
| `project_name` | `text` | YES | |
| `project_type` | `text` | YES | |
| `measure_short` | `text` | YES | |
| `measure_name` | `text` | YES | |
| `department` | `USER-DEFINED` (`project_department`) | NO | `'HAUSTECHNIK'::project_department` |
| `status_name` | `text` | YES | |
| `status_code` | `integer` | YES | |
| `customer_name` | `text` | YES | |
| `customer_email` | `text` | YES | |
| `customer_phone` | `text` | YES | |
| `customer_address` | `text` | YES | |
| `created_at_hero` | `timestamp with time zone` | YES | |
| `hero_modified_at` | `timestamp with time zone` | YES | |
| `maturity_date` | `timestamp with time zone` | YES | |
| `completion_date` | `timestamp with time zone` | YES | |
| `accounting_date` | `timestamp with time zone` | YES | |
| `accounting_amount` | `numeric` | YES | |
| `closing_appointment_date` | `timestamp with time zone` | YES | |
| `rework_scheduled_date` | `timestamp with time zone` | YES | |
| `raw` | `jsonb` | NO | |
| `synced_at` | `timestamp with time zone` | NO | `now()` |
| `is_deleted` | `boolean` | NO | `false` |
| `age_reset_at` | `timestamp with time zone` | YES | |
| `age_reset_note` | `text` | YES | |

### `hero_receipts`
**Kind:** TABLE

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | `text` | NO | |
| `raw` | `jsonb` | NO | |
| `hero_modified_at` | `timestamp with time zone` | YES | |
| `synced_at` | `timestamp with time zone` | NO | `now()` |
| `is_deleted` | `boolean` | NO | `false` |
| `project_match_id` | `text` | YES | |
| `partner_id` | `text` | YES | |
| `value` | `numeric` | YES | |
| `vat` | `numeric` | YES | |
| `currency` | `text` | YES | |
| `category_id` | `text` | YES | |
| `category_name` | `text` | YES | |
| `status_code` | `integer` | YES | |
| `status_name` | `text` | YES | |
| `receipt_date` | `date` | YES | |
| `nr` | `text` | YES | |

### `hero_sync_cursors`
**Kind:** TABLE

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `entity` | `text` | NO | |
| `last_modified_at` | `timestamp with time zone` | YES | |
| `last_full_sync_at` | `timestamp with time zone` | YES | |
| `updated_at` | `timestamp with time zone` | NO | `now()` |

### `hero_sync_runs`
**Kind:** TABLE

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `entity` | `text` | NO | |
| `run_id` | `text` | YES | |
| `started_at` | `timestamp with time zone` | NO | `now()` |
| `finished_at` | `timestamp with time zone` | YES | |
| `status` | `text` | NO | |
| `rows_upserted` | `integer` | YES | `0` |
| `rows_deleted` | `integer` | YES | `0` |
| `error_message` | `text` | YES | |
| `duration_ms` | `integer` | YES | |

### `hero_tasks`
**Kind:** TABLE

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | `text` | NO | |
| `raw` | `jsonb` | NO | |
| `hero_modified_at` | `timestamp with time zone` | YES | |
| `synced_at` | `timestamp with time zone` | NO | `now()` |
| `is_deleted` | `boolean` | NO | `false` |

### `hero_tracking_categories`
**Kind:** TABLE

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | `text` | NO | |
| `raw` | `jsonb` | NO | |
| `hero_modified_at` | `timestamp with time zone` | YES | |
| `synced_at` | `timestamp with time zone` | NO | `now()` |
| `is_deleted` | `boolean` | NO | `false` |

### `hero_tracking_times`
**Kind:** TABLE

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | `text` | NO | |
| `raw` | `jsonb` | NO | |
| `hero_modified_at` | `timestamp with time zone` | YES | |
| `synced_at` | `timestamp with time zone` | NO | `now()` |
| `is_deleted` | `boolean` | NO | `false` |

### `hero_webhooks`
**Kind:** TABLE

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | `text` | NO | |
| `raw` | `jsonb` | NO | |
| `hero_modified_at` | `timestamp with time zone` | YES | |
| `synced_at` | `timestamp with time zone` | NO | `now()` |
| `is_deleted` | `boolean` | NO | `false` |

### `invoice_snoozes`
**Kind:** TABLE

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `invoice_id` | `text` | NO | |
| `snoozed_until` | `date` | NO | |
| `note` | `text` | YES | |
| `snoozed_at` | `timestamp with time zone` | NO | `now()` |
| `updated_at` | `timestamp with time zone` | NO | `now()` |
| `user_email` | `text` | YES | |

### `kpi_snapshots`
**Kind:** TABLE

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `department` | `USER-DEFINED` (`project_department`) | NO | |
| `snapshot_date` | `date` | NO | `CURRENT_DATE` |
| `active_projects` | `integer` | YES | `0` |
| `completed_projects_week` | `integer` | YES | `0` |
| `accounting_transferred_count` | `integer` | YES | `0` |
| `accounting_transferred_amount` | `numeric` | YES | `0.00` |
| `open_reworks` | `integer` | YES | `0` |
| `scheduled_reworks` | `integer` | YES | `0` |
| `open_customer_commitments` | `integer` | YES | `0` |
| `scheduled_closings` | `integer` | YES | `0` |
| `created_at` | `timestamp with time zone` | NO | `timezone('utc'::text, now())` |

### `profiles`
**Kind:** TABLE

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | `uuid` | NO | |
| `email` | `text` | NO | |
| `full_name` | `text` | YES | |
| `first_name` | `text` | YES | |
| `last_name` | `text` | YES | |
| `avatar_url` | `text` | YES | |
| `job_title` | `text` | YES | |
| `default_workspace_id` | `uuid` | YES | |
| `created_at` | `timestamp with time zone` | NO | `timezone('utc'::text, now())` |
| `updated_at` | `timestamp with time zone` | NO | `timezone('utc'::text, now())` |

### `workspace_invitations`
**Kind:** TABLE

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `workspace_id` | `uuid` | NO | |
| `email` | `text` | NO | |
| `role` | `USER-DEFINED` (`workspace_role`) | NO | `'member'::workspace_role` |
| `token` | `text` | NO | `encode(gen_random_bytes(32), 'hex'::text)` |
| `status` | `USER-DEFINED` (`invitation_status`) | NO | `'pending'::invitation_status` |
| `invited_by` | `uuid` | YES | |
| `expires_at` | `timestamp with time zone` | NO | `(timezone('utc'::text, now()) + '7 days'::interval)` |
| `accepted_at` | `timestamp with time zone` | YES | |
| `accepted_by` | `uuid` | YES | |
| `created_at` | `timestamp with time zone` | NO | `timezone('utc'::text, now())` |
| `updated_at` | `timestamp with time zone` | NO | `timezone('utc'::text, now())` |

### `workspace_memberships`
**Kind:** TABLE

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `workspace_id` | `uuid` | NO | |
| `user_id` | `uuid` | NO | |
| `role` | `USER-DEFINED` (`workspace_role`) | NO | `'member'::workspace_role` |
| `status` | `USER-DEFINED` (`membership_status`) | NO | `'active'::membership_status` |
| `invited_by` | `uuid` | YES | |
| `joined_at` | `timestamp with time zone` | YES | |
| `last_seen_at` | `timestamp with time zone` | YES | |
| `created_at` | `timestamp with time zone` | NO | `timezone('utc'::text, now())` |
| `updated_at` | `timestamp with time zone` | NO | `timezone('utc'::text, now())` |

### `workspaces`
**Kind:** TABLE

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `slug` | `text` | NO | |
| `name` | `text` | NO | |
| `status` | `USER-DEFINED` (`workspace_status`) | NO | `'active'::workspace_status` |
| `billing_email` | `text` | YES | |
| `metadata` | `jsonb` | NO | `'{}'::jsonb` |
| `created_by` | `uuid` | YES | |
| `archived_at` | `timestamp with time zone` | YES | |
| `created_at` | `timestamp with time zone` | NO | `timezone('utc'::text, now())` |
| `updated_at` | `timestamp with time zone` | NO | `timezone('utc'::text, now())` |

## Views & Materialized Views

### `hero_dashboard_projects`
**Kind:** MATERIALIZED VIEW

Aggregierte Projekt-Sicht für Dashboard-Tiles und Projektliste; wird via `refresh_hero_dashboard_projects()` neu aufgebaut. Spalten nicht im Column-Snapshot enthalten — Definition siehe Migration.

### `hero_status_transitions`
**Kind:** MATERIALIZED VIEW

Status-Übergänge je Projekt aus `hero_histories` extrahiert; Basis für Step-Duration- und Throughput-RPCs.

### `hero_step_weekly`
**Kind:** MATERIALIZED VIEW

Wochenaggregation von Step-Übergängen für Trend-Charts (Weekly-Throughput, Step-Durations).

## RPCs / Funktionen

### Dashboard / Cashflow
- `compute_cashflow_forecast(p_department)` → table — Forecast-Buckets
- `compute_cashflow_summary(p_department)` → jsonb — Cash-Tab Top-Tiles
- `compute_invoice_status_breakdown(p_department)` → table
- `load_forecast_projects(p_department, p_min_days, p_max_days, p_limit)` → table
- `load_invoices_by_aging_bucket(p_department, p_min_days, p_max_days, p_limit)` → table
- `load_invoices_by_status(p_department, p_status_code, p_limit)` → table

### Dashboard / Throughput & Durations
- `compute_daily_throughput(p_department, p_from, p_to)` → table
- `compute_weekly_throughput(p_department, p_from, p_to)` → table
- `compute_duration_metrics(p_department, p_from, p_to)` → table
- `compute_step_durations(p_department, p_from, p_to)` → table
- `compute_step_transition_counts(p_department, p_from, p_to)` → table
- `compute_timeframe_deltas(p_department, p_from, p_to)` → table
- `compute_kwp_stats(p_department)` → table

### Dashboard / Refresh
- `refresh_hero_dashboard_projects()` → void — MV-Refresh-Helper

### Logbuch
- `logbuch_aggregations(p_user_email, p_project_id, p_event_type, p_date_from, p_date_to)` → jsonb

### Auth / Workspace
- `has_workspace_role(p_workspace_id, p_min_role, p_user_id)` → boolean
- `is_workspace_member(p_workspace_id, p_user_id)` → boolean
- `handle_new_user()` → trigger — legt Profile bei Auth-Signup an

### Trigger-Funktionen
- `set_app_settings_updated_at()` → trigger
- `set_updated_at()` → trigger — generischer `updated_at`-Touch
- `hero_calendar_events_extract_typed` → trigger — extrahiert getypte Spalten aus `raw` JSONB
- `hero_histories_extract_typed` → trigger — dito für `hero_histories`
- `hero_notifications_extract` → trigger — dito für `hero_notifications`

## Hero-Mirror-Notes

Wichtige Paid/Open-Spalten auf `hero_customer_documents`:
- `booking_is_open` (BOOLEAN) — Hero-paid-status; TRUE = noch offen, FALSE = bezahlt
- `booking_paid_date` (DATE) — Zahlungseingang
- `booking_due_date` (DATE) — Hero-Fälligkeitsdatum
- `booking_balance` (NUMERIC) — Rest-offen bei Teilzahlung

Allgemeines Mirror-Pattern (gilt für die meisten `hero_*`-Tabellen):
- `id` (TEXT) — Hero-Primärschlüssel
- `raw` (JSONB) — vollständige Hero-API-Antwort
- `hero_modified_at` (TIMESTAMPTZ) — Hero-seitiger Modify-Stempel, Basis für Inkrementell-Sync
- `synced_at` (TIMESTAMPTZ, default `now()`) — letzter Mirror-Schreibzugriff
- `is_deleted` (BOOLEAN, default `false`) — Soft-Delete-Flag

Für hochfrequent abgefragte Tabellen werden zusätzlich getypte Top-Level-Spalten via Trigger aus `raw` extrahiert (`hero_calendar_events`, `hero_histories`, `hero_notifications`, `hero_projects`, `hero_customer_documents`, `hero_receipts`, `hero_field_service_jobs`, `hero_contacts`, `hero_partners`, `hero_measures`).
