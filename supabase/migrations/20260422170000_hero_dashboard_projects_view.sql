-- Materialized view with everything the dashboard needs per project.
-- Refreshed by the sync engine after projects / customer_documents /
-- project_types finish (see scripts/sync/run-all.ts).

CREATE MATERIALIZED VIEW IF NOT EXISTS public.hero_dashboard_projects AS
SELECT
  p.id,
  p.project_number,
  p.project_name,
  (p.raw->>'type_id')::TEXT AS type_id,
  (CASE (p.raw->>'type_id')
    WHEN '36933' THEN 'PV'
    WHEN '36936' THEN 'PV_GEWERBE'
    WHEN '36934' THEN 'WP'
    WHEN '39820' THEN 'KLIMA'
    WHEN '36935' THEN 'GEBAEUDETECHNIK'
    WHEN '29899' THEN 'GEBAEUDETECHNIK'
    ELSE NULL
  END)::TEXT AS department_key,
  p.status_name,
  p.status_code,
  p.raw->'current_project_match_status'->'step'->>'id' AS step_id,
  p.raw->'current_project_match_status'->'step'->>'name' AS step_name,
  COALESCE((p.raw->'current_project_match_status'->'step'->>'sort_order')::INT, 0) AS step_sort_order,
  p.customer_name,
  p.customer_email,
  p.customer_phone,
  p.customer_address,
  p.measure_short,
  p.measure_name,
  p.created_at_hero,
  p.hero_modified_at,
  (p.raw->'current_project_match_status'->>'maturity_date')::TIMESTAMPTZ AS maturity_date,
  p.completion_date,
  p.accounting_date,
  p.rework_scheduled_date,
  p.closing_appointment_date,
  (LOWER(COALESCE(p.raw->'current_project_match_status'->'step'->>'name', p.status_name, ''))
     SIMILAR TO '%(abgeschlossen|archiviert|fertig|finished)%') AS is_finished,
  COALESCE(acc.total, 0)::NUMERIC AS accounting_amount,
  p.raw AS raw,
  p.synced_at
FROM public.hero_projects p
LEFT JOIN LATERAL (
  SELECT SUM(d.value) AS total
  FROM public.hero_customer_documents d
  WHERE d.project_match_id = p.id
    AND d.is_deleted = false
    AND d.value IS NOT NULL
    AND (
      LOWER(COALESCE(d.type,'')) LIKE '%invoice%' OR LOWER(COALESCE(d.type,'')) LIKE '%rechnung%' OR
      LOWER(COALESCE(d.document_type_name,'')) LIKE '%invoice%' OR LOWER(COALESCE(d.document_type_name,'')) LIKE '%rechnung%' OR
      LOWER(COALESCE(d.document_base_type,'')) LIKE '%invoice%' OR LOWER(COALESCE(d.document_base_type,'')) LIKE '%rechnung%'
    )
) AS acc ON TRUE
WHERE p.is_deleted = false;

CREATE UNIQUE INDEX IF NOT EXISTS hero_dashboard_projects_pk
  ON public.hero_dashboard_projects (id);
CREATE INDEX IF NOT EXISTS hero_dashboard_projects_dept_idx
  ON public.hero_dashboard_projects (department_key);
CREATE INDEX IF NOT EXISTS hero_dashboard_projects_step_idx
  ON public.hero_dashboard_projects (step_id);
CREATE INDEX IF NOT EXISTS hero_dashboard_projects_open_idx
  ON public.hero_dashboard_projects (department_key, is_finished);

ALTER MATERIALIZED VIEW public.hero_dashboard_projects OWNER TO postgres;

GRANT SELECT ON public.hero_dashboard_projects TO authenticated;
GRANT SELECT ON public.hero_dashboard_projects TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_hero_dashboard_projects()
RETURNS void LANGUAGE SQL SECURITY DEFINER AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.hero_dashboard_projects;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_hero_dashboard_projects() TO service_role;
