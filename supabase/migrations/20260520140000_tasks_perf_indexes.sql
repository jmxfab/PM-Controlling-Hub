-- Perf-Indexe fuer die haeufigsten tasks-Queries.
-- (1) Mein Tag — flache Liste, sort_order zaehlt
CREATE INDEX IF NOT EXISTS tasks_my_day_idx
  ON public.tasks (is_important DESC, sort_order ASC, in_my_day_at DESC)
  WHERE in_my_day_at IS NOT NULL;

-- (2) Standard-Tabs nach Kategorie + Status, sortiert nach Eingangsdatum
CREATE INDEX IF NOT EXISTS tasks_category_status_created_idx
  ON public.tasks (mail_category, status, created_at DESC)
  WHERE is_automated OR is_user_created;

ANALYZE public.tasks;
