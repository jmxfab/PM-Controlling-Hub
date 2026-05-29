-- Hero-Projekt-Verknuepfung fuer Mail-Tasks (vom Auto-Hero-Match
-- und AI-Reply genutzt — Spalten waren in der Codebase vorausgesetzt
-- aber nicht migriert).
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS hero_project_id uuid,
  ADD COLUMN IF NOT EXISTS hero_project_number text,
  ADD COLUMN IF NOT EXISTS hero_project_name text;

CREATE INDEX IF NOT EXISTS tasks_hero_project_id_idx
  ON public.tasks (hero_project_id)
  WHERE hero_project_id IS NOT NULL;
