-- Add PV_GEWERBE and KLIMA to the project_department enum.
--
-- Background: hero_projects.department is of type project_department (enum).
-- The materialized view (20260422170000_hero_dashboard_projects_view.sql) already
-- emits PV_GEWERBE and KLIMA as department_key values derived from type_id.
-- This migration brings the enum in sync so future inserts don't reject these values.
--
-- Note: ALTER TYPE ... ADD VALUE cannot be used in the same transaction as a
-- reference to the new value. Run as two separate DDL statements (no CHECK needed
-- since the column type itself enforces valid values).

ALTER TYPE public.project_department ADD VALUE IF NOT EXISTS 'PV_GEWERBE';
ALTER TYPE public.project_department ADD VALUE IF NOT EXISTS 'KLIMA';
