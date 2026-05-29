-- RPC: Cashflow-Forecast — welche offenen Rechnungssummen werden
-- nach Projekt-Fälligkeit (maturity_date) wann zahlungswirksam?
-- Buckets: Überfällig / 0-7 / 8-14 / 15-30 / 31-60 / 61-90 / >90 Tage.
CREATE OR REPLACE FUNCTION public.compute_cashflow_forecast(
  p_department TEXT DEFAULT 'GESAMT'
)
RETURNS TABLE(
  bucket TEXT,
  bucket_order INT,
  min_days INT,
  max_days INT,
  project_count BIGINT,
  open_eur NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH buckets AS (
    SELECT 'Überfällig'::TEXT AS bucket, 0::INT AS bucket_order, -36500::INT AS min_days, 0::INT AS max_days
    UNION ALL SELECT '0-7 Tage', 1, 0, 8
    UNION ALL SELECT '8-14 Tage', 2, 8, 15
    UNION ALL SELECT '15-30 Tage', 3, 15, 31
    UNION ALL SELECT '31-60 Tage', 4, 31, 61
    UNION ALL SELECT '61-90 Tage', 5, 61, 91
    UNION ALL SELECT '> 90 Tage', 6, 91, 36500
  ),
  proj AS (
    SELECT
      p.id,
      p.maturity_date,
      COALESCE(p.accounting_open_amount, 0) AS open_amount,
      EXTRACT(DAY FROM (p.maturity_date - now()))::INT AS days_until
    FROM hero_dashboard_projects p
    WHERE NOT p.is_finished
      AND p.maturity_date IS NOT NULL
      AND (
        (p_department = 'GESAMT' AND p.department_key IS NOT NULL)
        OR (p_department <> 'GESAMT' AND p.department_key = p_department)
      )
  )
  SELECT
    b.bucket,
    b.bucket_order,
    b.min_days,
    b.max_days,
    COUNT(*)::BIGINT AS project_count,
    COALESCE(SUM(p.open_amount), 0)::NUMERIC AS open_eur
  FROM buckets b
  LEFT JOIN proj p
    ON p.days_until >= b.min_days
   AND p.days_until < b.max_days
  GROUP BY b.bucket, b.bucket_order, b.min_days, b.max_days
  ORDER BY b.bucket_order;
$$;

GRANT EXECUTE ON FUNCTION public.compute_cashflow_forecast(TEXT) TO authenticated, service_role;

-- Dazu passend: Drill-Down-Projekte pro Forecast-Bucket mit offenen
-- Rechnungssummen + Projekt-Metadata.
CREATE OR REPLACE FUNCTION public.load_forecast_projects(
  p_department TEXT DEFAULT 'GESAMT',
  p_min_days INT DEFAULT 0,
  p_max_days INT DEFAULT 8,
  p_limit INT DEFAULT 500
)
RETURNS TABLE(
  project_match_id TEXT,
  project_number TEXT,
  project_name TEXT,
  customer_name TEXT,
  step_name TEXT,
  maturity_date TIMESTAMPTZ,
  days_until INT,
  open_amount NUMERIC,
  open_count INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS project_match_id,
    p.project_number,
    p.project_name,
    p.customer_name,
    p.step_name,
    p.maturity_date,
    EXTRACT(DAY FROM (p.maturity_date - now()))::INT AS days_until,
    COALESCE(p.accounting_open_amount, 0)::NUMERIC AS open_amount,
    COALESCE(p.accounting_open_count, 0)::INT AS open_count
  FROM hero_dashboard_projects p
  WHERE NOT p.is_finished
    AND p.maturity_date IS NOT NULL
    AND (
      (p_department = 'GESAMT' AND p.department_key IS NOT NULL)
      OR (p_department <> 'GESAMT' AND p.department_key = p_department)
    )
    AND EXTRACT(DAY FROM (p.maturity_date - now()))::INT >= p_min_days
    AND EXTRACT(DAY FROM (p.maturity_date - now()))::INT < p_max_days
  ORDER BY p.maturity_date ASC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.load_forecast_projects(TEXT, INT, INT, INT) TO authenticated, service_role;
