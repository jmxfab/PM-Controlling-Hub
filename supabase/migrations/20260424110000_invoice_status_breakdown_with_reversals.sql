-- Erweitert compute_invoice_status_breakdown um reversal_count +
-- reversal_eur pro Status-Bucket. Stornorechnungen (type =
-- reversal_invoice, negative Werte) sind in count + total_eur bereits
-- saldiert enthalten, werden hier separat ausgewiesen damit der User
-- sieht wie viel Storno die Netto-Summe schon abzieht.
DROP FUNCTION IF EXISTS public.compute_invoice_status_breakdown(TEXT);

CREATE OR REPLACE FUNCTION public.compute_invoice_status_breakdown(
  p_department TEXT DEFAULT 'GESAMT'
)
RETURNS TABLE(
  status_code INT,
  count BIGINT,
  total_eur NUMERIC,
  reversal_count BIGINT,
  reversal_eur NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH dept_projects AS (
    SELECT id
    FROM hero_dashboard_projects
    WHERE (p_department = 'GESAMT' AND department_key IS NOT NULL)
       OR (p_department <> 'GESAMT' AND department_key = p_department)
  ),
  invoices AS (
    SELECT
      d.status_code,
      d.value,
      (d.type = 'reversal_invoice') AS is_reversal
    FROM hero_customer_documents d
    JOIN dept_projects dp ON dp.id = d.project_match_id
    WHERE d.is_deleted = false
      AND (
        lower(COALESCE(d.type, '')) LIKE '%invoice%'
        OR lower(COALESCE(d.type, '')) LIKE '%rechnung%'
        OR lower(COALESCE(d.document_type_name, '')) LIKE '%invoice%'
        OR lower(COALESCE(d.document_type_name, '')) LIKE '%rechnung%'
        OR lower(COALESCE(d.document_base_type, '')) LIKE '%invoice%'
        OR lower(COALESCE(d.document_base_type, '')) LIKE '%rechnung%'
      )
  )
  SELECT
    status_code::INT,
    COUNT(*)::BIGINT AS count,
    COALESCE(SUM(value), 0)::NUMERIC AS total_eur,
    COUNT(*) FILTER (WHERE is_reversal)::BIGINT AS reversal_count,
    COALESCE(SUM(value) FILTER (WHERE is_reversal), 0)::NUMERIC AS reversal_eur
  FROM invoices
  GROUP BY status_code
  ORDER BY status_code;
$$;

GRANT EXECUTE ON FUNCTION public.compute_invoice_status_breakdown(TEXT) TO authenticated, service_role;
