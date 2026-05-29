-- PROJ-3 Hero → Supabase Mirror (Extended)
--
-- Creates the remaining 14 Hero mirror tables with a uniform minimal schema:
--   id TEXT PK, raw JSONB, hero_modified_at, synced_at, is_deleted + RLS.
-- Typed/indexed columns can be added per entity in follow-up migrations once
-- the read paths need them. Everything lives in `raw` for now.

DO $$
DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY[
        'hero_tasks',
        'hero_tracking_times',
        'hero_tracking_categories',
        'hero_absences',
        'hero_histories',
        'hero_field_service_jobs',
        'hero_calendar_events',
        'hero_file_uploads',
        'hero_receipts',
        'hero_webhooks',
        'hero_project_types',
        'hero_document_types',
        'hero_company_branches',
        'hero_company'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format($fmt$
            CREATE TABLE IF NOT EXISTS public.%I (
                id               TEXT PRIMARY KEY,
                raw              JSONB NOT NULL,
                hero_modified_at TIMESTAMPTZ,
                synced_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
                is_deleted       BOOLEAN NOT NULL DEFAULT false
            );
        $fmt$, tbl);

        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (hero_modified_at DESC);',
                       tbl || '_modified_idx', tbl);

        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);

        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;',
                       tbl || '_auth_read', tbl);
        EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true);',
                       tbl || '_auth_read', tbl);

        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;',
                       tbl || '_service_all', tbl);
        EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);',
                       tbl || '_service_all', tbl);
    END LOOP;
END $$;
