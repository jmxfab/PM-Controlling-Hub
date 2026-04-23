-- Performance: pg_trgm + partial index for invoice_agg in hero_dashboard_projects MV.
--
-- Background: The MV refresh runs invoice_agg which scans all 18,846 rows in
-- hero_customer_documents using LOWER+LIKE patterns ('%rechnung%', '%invoice%').
-- Only 1,692 rows (~9%) are actually invoices.
--
-- Fix 1: Install pg_trgm so GIN trigram indexes can support the LIKE patterns.
-- Fix 2: Partial indexes that let Postgres skip the 91% of non-invoice rows.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Partial index on project_match_id for rows that pass the invoice filter.
-- The MV's invoice_agg CTE groups BY project_match_id — this index lets
-- Postgres do an index scan + group-by instead of a full table seq-scan.
CREATE INDEX IF NOT EXISTS idx_hero_cdocs_invoice_project
  ON public.hero_customer_documents (project_match_id)
  WHERE (
    is_deleted = false
    AND (
      lower(coalesce(type, ''))              LIKE '%rechnung%'
      OR lower(coalesce(type, ''))           LIKE '%invoice%'
      OR lower(coalesce(document_base_type, '')) LIKE '%rechnung%'
      OR lower(coalesce(document_base_type, '')) LIKE '%invoice%'
    )
  );

-- GIN trigram index on type for fast LIKE matching during MV refresh.
CREATE INDEX IF NOT EXISTS idx_hero_cdocs_type_trgm
  ON public.hero_customer_documents
  USING gin (lower(coalesce(type, '')) gin_trgm_ops);

-- GIN trigram index on document_base_type.
CREATE INDEX IF NOT EXISTS idx_hero_cdocs_base_type_trgm
  ON public.hero_customer_documents
  USING gin (lower(coalesce(document_base_type, '')) gin_trgm_ops);
