-- Re-create project_department enum (idempotent)
DO $$ BEGIN
  CREATE TYPE public.project_department AS ENUM ('GESAMT', 'PV', 'WP', 'HAUSTECHNIK');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── kpi_snapshots ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kpi_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    department public.project_department NOT NULL,
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    active_projects INTEGER DEFAULT 0,
    completed_projects_week INTEGER DEFAULT 0,
    accounting_transferred_count INTEGER DEFAULT 0,
    accounting_transferred_amount DECIMAL(12,2) DEFAULT 0.00,
    open_reworks INTEGER DEFAULT 0,
    scheduled_reworks INTEGER DEFAULT 0,
    open_customer_commitments INTEGER DEFAULT 0,
    scheduled_closings INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(department, snapshot_date)
);

ALTER TABLE public.kpi_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "kpi_authenticated_read"
      ON public.kpi_snapshots FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "kpi_service_role_all"
      ON public.kpi_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── app_settings ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "app_settings_service_role_all"
      ON public.app_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.set_app_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER trg_app_settings_updated_at
    BEFORE UPDATE ON public.app_settings
    FOR EACH ROW EXECUTE FUNCTION public.set_app_settings_updated_at();

-- ── emails_processed ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.emails_processed (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id TEXT UNIQUE NOT NULL,
    subject TEXT,
    sender_email TEXT,
    sender_name TEXT,
    received_at TIMESTAMP WITH TIME ZONE,
    body_preview TEXT,
    full_body TEXT,
    category TEXT CHECK (category IN ('info', 'aufgabe', 'dringend')),
    extracted_title TEXT,
    extracted_summary TEXT,
    extracted_due_date DATE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'pushed_to_notion')),
    notion_page_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.emails_processed ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "emails_service_role_all"
      ON public.emails_processed FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_emails_processed_status
    ON public.emails_processed (status, received_at DESC);
