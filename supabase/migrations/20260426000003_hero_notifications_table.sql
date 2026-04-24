CREATE TABLE IF NOT EXISTS public.hero_notifications (
  id               TEXT PRIMARY KEY,
  raw              JSONB NOT NULL,
  hero_modified_at TIMESTAMPTZ,
  synced_at        TIMESTAMPTZ DEFAULT now() NOT NULL,
  is_deleted       BOOLEAN DEFAULT false NOT NULL,
  title            TEXT,
  body             TEXT,
  is_read          BOOLEAN,
  target_id        TEXT,
  hero_user_id     TEXT,
  notification_date TIMESTAMPTZ,
  category         TEXT GENERATED ALWAYS AS (
    CASE
      WHEN title ILIKE '%Kommentar von%'        THEN 'aufgabe'
      WHEN title ILIKE '%Projekt zugewiesen%'   THEN 'aufgabe'
      WHEN title ILIKE '%Aufgabe erledigt%'     THEN 'info'
      WHEN title ILIKE '%Dokument hochgeladen%' THEN 'info'
      WHEN title ILIKE '%zugewiesen%'           THEN 'aufgabe'
      ELSE 'info'
    END
  ) STORED
);

CREATE INDEX IF NOT EXISTS hero_notifications_date_idx     ON public.hero_notifications (notification_date DESC);
CREATE INDEX IF NOT EXISTS hero_notifications_read_idx     ON public.hero_notifications (is_read);
CREATE INDEX IF NOT EXISTS hero_notifications_category_idx ON public.hero_notifications (category);
CREATE INDEX IF NOT EXISTS hero_notifications_target_idx   ON public.hero_notifications (target_id);

CREATE OR REPLACE FUNCTION public.hero_notifications_extract()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.title             := NEW.raw->>'title';
  NEW.body              := NEW.raw->>'body';
  NEW.is_read           := (NEW.raw->>'is_read')::boolean;
  NEW.target_id         := NEW.raw->>'target_id';
  NEW.hero_user_id      := NEW.raw->>'user_id';
  NEW.notification_date := (NEW.raw->>'created')::timestamptz;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hero_notifications_extract_trg ON public.hero_notifications;
CREATE TRIGGER hero_notifications_extract_trg
  BEFORE INSERT OR UPDATE ON public.hero_notifications
  FOR EACH ROW EXECUTE FUNCTION public.hero_notifications_extract();
