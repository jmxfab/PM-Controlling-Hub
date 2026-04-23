ALTER TABLE public.hero_histories
  ADD COLUMN IF NOT EXISTS project_match_id TEXT,
  ADD COLUMN IF NOT EXISTS user_id_col      TEXT,
  ADD COLUMN IF NOT EXISTS user_email       TEXT,
  ADD COLUMN IF NOT EXISTS target_id        TEXT,
  ADD COLUMN IF NOT EXISTS event_type       TEXT,
  ADD COLUMN IF NOT EXISTS entry_date       TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS hero_histories_project_idx ON public.hero_histories (project_match_id);
CREATE INDEX IF NOT EXISTS hero_histories_user_idx    ON public.hero_histories (user_id_col);
CREATE INDEX IF NOT EXISTS hero_histories_date_idx    ON public.hero_histories (entry_date DESC);

-- Backfill from raw JSONB (re-runnable: WHERE project_match_id IS NULL)
UPDATE public.hero_histories SET
  project_match_id = raw->>'target_project_match_id',
  user_id_col      = raw->>'user_id',
  user_email       = raw->'user'->>'email',
  target_id        = raw->>'target_id',
  event_type       = raw->>'type',
  entry_date       = (raw->>'created')::timestamptz
WHERE project_match_id IS NULL;
