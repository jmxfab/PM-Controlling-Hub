-- RPCs that move heavy JS-side aggregation into Postgres so the dashboard
-- does one round-trip + a few-row response instead of paginating thousands
-- of rows across 30-60 fetches.
--
-- See src/lib/supabase/hero-pipeline-queries.ts for the previous JS
-- implementations that we replace.

-- ---------------------------------------------------------------------------
-- 1. Per-step transition counts (entered + left) inside a timeframe.
--    Used by: loadStepTransitionCounts  (was: 2x pagination loop with
--    30k-row ceiling per direction).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_step_transition_counts(
  p_department text,
  p_from timestamptz,
  p_to   timestamptz
) RETURNS TABLE (
  step_group   text,
  entered_count bigint,
  left_count   bigint
)
LANGUAGE sql
STABLE
AS $$
  WITH entered AS (
    SELECT
      regexp_replace(t.step_name, '^[^A-Za-zÄÖÜäöüß0-9]+', '') AS step_group,
      COUNT(*) AS cnt
    FROM public.hero_status_transitions t
    WHERE t.step_name IS NOT NULL
      AND t.entered_at >= p_from
      AND t.entered_at <  p_to
      AND (
        p_department = 'GESAMT'
          AND t.department_key IS NOT NULL
        OR
        p_department <> 'GESAMT'
          AND t.department_key = p_department
      )
    GROUP BY 1
  ),
  leftx AS (
    SELECT
      regexp_replace(t.step_name, '^[^A-Za-zÄÖÜäöüß0-9]+', '') AS step_group,
      COUNT(*) AS cnt
    FROM public.hero_status_transitions t
    WHERE t.step_name IS NOT NULL
      AND t.left_at   IS NOT NULL
      AND t.left_at  >= p_from
      AND t.left_at  <  p_to
      AND (
        p_department = 'GESAMT'
          AND t.department_key IS NOT NULL
        OR
        p_department <> 'GESAMT'
          AND t.department_key = p_department
      )
    GROUP BY 1
  )
  SELECT
    COALESCE(e.step_group, l.step_group) AS step_group,
    COALESCE(e.cnt, 0)::bigint           AS entered_count,
    COALESCE(l.cnt, 0)::bigint           AS left_count
  FROM entered e
  FULL OUTER JOIN leftx l USING (step_group)
  WHERE COALESCE(e.step_group, l.step_group) IS NOT NULL
    AND btrim(COALESCE(e.step_group, l.step_group)) <> '';
$$;

GRANT EXECUTE ON FUNCTION public.compute_step_transition_counts(text, timestamptz, timestamptz) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Timeframe-delta aggregation (new / completed / rework / accounting /
--    reopened / overdueBecame) as a single round-trip.
--    Used by: loadTimeframeDeltas  (was: 3 pagination loops + IN-batches).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_timeframe_deltas(
  p_department text,
  p_from timestamptz,
  p_to   timestamptz
) RETURNS TABLE (
  new_projects             bigint,
  completed_transitions    bigint,
  rework_transitions       bigint,
  accounting_transitions   bigint,
  reopened_transitions     bigint,
  accounting_amount        numeric,
  total_transitions        bigint,
  overdue_became           bigint
)
LANGUAGE sql
STABLE
AS $$
  WITH t AS (
    SELECT *
    FROM public.hero_status_transitions
    WHERE entered_at >= p_from
      AND entered_at <  p_to
      AND (
        p_department = 'GESAMT'  AND department_key IS NOT NULL
        OR
        p_department <> 'GESAMT' AND department_key = p_department
      )
  ),
  finished_before AS (
    SELECT id
    FROM public.hero_dashboard_projects
    WHERE last_finish_at IS NOT NULL
      AND last_finish_at < p_from
  ),
  classified AS (
    SELECT
      t.*,
      t.step_name ILIKE '%abgeschlossen%' OR t.step_name ILIKE '%archiviert%' AS is_finished_step,
      t.step_name ILIKE '%nacharbeit%'    OR t.step_name ILIKE '%reklamation%' AS is_rework_step,
      (t.step_name ILIKE '%abschlussrechnung%'
        OR t.step_name ILIKE '%kundenrechnung%'
        OR t.step_name ILIKE '%schlussrechnung%'
        OR t.step_name ILIKE '%teil-rg%'
        OR t.step_name ILIKE '%teilrechnung%'
      ) AS is_accounting_step
    FROM t
  ),
  transitions_agg AS (
    SELECT
      COUNT(DISTINCT CASE WHEN history_index = 1 THEN project_match_id END)::bigint AS new_projects,
      COUNT(*) FILTER (WHERE is_finished_step)::bigint   AS completed_transitions,
      COUNT(*) FILTER (WHERE is_rework_step)::bigint     AS rework_transitions,
      COUNT(*) FILTER (WHERE is_accounting_step)::bigint AS accounting_transitions,
      COUNT(*) FILTER (
        WHERE is_rework_step AND project_match_id IN (SELECT id FROM finished_before)
      )::bigint AS reopened_transitions,
      COUNT(*)::bigint AS total_transitions
    FROM classified
  ),
  accounting_amount_agg AS (
    SELECT COALESCE(
      SUM(COALESCE(p.accounting_open_amount, p.accounting_amount, 0)),
      0
    )::numeric AS accounting_amount
    FROM public.hero_dashboard_projects p
    WHERE p.id IN (
      SELECT DISTINCT project_match_id FROM classified WHERE is_accounting_step
    )
  ),
  overdue_became_agg AS (
    SELECT COUNT(*)::bigint AS overdue_became
    FROM public.hero_dashboard_projects
    WHERE maturity_date IS NOT NULL
      AND maturity_date >= p_from
      AND maturity_date <  p_to
      AND is_finished = false
      AND (
        p_department = 'GESAMT'  AND department_key IS NOT NULL
        OR
        p_department <> 'GESAMT' AND department_key = p_department
      )
  )
  SELECT
    ta.new_projects,
    ta.completed_transitions,
    ta.rework_transitions,
    ta.accounting_transitions,
    ta.reopened_transitions,
    aa.accounting_amount,
    ta.total_transitions,
    ob.overdue_became
  FROM transitions_agg ta
  CROSS JOIN accounting_amount_agg aa
  CROSS JOIN overdue_became_agg ob;
$$;

GRANT EXECUTE ON FUNCTION public.compute_timeframe_deltas(text, timestamptz, timestamptz) TO anon, authenticated, service_role;
