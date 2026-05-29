-- MS-To-Do-Style Wichtig-Star: Task wird oben gepinnt + visuell als wichtig markiert.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS is_important boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS tasks_is_important_idx
  ON public.tasks (is_important)
  WHERE is_important = true;

COMMENT ON COLUMN public.tasks.is_important IS
  'MS-To-Do-Style Wichtig-Star: Task wird in der Liste oben gepinnt + visuell als wichtig markiert.';
