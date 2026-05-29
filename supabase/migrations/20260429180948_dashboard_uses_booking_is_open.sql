-- Dashboard-weite Umstellung auf Hero-Booking als Wahrheit fuer "offen":
-- 1) compute_cashflow_summary RPC zaehlt jetzt nur noch Rechnungen die
--    laut booking_is_open noch nicht bezahlt sind
-- 2) hero_dashboard_projects MV-Spalten accounting_open_amount/count
--    zaehlen ebenfalls nur unbezahlte
--
-- COALESCE(booking_is_open, true) <> false:
--   - true  → offen (zaehlt)
--   - NULL  → noch nicht gesynct → permissiv: zaehlt
--   - false → bezahlt → wird ausgeschlossen
--
-- Zusaetzlich: GESAMT-Department in compute_cashflow_summary auf
-- ('PV','WP') beschraenkt — Gewerbe/Klima/Gebaeudetechnik kommen
-- spaeter mit eigener Logik.
--
-- Beispiel-Effekt vorher/nachher (WP, 2026-04-29):
--   - vorher: 1.318.200 € / 158 offene Rechnungen
--   - jetzt:    199.572 € / 13 offene Rechnungen

CREATE OR REPLACE FUNCTION public.compute_cashflow_summary(p_department text)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $function$
  WITH dept_projects AS (
    SELECT id, department_key, step_name, is_finished, is_accounting_open
    FROM public.hero_dashboard_projects
    WHERE (
      p_department = 'GESAMT' AND department_key IN ('PV', 'WP')
      OR
      p_department <> 'GESAMT' AND department_key = p_department
    )
  ),
  open_invoices AS (
    SELECT d.project_match_id, d.value, d.created_at_hero,
           p.department_key,
           (p.is_accounting_open
             OR lower(coalesce(p.step_name, '')) ~ 'montage|zählermontage|umsetzungsbeginn'
           ) AS in_pipeline
    FROM public.hero_customer_documents d
    JOIN dept_projects p ON p.id = d.project_match_id
    WHERE d.is_deleted = false
      AND d.status_code IN (100, 200)
      AND COALESCE(d.booking_is_open, true) <> false
      AND d.value IS NOT NULL
      AND (
        lower(coalesce(d.type, ''))              LIKE '%rechnung%'
        OR lower(coalesce(d.type, ''))              LIKE '%invoice%'
        OR lower(coalesce(d.document_type_name, '')) LIKE '%rechnung%'
        OR lower(coalesce(d.document_type_name, '')) LIKE '%invoice%'
        OR lower(coalesce(d.document_base_type, '')) LIKE '%rechnung%'
        OR lower(coalesce(d.document_base_type, '')) LIKE '%invoice%'
      )
  ),
  all_invoices AS (
    SELECT DISTINCT d.project_match_id
    FROM public.hero_customer_documents d
    JOIN dept_projects p ON p.id = d.project_match_id
    WHERE d.is_deleted = false
      AND (
        lower(coalesce(d.type, ''))              LIKE '%rechnung%'
        OR lower(coalesce(d.type, ''))              LIKE '%invoice%'
        OR lower(coalesce(d.document_type_name, '')) LIKE '%rechnung%'
        OR lower(coalesce(d.document_type_name, '')) LIKE '%invoice%'
        OR lower(coalesce(d.document_base_type, '')) LIKE '%rechnung%'
        OR lower(coalesce(d.document_base_type, '')) LIKE '%invoice%'
      )
  ),
  aging_rows AS (
    SELECT bucket, min_days, max_days, total_count, total_eur
    FROM (
      SELECT
        CASE
          WHEN age_d <  14 THEN '0–14 Tage'
          WHEN age_d <  30 THEN '14–30 Tage'
          WHEN age_d <  60 THEN '30–60 Tage'
          WHEN age_d <  90 THEN '60–90 Tage'
          ELSE                  '> 90 Tage'
        END AS bucket,
        CASE
          WHEN age_d <  14 THEN 0
          WHEN age_d <  30 THEN 14
          WHEN age_d <  60 THEN 30
          WHEN age_d <  90 THEN 60
          ELSE                  90
        END AS min_days,
        CASE
          WHEN age_d <  14 THEN 14
          WHEN age_d <  30 THEN 30
          WHEN age_d <  60 THEN 60
          WHEN age_d <  90 THEN 90
          ELSE                  NULL
        END AS max_days,
        COUNT(*)::bigint  AS total_count,
        COALESCE(SUM(value), 0)::numeric AS total_eur
      FROM (
        SELECT value,
               EXTRACT(EPOCH FROM (now() - created_at_hero)) / 86400.0 AS age_d
        FROM open_invoices
        WHERE created_at_hero IS NOT NULL
      ) s
      GROUP BY 1, 2, 3
    ) a
  ),
  bucket_defs(bucket, min_days, max_days, sort_order) AS (
    VALUES
      ('0–14 Tage',    0,  14,   1),
      ('14–30 Tage',  14,  30,   2),
      ('30–60 Tage',  30,  60,   3),
      ('60–90 Tage',  60,  90,   4),
      ('> 90 Tage',   90,  NULL, 5)
  ),
  aging_full AS (
    SELECT bd.bucket, bd.min_days, bd.max_days,
           COALESCE(a.total_count, 0)::bigint AS cnt,
           COALESCE(a.total_eur,   0)::numeric AS eur,
           bd.sort_order
    FROM bucket_defs bd
    LEFT JOIN aging_rows a ON a.bucket = bd.bucket
  ),
  totals AS (
    SELECT COALESCE(SUM(value), 0)::numeric AS total_open_eur,
           COUNT(*)::bigint                 AS total_open_count
    FROM open_invoices
  ),
  pipeline AS (
    SELECT COALESCE(SUM(CASE WHEN in_pipeline THEN value ELSE 0 END), 0)::numeric AS pipeline_eur,
           COUNT(*) FILTER (WHERE in_pipeline)::bigint AS pipeline_count
    FROM open_invoices
  ),
  billing AS (
    SELECT
      (SELECT COUNT(*) FROM dept_projects WHERE is_finished)::bigint AS completed,
      (SELECT COUNT(*) FROM dept_projects p
         WHERE is_finished
           AND EXISTS (SELECT 1 FROM all_invoices ai WHERE ai.project_match_id = p.id)
      )::bigint AS billed
  ),
  months AS (
    SELECT to_char(date_trunc('month', created_at_hero), 'YYYY-MM') AS month,
           department_key,
           SUM(value)::numeric AS eur
    FROM open_invoices
    WHERE created_at_hero IS NOT NULL AND department_key IS NOT NULL
    GROUP BY 1, 2 ORDER BY 1
  ),
  months_wide AS (
    SELECT month,
      SUM(CASE WHEN department_key = 'PV'              THEN eur ELSE 0 END)::numeric AS pv,
      SUM(CASE WHEN department_key = 'PV_GEWERBE'      THEN eur ELSE 0 END)::numeric AS pv_gewerbe,
      SUM(CASE WHEN department_key = 'WP'              THEN eur ELSE 0 END)::numeric AS wp,
      SUM(CASE WHEN department_key = 'KLIMA'           THEN eur ELSE 0 END)::numeric AS klima,
      SUM(CASE WHEN department_key = 'GEBAEUDETECHNIK' THEN eur ELSE 0 END)::numeric AS gt
    FROM months GROUP BY 1 ORDER BY 1
  ),
  months_last_12 AS (
    SELECT * FROM (SELECT *, row_number() OVER (ORDER BY month DESC) AS rn FROM months_wide) r
    WHERE rn <= 12
  )
  SELECT jsonb_build_object(
    'aging', COALESCE((SELECT jsonb_agg(jsonb_build_object('bucket', bucket, 'minDays', min_days, 'maxDays', max_days, 'count', cnt, 'totalEur', eur) ORDER BY sort_order) FROM aging_full), '[]'::jsonb),
    'totalOpenEur', (SELECT total_open_eur FROM totals),
    'totalOpenCount', (SELECT total_open_count FROM totals),
    'pipelineRevenueEur', (SELECT pipeline_eur FROM pipeline),
    'pipelineRevenueInvoices', (SELECT pipeline_count FROM pipeline),
    'billingRate', (SELECT jsonb_build_object('billed', billed, 'completed', completed, 'percent', CASE WHEN completed = 0 THEN 0 ELSE round((billed::numeric * 1000.0 / completed)) / 10.0 END) FROM billing),
    'revenueByMonth', COALESCE((SELECT jsonb_agg(jsonb_build_object('month', month, 'PV', pv, 'PV_GEWERBE', pv_gewerbe, 'WP', wp, 'KLIMA', klima, 'GEBAEUDETECHNIK', gt) ORDER BY month) FROM months_last_12), '[]'::jsonb)
  );
$function$;

-- MV: accounting_open_amount/count beruecksichtigen booking_is_open

DROP MATERIALIZED VIEW IF EXISTS public.hero_dashboard_projects;

CREATE MATERIALIZED VIEW public.hero_dashboard_projects AS
 WITH base AS (
         SELECT p.id, p.project_number, p.project_name, (p.raw ->> 'type_id'::text) AS type_id,
                CASE (p.raw ->> 'type_id'::text)
                    WHEN '36933'::text THEN 'PV'::text
                    WHEN '36936'::text THEN 'PV_GEWERBE'::text
                    WHEN '36934'::text THEN 'WP'::text
                    WHEN '39820'::text THEN 'KLIMA'::text
                    WHEN '36935'::text THEN 'GEBAEUDETECHNIK'::text
                    WHEN '29899'::text THEN 'GEBAEUDETECHNIK'::text
                    ELSE NULL::text
                END AS department_key,
            p.status_name, p.status_code,
            (((p.raw -> 'current_project_match_status'::text) -> 'step'::text) ->> 'id'::text) AS step_id,
            (((p.raw -> 'current_project_match_status'::text) -> 'step'::text) ->> 'name'::text) AS step_name,
            COALESCE(((((p.raw -> 'current_project_match_status'::text) -> 'step'::text) ->> 'sort_order'::text))::integer, 0) AS step_sort_order,
            COALESCE(((((p.raw -> 'current_project_match_status'::text) -> 'step'::text) ->> 'status_code'::text))::integer, p.status_code, 0) AS step_status_code,
            p.customer_name, p.customer_email, p.customer_phone, p.customer_address,
            p.measure_short, p.measure_name, p.created_at_hero, p.hero_modified_at,
            (((p.raw -> 'current_project_match_status'::text) ->> 'maturity_date'::text))::timestamp with time zone AS maturity_date,
            p.completion_date, p.accounting_date, p.rework_scheduled_date, p.closing_appointment_date,
            p.age_reset_at, p.age_reset_note,
            (lower(COALESCE((((p.raw -> 'current_project_match_status'::text) -> 'step'::text) ->> 'name'::text), p.status_name, ''::text)) ~ '(abgeschlossen|archiv|fertig|finished|abschlussrechnung|bewertungspool)'::text) AS is_finished,
            p.raw, p.synced_at
           FROM hero_projects p
          WHERE (p.is_deleted = false)
        ), invoice_agg AS (
         SELECT d.project_match_id,
            sum(d.value) FILTER (WHERE (d.value IS NOT NULL)) AS total_amount,
            sum(d.value) FILTER (WHERE (
              d.value IS NOT NULL
              AND d.status_code = ANY (ARRAY[100, 200])
              AND COALESCE(d.booking_is_open, true) <> false
            )) AS open_amount,
            count(*) FILTER (WHERE (
              d.status_code = ANY (ARRAY[100, 200])
              AND COALESCE(d.booking_is_open, true) <> false
            )) AS open_count
           FROM hero_customer_documents d
          WHERE ((d.is_deleted = false) AND ((lower(COALESCE(d.type, ''::text)) ~~ '%invoice%'::text) OR (lower(COALESCE(d.type, ''::text)) ~~ '%rechnung%'::text) OR (lower(COALESCE(d.document_type_name, ''::text)) ~~ '%invoice%'::text) OR (lower(COALESCE(d.document_type_name, ''::text)) ~~ '%rechnung%'::text) OR (lower(COALESCE(d.document_base_type, ''::text)) ~~ '%invoice%'::text) OR (lower(COALESCE(d.document_base_type, ''::text)) ~~ '%rechnung%'::text)))
          GROUP BY d.project_match_id
        ), status_history_sorted AS (
         SELECT b_1.id AS project_id, jsonb_array_elements(COALESCE((b_1.raw -> 'project_match_statuses'::text), '[]'::jsonb)) AS entry FROM base b_1
        ), history_parsed AS (
         SELECT h.project_id, (h.entry ->> 'id'::text) AS status_row_id,
            ((h.entry -> 'step'::text) ->> 'id'::text) AS step_id,
            ((h.entry -> 'step'::text) ->> 'name'::text) AS step_name,
            ((h.entry ->> 'created'::text))::timestamp with time zone AS created_at,
            ((h.entry ->> 'modified'::text))::timestamp with time zone AS modified_at,
            row_number() OVER (PARTITION BY h.project_id ORDER BY ((h.entry ->> 'created'::text))::timestamp with time zone DESC NULLS LAST) AS rn
           FROM status_history_sorted h
        ), previous_step AS (
         SELECT history_parsed.project_id, history_parsed.step_id AS previous_step_id, history_parsed.step_name AS previous_step_name, history_parsed.created_at AS previous_step_at FROM history_parsed WHERE (history_parsed.rn = 2)
        ), last_finish AS (
         SELECT history_parsed.project_id, max(history_parsed.created_at) AS last_finish_at FROM history_parsed
          WHERE (lower(COALESCE(history_parsed.step_name, ''::text)) ~ '(abgeschlossen|archiv|fertig|finished|abschlussrechnung|bewertungspool)'::text) GROUP BY history_parsed.project_id
        ), last_rework AS (
         SELECT history_parsed.project_id, max(history_parsed.created_at) AS last_rework_at FROM history_parsed
          WHERE (lower(COALESCE(history_parsed.step_name, ''::text)) ~ '(nacharbeit|reklamation)'::text) GROUP BY history_parsed.project_id
        )
 SELECT b.id, b.project_number, b.project_name, b.type_id, b.department_key, b.status_name, b.status_code,
    b.step_id, b.step_name, b.step_sort_order, b.step_status_code,
    ((b.step_status_code * 1000000) + (b.step_sort_order * 1000)) AS step_order,
    regexp_replace(COALESCE(b.step_name, ''::text), '^[^[:alnum:]ÄÖÜäöüß]+'::text, ''::text) AS step_group,
    prev.previous_step_id, prev.previous_step_name, prev.previous_step_at,
    b.customer_name, b.customer_email, b.customer_phone, b.customer_address,
    b.measure_short, b.measure_name, b.created_at_hero, b.hero_modified_at, b.maturity_date,
    b.completion_date, b.accounting_date, b.rework_scheduled_date, b.closing_appointment_date,
    b.is_finished,
    ((lf.last_finish_at IS NOT NULL) AND (lr.last_rework_at IS NOT NULL) AND (lr.last_rework_at > lf.last_finish_at)) AS was_reopened,
    lf.last_finish_at, lr.last_rework_at,
    COALESCE(ia.total_amount, (0)::numeric) AS accounting_amount,
    COALESCE(ia.open_amount, (0)::numeric) AS accounting_open_amount,
    (COALESCE(ia.open_count, (0)::bigint))::integer AS accounting_open_count,
    ((lower(COALESCE(b.step_name, ''::text)) ~ '(abschlussrechnung|kundenrechnung|schlussrechnung|teil-rg|teilrechnung)'::text) AND (COALESCE(ia.open_count, (0)::bigint) > 0)) AS is_accounting_open,
    (NULLIF(regexp_replace(regexp_replace(lower(COALESCE(b.measure_name, ''::text)), '^.*?([0-9]+[.,][0-9]+|[0-9]+)\s*kwp.*$'::text, '\1'::text), ','::text, '.'::text), lower(COALESCE(b.measure_name, ''::text))))::numeric AS kwp_kw,
    b.age_reset_at, b.age_reset_note, b.raw, b.synced_at
   FROM ((((base b
     LEFT JOIN invoice_agg ia ON ((ia.project_match_id = b.id)))
     LEFT JOIN previous_step prev ON ((prev.project_id = b.id)))
     LEFT JOIN last_finish lf ON ((lf.project_id = b.id)))
     LEFT JOIN last_rework lr ON ((lr.project_id = b.id)));

CREATE UNIQUE INDEX hero_dashboard_projects_id_idx ON public.hero_dashboard_projects USING btree (id);
CREATE INDEX hero_dashboard_projects_dept_idx ON public.hero_dashboard_projects USING btree (department_key);
CREATE INDEX hero_dashboard_projects_step_group_idx ON public.hero_dashboard_projects USING btree (step_group);
CREATE INDEX hero_dashboard_projects_maturity_idx ON public.hero_dashboard_projects USING btree (maturity_date);
CREATE INDEX hero_dashboard_projects_dept_finished_idx ON public.hero_dashboard_projects USING btree (department_key, is_finished);
CREATE INDEX hero_dashboard_projects_dept_open_idx ON public.hero_dashboard_projects USING btree (department_key) WHERE (is_finished = false);
CREATE INDEX hero_dashboard_projects_step_open_idx ON public.hero_dashboard_projects USING btree (step_group, is_finished);
CREATE INDEX hero_dashboard_projects_maturity_open_idx ON public.hero_dashboard_projects USING btree (maturity_date) WHERE (is_finished = false);
CREATE INDEX hero_dashboard_projects_age_reset_idx ON public.hero_dashboard_projects USING btree (age_reset_at) WHERE (age_reset_at IS NOT NULL);
