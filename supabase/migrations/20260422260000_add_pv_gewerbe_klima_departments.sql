-- Add PV_GEWERBE and KLIMA to the project_department enum and hero_projects CHECK.
--
-- Background: the materialized view (20260422170000_hero_dashboard_projects_view.sql)
-- already emits these two department_key values, but the base table CHECK and the
-- kpi_snapshots enum only knew PV / WP / HAUSTECHNIK. This migration brings both
-- in sync so future inserts / historic-KPI writes don't fail.

-- 1. Extend project_department enum (Postgres requires ALTER TYPE … ADD VALUE)
DO $$ BEGIN
  ALTER TYPE public.project_department ADD VALUE IF NOT EXISTS 'PV_GEWERBE';
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.project_department ADD VALUE IF NOT EXISTS 'KLIMA';
EXCEPTION WHEN others THEN NULL;
END $$;

-- 2. Drop the stale CHECK on hero_projects.department and replace it with the
--    full set of valid department keys.
ALTER TABLE public.hero_projects
  DROP CONSTRAINT IF EXISTS hero_projects_department_check;

ALTER TABLE public.hero_projects
  ADD CONSTRAINT hero_projects_department_check
  CHECK (department IN ('PV', 'PV_GEWERBE', 'WP', 'KLIMA', 'HAUSTECHNIK', 'GEBAEUDETECHNIK'));
