-- PROJ-2: app_settings table for UI-managed configuration (e.g. Hero API key)
-- Key/value store so additional settings can be added without new migrations.
CREATE TABLE IF NOT EXISTS public.app_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Security: this table holds secrets (Hero API key). Only the service role
-- client may touch it. Anonymous and authenticated clients have no access.
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (API routes, server-side Hero client).
CREATE POLICY "service_role_full_access"
    ON public.app_settings
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Auto-update updated_at on UPDATE.
CREATE OR REPLACE FUNCTION public.set_app_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_app_settings_updated_at
    BEFORE UPDATE ON public.app_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.set_app_settings_updated_at();
