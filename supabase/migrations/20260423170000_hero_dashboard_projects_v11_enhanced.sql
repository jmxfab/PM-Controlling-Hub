-- Erweitert hero_dashboard_projects um die Spalten, die der Next.js-Code
-- seit Längerem erwartet (siehe src/lib/supabase/hero-read-queries.ts):
--   step_status_code, step_order, step_group, previous_step_*,
--   last_finish_at, last_rework_at, was_reopened, is_accounting_open,
--   accounting_open_amount, accounting_open_count
--
-- Ohne diese Spalten waren `Buchhaltung offen`, `Reopens` und die
-- Schritt-Gruppierung alle auf 0/false gefallen, ohne dass der Client
-- einen Fehler bekommen hat.

DROP MATERIALIZED VIEW IF EXISTS public.hero_dashboard_projects CASCADE;

CREATE MATERIALIZED VIEW public.hero_dashboard_projects AS
WITH base AS (
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
    ((p.raw->'current_project_match_status')->'step'->>'id')::TEXT AS step_id,
    ((p.raw->'current_project_match_status')->'step'->>'name')::TEXT AS step_name,
    COALESCE(((p.raw->'current_project_match_status')->'step'->>'sort_order')::INTEGER, 0) AS step_sort_order,
    COALESCE(((p.raw->'current_project_match_status')->'step'->>'status_code')::INTEGER, p.status_code, 0) AS step_status_code,
    p.customer_name,
    p.customer_email,
    p.customer_phone,
    p.customer_address,
    p.measure_short,
    p.measure_name,
    p.created_at_hero,
    p.hero_modified_at,
    ((p.raw->'current_project_match_status'->>'maturity_date')::TIMESTAMPTZ) AS maturity_date,
    p.completion_date,
    p.accounting_date,
    p.rework_scheduled_date,
    p.closing_appointment_date,
    lower(COALESCE(
      ((p.raw->'current_project_match_status')->'step'->>'name'),
      p.status_name,
      ''
    )) ~ similar_to_escape('%(abgeschlossen|archiviert|fertig|finished)%') AS is_finished,
    p.raw,
    p.synced_at
  FROM hero_projects p
  WHERE p.is_deleted = false
),
invoice_agg AS (
  SELECT
    d.project_match_id,
    SUM(d.value) FILTER (WHERE d.value IS NOT NULL) AS total_amount,
    SUM(d.value) FILTER (WHERE d.value IS NOT NULL AND d.status_code IN (100, 200)) AS open_amount,
    COUNT(*) FILTER (WHERE d.status_code IN (100, 200)) AS open_count
  FROM hero_customer_documents d
  WHERE d.is_deleted = false
    AND (
      lower(COALESCE(d.type, '')) LIKE '%invoice%'
      OR lower(COALESCE(d.type, '')) LIKE '%rechnung%'
      OR lower(COALESCE(d.document_type_name, '')) LIKE '%invoice%'
      OR lower(COALESCE(d.document_type_name, '')) LIKE '%rechnung%'
      OR lower(COALESCE(d.document_base_type, '')) LIKE '%invoice%'
      OR lower(COALESCE(d.document_base_type, '')) LIKE '%rechnung%'
    )
  GROUP BY d.project_match_id
),
status_history_sorted AS (
  SELECT
    b.id AS project_id,
    jsonb_array_elements(COALESCE(b.raw->'project_match_statuses', '[]'::jsonb)) AS entry
  FROM base b
),
history_parsed AS (
  SELECT
    h.project_id,
    (h.entry->>'id')::TEXT AS status_row_id,
    (h.entry->'step'->>'id')::TEXT AS step_id,
    (h.entry->'step'->>'name')::TEXT AS step_name,
    (h.entry->>'created')::TIMESTAMPTZ AS created_at,
    (h.entry->>'modified')::TIMESTAMPTZ AS modified_at,
    row_number() OVER (
      PARTITION BY h.project_id
      ORDER BY (h.entry->>'created')::TIMESTAMPTZ DESC NULLS LAST
    ) AS rn
  FROM status_history_sorted h
),
previous_step AS (
  SELECT
    project_id,
    step_id AS previous_step_id,
    step_name AS previous_step_name,
    created_at AS previous_step_at
  FROM history_parsed
  WHERE rn = 2
),
last_finish AS (
  SELECT project_id, MAX(created_at) AS last_finish_at
  FROM history_parsed
  WHERE lower(COALESCE(step_name, '')) ~ '(abgeschlossen|archiviert|fertig|finished)'
  GROUP BY project_id
),
last_rework AS (
  SELECT project_id, MAX(created_at) AS last_rework_at
  FROM history_parsed
  WHERE lower(COALESCE(step_name, '')) ~ '(nacharbeit|reklamation)'
  GROUP BY project_id
)
SELECT
  b.id,
  b.project_number,
  b.project_name,
  b.type_id,
  b.department_key,
  b.status_name,
  b.status_code,
  b.step_id,
  b.step_name,
  b.step_sort_order,
  b.step_status_code,
  (b.step_status_code * 1000000 + b.step_sort_order * 1000)::INTEGER AS step_order,
  regexp_replace(COALESCE(b.step_name, ''), '^[^[:alnum:]ÄÖÜäöüß]+', '') AS step_group,
  prev.previous_step_id,
  prev.previous_step_name,
  prev.previous_step_at,
  b.customer_name,
  b.customer_email,
  b.customer_phone,
  b.customer_address,
  b.measure_short,
  b.measure_name,
  b.created_at_hero,
  b.hero_modified_at,
  b.maturity_date,
  b.completion_date,
  b.accounting_date,
  b.rework_scheduled_date,
  b.closing_appointment_date,
  b.is_finished,
  (
    lf.last_finish_at IS NOT NULL
    AND lr.last_rework_at IS NOT NULL
    AND lr.last_rework_at > lf.last_finish_at
  ) AS was_reopened,
  lf.last_finish_at,
  lr.last_rework_at,
  COALESCE(ia.total_amount, 0)::NUMERIC AS accounting_amount,
  COALESCE(ia.open_amount, 0)::NUMERIC AS accounting_open_amount,
  COALESCE(ia.open_count, 0)::INTEGER AS accounting_open_count,
  (
    NOT b.is_finished
    AND lower(COALESCE(b.step_name, '')) ~ '(abschlussrechnung|kundenrechnung|schlussrechnung|teil-rg|teilrechnung)'
    AND COALESCE(ia.open_count, 0) > 0
  ) AS is_accounting_open,
  NULLIF(
    regexp_replace(
      regexp_replace(
        lower(COALESCE(b.measure_name, '')),
        '^.*?([0-9]+[.,][0-9]+|[0-9]+)\s*kwp.*$',
        '\1'
      ),
      ',', '.'
    ),
    lower(COALESCE(b.measure_name, ''))
  )::NUMERIC AS kwp_kw,
  b.raw,
  b.synced_at
FROM base b
LEFT JOIN invoice_agg ia ON ia.project_match_id = b.id
LEFT JOIN previous_step prev ON prev.project_id = b.id
LEFT JOIN last_finish lf ON lf.project_id = b.id
LEFT JOIN last_rework lr ON lr.project_id = b.id;

CREATE UNIQUE INDEX hero_dashboard_projects_id_idx
  ON public.hero_dashboard_projects (id);

CREATE INDEX hero_dashboard_projects_dept_idx
  ON public.hero_dashboard_projects (department_key);

CREATE INDEX hero_dashboard_projects_step_group_idx
  ON public.hero_dashboard_projects (step_group);

CREATE INDEX hero_dashboard_projects_maturity_idx
  ON public.hero_dashboard_projects (maturity_date);
