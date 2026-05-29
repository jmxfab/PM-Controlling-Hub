-- PROJ-2 hardening: pin search_path on the updated_at trigger function.
-- Prevents search_path hijacking (Supabase advisor lint 0011).
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
