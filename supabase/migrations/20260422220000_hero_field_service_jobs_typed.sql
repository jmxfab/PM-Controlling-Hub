-- Promote key fields on hero_field_service_jobs from raw JSONB to typed columns.
-- Previously only id/modified/created were fetched; the sync now requests the
-- full selection set so these columns will be populated on next sync run.

ALTER TABLE public.hero_field_service_jobs
  ADD COLUMN IF NOT EXISTS project_match_id  TEXT,
  ADD COLUMN IF NOT EXISTS partner_id        TEXT,
  ADD COLUMN IF NOT EXISTS planned_date      DATE,
  ADD COLUMN IF NOT EXISTS status            TEXT,
  ADD COLUMN IF NOT EXISTS done              BOOLEAN,
  ADD COLUMN IF NOT EXISTS duration_minutes  INT,
  ADD COLUMN IF NOT EXISTS type              TEXT,
  ADD COLUMN IF NOT EXISTS title             TEXT;

CREATE INDEX IF NOT EXISTS hero_field_service_jobs_project_idx
  ON public.hero_field_service_jobs (project_match_id);

CREATE INDEX IF NOT EXISTS hero_field_service_jobs_partner_idx
  ON public.hero_field_service_jobs (partner_id);

CREATE INDEX IF NOT EXISTS hero_field_service_jobs_date_idx
  ON public.hero_field_service_jobs (planned_date DESC);
