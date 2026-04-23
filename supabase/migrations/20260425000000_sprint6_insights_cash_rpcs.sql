-- Sprint 6 — RPC-Aggregation für Insights + Cash.
--
-- Ersetzt die 10–30k-Zeilen-Paginationen in loadCashflow,
-- loadWeeklyThroughput, loadStepDurations, loadKwpStats und
-- loadDurationMetrics durch einzelne RPC-Roundtrips in Postgres.

-- ---------------------------------------------------------------------------
-- compute_cashflow_summary
-- Liefert die komplette CashflowDto (aging, pipeline, billingRate,
-- revenueByMonth, totals) als JSONB — ein einziger Roundtrip.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_cashflow_summary(
  p_department text
) RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  WITH dept_projects AS (
    SELECT id, department_key, step_name, is_finished, is_accounting_open
    FROM public.hero_dashboard_projects
    WHERE (
      p_department = 'GESAMT' AND department_key IS NOT NULL
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
    -- Für Billing-Rate: alle Invoices (auch nicht-offene) je Projekt
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
    LEFT JOIN aging_rows a
      ON a.bucket = bd.bucket
  ),
  totals AS (
    SELECT
      COALESCE(SUM(value), 0)::numeric AS total_open_eur,
      COUNT(*)::bigint                 AS total_open_count
    FROM open_invoices
  ),
  pipeline AS (
    SELECT
      COALESCE(SUM(CASE WHEN in_pipeline THEN value ELSE 0 END), 0)::numeric AS pipeline_eur,
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
    SELECT
      to_char(date_trunc('month', created_at_hero), 'YYYY-MM') AS month,
      department_key,
      SUM(value)::numeric AS eur
    FROM open_invoices
    WHERE created_at_hero IS NOT NULL
      AND department_key IS NOT NULL
    GROUP BY 1, 2
    ORDER BY 1
  ),
  months_wide AS (
    SELECT
      month,
      SUM(CASE WHEN department_key = 'PV'              THEN eur ELSE 0 END)::numeric AS pv,
      SUM(CASE WHEN department_key = 'PV_GEWERBE'      THEN eur ELSE 0 END)::numeric AS pv_gewerbe,
      SUM(CASE WHEN department_key = 'WP'              THEN eur ELSE 0 END)::numeric AS wp,
      SUM(CASE WHEN department_key = 'KLIMA'           THEN eur ELSE 0 END)::numeric AS klima,
      SUM(CASE WHEN department_key = 'GEBAEUDETECHNIK' THEN eur ELSE 0 END)::numeric AS gt
    FROM months
    GROUP BY 1
    ORDER BY 1
  ),
  months_last_12 AS (
    SELECT * FROM (
      SELECT *, row_number() OVER (ORDER BY month DESC) AS rn FROM months_wide
    ) r WHERE rn <= 12
  )
  SELECT jsonb_build_object(
    'aging',
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'bucket',   bucket,
            'minDays',  min_days,
            'maxDays',  max_days,
            'count',    cnt,
            'totalEur', eur
          )
          ORDER BY sort_order
        )
        FROM aging_full
      ), '[]'::jsonb),
    'totalOpenEur',   (SELECT total_open_eur   FROM totals),
    'totalOpenCount', (SELECT total_open_count FROM totals),
    'pipelineRevenueEur',      (SELECT pipeline_eur  FROM pipeline),
    'pipelineRevenueInvoices', (SELECT pipeline_count FROM pipeline),
    'billingRate',
      (SELECT jsonb_build_object(
        'billed',    billed,
        'completed', completed,
        'percent',
          CASE WHEN completed = 0 THEN 0
               ELSE round((billed::numeric * 1000.0 / completed) ) / 10.0
          END
      ) FROM billing),
    'revenueByMonth',
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'month',           month,
            'PV',              pv,
            'PV_GEWERBE',      pv_gewerbe,
            'WP',              wp,
            'KLIMA',           klima,
            'GEBAEUDETECHNIK', gt
          )
          ORDER BY month
        )
        FROM months_last_12
      ), '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION public.compute_cashflow_summary(text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- compute_weekly_throughput
-- Wöchentliche Flow-Raten (new / completed / accounting / rework / reopens).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_weekly_throughput(
  p_department text,
  p_from timestamptz,
  p_to   timestamptz
) RETURNS TABLE (
  week_start   date,
  new_projects bigint,
  completed    bigint,
  accounting   bigint,
  rework       bigint,
  reopens      bigint
)
LANGUAGE sql
STABLE
AS $$
  WITH t AS (
    SELECT *
    FROM public.hero_status_transitions
    WHERE entered_at >= p_from
      AND (p_to IS NULL OR entered_at < p_to)
      AND step_name IS NOT NULL
      AND (
        p_department = 'GESAMT'  AND department_key IS NOT NULL
        OR
        p_department <> 'GESAMT' AND department_key = p_department
      )
  ),
  classified AS (
    SELECT
      t.project_match_id,
      t.history_index,
      date_trunc('week', t.entered_at)::date AS week_start,
      lower(t.step_name) ~ '(abgeschlossen|archiviert)' AS is_completed,
      lower(t.step_name) ~ '(abschlussrechnung|kundenrechnung|schlussrechnung|teil-rg|teilrechnung)' AS is_accounting,
      lower(t.step_name) ~ '(nacharbeit|reklamation)' AS is_rework
    FROM t
  ),
  finished_before AS (
    SELECT id
    FROM public.hero_dashboard_projects
    WHERE last_finish_at IS NOT NULL
      AND last_finish_at < p_from
  )
  SELECT
    c.week_start,
    COUNT(*) FILTER (WHERE history_index = 1)::bigint              AS new_projects,
    COUNT(*) FILTER (WHERE is_completed)::bigint                   AS completed,
    COUNT(*) FILTER (WHERE is_accounting)::bigint                  AS accounting,
    COUNT(*) FILTER (WHERE is_rework)::bigint                      AS rework,
    COUNT(*) FILTER (
      WHERE is_rework AND project_match_id IN (SELECT id FROM finished_before)
    )::bigint                                                      AS reopens
  FROM classified c
  GROUP BY 1
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.compute_weekly_throughput(text, timestamptz, timestamptz) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- compute_step_durations
-- Ø / Median-Verweildauer pro Step (in Tagen).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_step_durations(
  p_department text,
  p_from timestamptz,
  p_to   timestamptz
) RETURNS TABLE (
  step_id     text,
  step_name   text,
  avg_days    numeric,
  median_days numeric,
  sample_size bigint
)
LANGUAGE sql
STABLE
AS $$
  WITH t AS (
    SELECT step_id, step_name, duration_seconds
    FROM public.hero_status_transitions
    WHERE entered_at >= p_from
      AND (p_to IS NULL OR entered_at < p_to)
      AND step_id IS NOT NULL
      AND step_name IS NOT NULL
      AND duration_seconds IS NOT NULL
      AND (
        p_department = 'GESAMT'  AND department_key IS NOT NULL
        OR
        p_department <> 'GESAMT' AND department_key = p_department
      )
  )
  SELECT
    step_id,
    MIN(step_name) AS step_name,
    round(AVG(duration_seconds) / 86400.0, 1)::numeric AS avg_days,
    round((percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_seconds) / 86400.0)::numeric, 1) AS median_days,
    COUNT(*)::bigint AS sample_size
  FROM t
  GROUP BY step_id
  ORDER BY avg_days DESC;
$$;

GRANT EXECUTE ON FUNCTION public.compute_step_durations(text, timestamptz, timestamptz) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- compute_kwp_stats
-- Summe + Durchschnitt der Anlagenleistung.
-- Nutzt die kwp_kw-Spalte der MV direkt (kein Regex mehr nötig).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_kwp_stats(
  p_department text
) RETURNS TABLE (
  total_kwp         numeric,
  avg_kwp           numeric,
  projects_with_kwp bigint,
  projects_completed bigint
)
LANGUAGE sql
STABLE
AS $$
  WITH finished AS (
    SELECT kwp_kw
    FROM public.hero_dashboard_projects
    WHERE is_finished = true
      AND (
        p_department = 'GESAMT'  AND department_key IS NOT NULL
        OR
        p_department <> 'GESAMT' AND department_key = p_department
      )
  )
  SELECT
    round(COALESCE(SUM(kwp_kw), 0)::numeric, 1) AS total_kwp,
    CASE
      WHEN COUNT(kwp_kw) > 0
        THEN round(AVG(kwp_kw)::numeric, 1)
      ELSE NULL
    END AS avg_kwp,
    COUNT(kwp_kw)::bigint AS projects_with_kwp,
    COUNT(*)::bigint      AS projects_completed
  FROM finished;
$$;

GRANT EXECUTE ON FUNCTION public.compute_kwp_stats(text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- compute_duration_metrics
-- Durchlauf-Metriken: Ramp-up, Ausführung, Abrechnung, Gesamt.
-- Basis: hero_status_transitions (kein JSONB-Parse in JS mehr).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_duration_metrics(
  p_department text,
  p_from timestamptz,
  p_to   timestamptz
) RETURNS TABLE (
  metric_key  text,
  avg_days    numeric,
  median_days numeric,
  sample_size bigint
)
LANGUAGE sql
STABLE
AS $$
  WITH dept_projects AS (
    SELECT id, created_at_hero, completion_date
    FROM public.hero_dashboard_projects
    WHERE (
      p_department = 'GESAMT' AND department_key IS NOT NULL
      OR
      p_department <> 'GESAMT' AND department_key = p_department
    )
  ),
  -- Early step enter-timestamps per Projekt aus den Transitions.
  steps AS (
    SELECT
      t.project_match_id,
      MIN(t.entered_at) FILTER (
        WHERE lower(t.step_name) ~ '(auftragsbestätigung|^\s*ab\b|\bab\b)'
      ) AS t_ab,
      MIN(t.entered_at) FILTER (
        WHERE lower(t.step_name) ~ '(montage|zählermontage|projektvorbereitung|umsetzungsbeginn|projektplanung|heizlastberechnung)'
      ) AS t_montage,
      MIN(t.entered_at) FILTER (
        WHERE lower(t.step_name) ~ '(abschlussrechnung|kundenrechnung|schlussrechnung)'
      ) AS t_abschluss
    FROM public.hero_status_transitions t
    WHERE t.step_name IS NOT NULL
      AND t.project_match_id IN (SELECT id FROM dept_projects)
    GROUP BY t.project_match_id
  ),
  combined AS (
    SELECT
      dp.id,
      dp.created_at_hero AS t_create,
      dp.completion_date AS t_done,
      s.t_ab, s.t_montage, s.t_abschluss
    FROM dept_projects dp
    LEFT JOIN steps s ON s.project_match_id = dp.id
    WHERE
      -- Range-Filter auf completion_date; offen mit gesetztem from überspringen.
      (p_from IS NULL OR (dp.completion_date IS NOT NULL AND dp.completion_date >= p_from))
      AND (p_to IS NULL OR dp.completion_date IS NULL OR dp.completion_date < p_to)
  ),
  samples AS (
    SELECT 'ramp_up'     AS metric, EXTRACT(EPOCH FROM (t_montage  - t_ab))       / 86400.0 AS days FROM combined WHERE t_ab       IS NOT NULL AND t_montage  IS NOT NULL AND t_montage  > t_ab
    UNION ALL
    SELECT 'ausfuehrung' AS metric, EXTRACT(EPOCH FROM (t_abschluss - t_montage)) / 86400.0 AS days FROM combined WHERE t_montage  IS NOT NULL AND t_abschluss IS NOT NULL AND t_abschluss > t_montage
    UNION ALL
    SELECT 'abrechnung'  AS metric, EXTRACT(EPOCH FROM (t_done     - t_abschluss))/ 86400.0 AS days FROM combined WHERE t_abschluss IS NOT NULL AND t_done     IS NOT NULL AND t_done     > t_abschluss
    UNION ALL
    SELECT 'gesamt'      AS metric, EXTRACT(EPOCH FROM (t_done     - t_create))   / 86400.0 AS days FROM combined WHERE t_create   IS NOT NULL AND t_done     IS NOT NULL AND t_done     > t_create
  )
  SELECT
    metric AS metric_key,
    round(AVG(days)::numeric, 1) AS avg_days,
    round((percentile_cont(0.5) WITHIN GROUP (ORDER BY days))::numeric, 1) AS median_days,
    COUNT(*)::bigint AS sample_size
  FROM samples
  GROUP BY metric;
$$;

GRANT EXECUTE ON FUNCTION public.compute_duration_metrics(text, timestamptz, timestamptz) TO anon, authenticated, service_role;
