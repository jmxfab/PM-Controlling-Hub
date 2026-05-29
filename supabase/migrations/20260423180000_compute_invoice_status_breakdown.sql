-- RPC: liefert die Verteilung der Rechnungen nach Hero-Status (was ist
-- mit ihnen passiert — Entwurf / Erstellt / Versendet / Storniert /
-- Gelöscht). Dient dem Cash-Tab als Status-Breakdown-Kachel.
CREATE OR REPLACE FUNCTION public.compute_invoice_status_breakdown(
  p_department TEXT DEFAULT 'GESAMT'
)
RETURNS TABLE(
  status_code INT,
  count BIGINT,
  total_eur NUMERIC
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
  )
  SELECT
    d.status_code::INT,
    COUNT(*)::BIGINT AS count,
    COALESCE(SUM(d.value), 0)::NUMERIC AS total_eur
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
  GROUP BY d.status_code
  ORDER BY d.status_code;
$$;

GRANT EXECUTE ON FUNCTION public.compute_invoice_status_breakdown(TEXT) TO authenticated, service_role;
