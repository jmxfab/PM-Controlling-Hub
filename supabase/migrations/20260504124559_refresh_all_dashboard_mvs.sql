-- Bug-Fix: refresh_hero_dashboard_projects() refresht alle 3 Dashboard-
-- MVs, nicht nur hero_dashboard_projects.
--
-- Problem: hero_status_transitions + hero_step_weekly wurden NIE per
-- Sync-RPC angefasst → permanent stale. Insights-Tab "Aenderungen im
-- Zeitraum" zeigte fuer alle aktuellen Wochen 0 / 0 / 0 (User-Report
-- 04.05.2026), weil compute_timeframe_deltas() ueber
-- hero_status_transitions liest und dort die letzten Transitions vom
-- Vortag des letzten MV-Refresh standen.
--
-- Fix: Funktion umbauen von SQL-Body auf plpgsql-Block der alle 3 MVs
-- refresht. Beide zusaetzlichen MVs haben unique indexes (*_pk), daher
-- CONCURRENTLY moeglich (kein Lock waehrend der Sync laeuft).

CREATE OR REPLACE FUNCTION public.refresh_hero_dashboard_projects()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.hero_dashboard_projects;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.hero_status_transitions;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.hero_step_weekly;
END;
$function$;
