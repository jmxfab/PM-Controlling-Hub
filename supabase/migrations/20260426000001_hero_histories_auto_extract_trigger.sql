CREATE OR REPLACE FUNCTION public.hero_histories_extract_typed()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.project_match_id := NEW.raw->>'target_project_match_id';
  NEW.user_id_col      := NEW.raw->>'user_id';
  NEW.user_email       := NEW.raw->'user'->>'email';
  NEW.target_id        := NEW.raw->>'target_id';
  NEW.event_type       := NEW.raw->>'type';
  NEW.entry_date       := (NEW.raw->>'created')::timestamptz;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hero_histories_extract_typed_trg ON public.hero_histories;
CREATE TRIGGER hero_histories_extract_typed_trg
  BEFORE INSERT OR UPDATE ON public.hero_histories
  FOR EACH ROW EXECUTE FUNCTION public.hero_histories_extract_typed();
