-- PROJ-3 Hero → Supabase Mirror (Core)
-- Creates infrastructure tables (hero_sync_runs, hero_sync_cursors) and
-- the 5 core entity mirror tables (hero_projects, hero_contacts,
-- hero_customer_documents, hero_measures, hero_partners).
--
-- RLS: authenticated users may SELECT, service_role may do everything.

-- ---------------------------------------------------------------------------
-- Infrastructure
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.hero_sync_runs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity        TEXT NOT NULL,
    run_id        TEXT,
    started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at   TIMESTAMPTZ,
    status        TEXT NOT NULL CHECK (status IN ('running', 'success', 'error')),
    rows_upserted INT DEFAULT 0,
    rows_deleted  INT DEFAULT 0,
    error_message TEXT,
    duration_ms   INT
);

CREATE INDEX IF NOT EXISTS idx_hero_sync_runs_entity_started
    ON public.hero_sync_runs (entity, started_at DESC);

ALTER TABLE public.hero_sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hero_sync_runs_auth_read" ON public.hero_sync_runs;
CREATE POLICY "hero_sync_runs_auth_read"
    ON public.hero_sync_runs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "hero_sync_runs_service_all" ON public.hero_sync_runs;
CREATE POLICY "hero_sync_runs_service_all"
    ON public.hero_sync_runs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.hero_sync_cursors (
    entity            TEXT PRIMARY KEY,
    last_modified_at  TIMESTAMPTZ,
    last_full_sync_at TIMESTAMPTZ,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hero_sync_cursors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hero_sync_cursors_auth_read" ON public.hero_sync_cursors;
CREATE POLICY "hero_sync_cursors_auth_read"
    ON public.hero_sync_cursors FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "hero_sync_cursors_service_all" ON public.hero_sync_cursors;
CREATE POLICY "hero_sync_cursors_service_all"
    ON public.hero_sync_cursors FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- hero_projects (primary entity)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.hero_projects (
    id                TEXT PRIMARY KEY,
    project_number    TEXT,
    name              TEXT,
    department        TEXT CHECK (department IN ('PV', 'WP', 'HAUSTECHNIK')),
    project_type      TEXT,
    measure_short     TEXT,
    measure_name      TEXT,
    customer_name     TEXT,
    customer_email    TEXT,
    customer_phone    TEXT,
    customer_address  TEXT,
    current_status    TEXT,
    created_at        TIMESTAMPTZ,
    hero_modified_at  TIMESTAMPTZ,
    maturity_date     TIMESTAMPTZ,
    raw               JSONB NOT NULL,
    synced_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted        BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_hero_projects_department
    ON public.hero_projects (department);
CREATE INDEX IF NOT EXISTS idx_hero_projects_modified
    ON public.hero_projects (hero_modified_at DESC);
CREATE INDEX IF NOT EXISTS idx_hero_projects_project_number
    ON public.hero_projects (project_number);

ALTER TABLE public.hero_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hero_projects_auth_read" ON public.hero_projects;
CREATE POLICY "hero_projects_auth_read"
    ON public.hero_projects FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "hero_projects_service_all" ON public.hero_projects;
CREATE POLICY "hero_projects_service_all"
    ON public.hero_projects FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- hero_contacts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.hero_contacts (
    id                TEXT PRIMARY KEY,
    first_name        TEXT,
    last_name         TEXT,
    company_name      TEXT,
    email             TEXT,
    phone             TEXT,
    raw               JSONB NOT NULL,
    hero_modified_at  TIMESTAMPTZ,
    synced_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted        BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_hero_contacts_modified
    ON public.hero_contacts (hero_modified_at DESC);

ALTER TABLE public.hero_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hero_contacts_auth_read" ON public.hero_contacts;
CREATE POLICY "hero_contacts_auth_read"
    ON public.hero_contacts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "hero_contacts_service_all" ON public.hero_contacts;
CREATE POLICY "hero_contacts_service_all"
    ON public.hero_contacts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- hero_customer_documents
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.hero_customer_documents (
    id                   TEXT PRIMARY KEY,
    project_match_id     TEXT,
    nr                   TEXT,
    type                 TEXT,
    document_base_type   TEXT,
    status_code          TEXT,
    status_name          TEXT,
    value                NUMERIC,
    vat                  NUMERIC,
    file_url             TEXT,
    raw                  JSONB NOT NULL,
    hero_created_at      TIMESTAMPTZ,
    hero_modified_at     TIMESTAMPTZ,
    synced_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted           BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_hero_customer_documents_project
    ON public.hero_customer_documents (project_match_id);
CREATE INDEX IF NOT EXISTS idx_hero_customer_documents_modified
    ON public.hero_customer_documents (hero_modified_at DESC);

ALTER TABLE public.hero_customer_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hero_customer_documents_auth_read" ON public.hero_customer_documents;
CREATE POLICY "hero_customer_documents_auth_read"
    ON public.hero_customer_documents FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "hero_customer_documents_service_all" ON public.hero_customer_documents;
CREATE POLICY "hero_customer_documents_service_all"
    ON public.hero_customer_documents FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- hero_measures
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.hero_measures (
    id                TEXT PRIMARY KEY,
    name              TEXT,
    short             TEXT,
    raw               JSONB NOT NULL,
    hero_modified_at  TIMESTAMPTZ,
    synced_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted        BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.hero_measures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hero_measures_auth_read" ON public.hero_measures;
CREATE POLICY "hero_measures_auth_read"
    ON public.hero_measures FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "hero_measures_service_all" ON public.hero_measures;
CREATE POLICY "hero_measures_service_all"
    ON public.hero_measures FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- hero_partners
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.hero_partners (
    id                TEXT PRIMARY KEY,
    first_name        TEXT,
    last_name         TEXT,
    email             TEXT,
    raw               JSONB NOT NULL,
    hero_modified_at  TIMESTAMPTZ,
    synced_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted        BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.hero_partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hero_partners_auth_read" ON public.hero_partners;
CREATE POLICY "hero_partners_auth_read"
    ON public.hero_partners FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "hero_partners_service_all" ON public.hero_partners;
CREATE POLICY "hero_partners_service_all"
    ON public.hero_partners FOR ALL TO service_role USING (true) WITH CHECK (true);
