-- Performance indexes for dashboard / insights / pipeline queries.
--
-- Target: 2-5x faster Supabase response times across controlling hub by
-- indexing the columns actually used in WHERE / filter predicates.
--
-- The CONCURRENTLY option cannot be used inside Supabase migrations
-- (migrations run in a transaction). We use plain CREATE INDEX IF NOT
-- EXISTS; this briefly locks the objects but the tables involved are
-- small-to-medium (thousands/tens-of-thousands of rows).

-- ---------------------------------------------------------------------------
-- hero_dashboard_projects (materialized view)
-- ---------------------------------------------------------------------------

-- Snapshot filter: rowsFor(department) -> .filter(row.department_key ===).
CREATE INDEX IF NOT EXISTS idx_hero_dash_projects_department_finished
    ON public.hero_dashboard_projects (department_key, is_finished);

-- loadKpiProjects (delta_overdue_became) + Fälligkeits-Timeframe-Filter.
CREATE INDEX IF NOT EXISTS idx_hero_dash_projects_maturity_open
    ON public.hero_dashboard_projects (maturity_date)
    WHERE is_finished = false;

-- Reopen-Check: loadTimeframeDeltas / loadKpiProjects queries by last_finish_at.
CREATE INDEX IF NOT EXISTS idx_hero_dash_projects_last_finish_at
    ON public.hero_dashboard_projects (last_finish_at)
    WHERE last_finish_at IS NOT NULL;

-- completion_date range scans (completedLastWeek / delta_completed).
CREATE INDEX IF NOT EXISTS idx_hero_dash_projects_completion_date
    ON public.hero_dashboard_projects (completion_date)
    WHERE completion_date IS NOT NULL;

-- created_at_hero (newThisWeek / delta_new precomputes).
CREATE INDEX IF NOT EXISTS idx_hero_dash_projects_created_hero
    ON public.hero_dashboard_projects (created_at_hero)
    WHERE created_at_hero IS NOT NULL;

-- Accounting-KPI: rows filtered by is_accounting_open + department_key.
CREATE INDEX IF NOT EXISTS idx_hero_dash_projects_accounting_open
    ON public.hero_dashboard_projects (department_key, is_accounting_open)
    WHERE is_finished = false;

-- step_group grouping (Pipeline-Panel) + is_finished pre-filter.
CREATE INDEX IF NOT EXISTS idx_hero_dash_projects_step_group
    ON public.hero_dashboard_projects (step_group, is_finished);

-- ---------------------------------------------------------------------------
-- hero_status_transitions (base table, biggest performance win)
-- ---------------------------------------------------------------------------
--
-- All guarded with DO blocks because the table is created outside of the
-- migrations folder (Supabase-managed materialized data stream). We only
-- add indexes if the table already exists.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'hero_status_transitions'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_hero_transitions_entered_dept
        ON public.hero_status_transitions (department_key, entered_at);

    CREATE INDEX IF NOT EXISTS idx_hero_transitions_left_dept
        ON public.hero_status_transitions (department_key, left_at)
        WHERE left_at IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_hero_transitions_project
        ON public.hero_status_transitions (project_match_id, entered_at);

    CREATE INDEX IF NOT EXISTS idx_hero_transitions_step_dept_entered
        ON public.hero_status_transitions (department_key, step_name, entered_at);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- kpi_snapshots (historic chart data)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'kpi_snapshots'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_dept_date
        ON public.kpi_snapshots (department, snapshot_date DESC);
  END IF;
END $$;
