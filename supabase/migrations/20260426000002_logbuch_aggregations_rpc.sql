CREATE OR REPLACE FUNCTION public.logbuch_aggregations(
  p_user_email  TEXT        DEFAULT NULL,
  p_project_id  TEXT        DEFAULT NULL,
  p_event_type  TEXT        DEFAULT NULL,
  p_date_from   TIMESTAMPTZ DEFAULT NULL,
  p_date_to     TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'byUser', COALESCE((
      SELECT jsonb_agg(r ORDER BY r.count DESC)
      FROM (
        SELECT user_email AS email, COUNT(*)::int AS count
        FROM public.hero_histories
        WHERE is_deleted = false
          AND (p_user_email IS NULL OR user_email ILIKE '%' || p_user_email || '%')
          AND (p_project_id IS NULL OR project_match_id = p_project_id)
          AND (p_event_type IS NULL OR event_type = p_event_type)
          AND (p_date_from  IS NULL OR entry_date >= p_date_from)
          AND (p_date_to    IS NULL OR entry_date <= p_date_to)
          AND user_email IS NOT NULL
        GROUP BY user_email
        ORDER BY count DESC
        LIMIT 15
      ) r
    ), '[]'::jsonb),
    'byProject', COALESCE((
      SELECT jsonb_agg(r ORDER BY r.count DESC)
      FROM (
        SELECT
          h.project_match_id AS project_id,
          p.project_number,
          p.project_name,
          COUNT(*)::int AS count
        FROM public.hero_histories h
        LEFT JOIN public.hero_projects p ON h.project_match_id = p.id
        WHERE h.is_deleted = false
          AND (p_user_email IS NULL OR h.user_email ILIKE '%' || p_user_email || '%')
          AND (p_project_id IS NULL OR h.project_match_id = p_project_id)
          AND (p_event_type IS NULL OR h.event_type = p_event_type)
          AND (p_date_from  IS NULL OR h.entry_date >= p_date_from)
          AND (p_date_to    IS NULL OR h.entry_date <= p_date_to)
          AND h.project_match_id IS NOT NULL
        GROUP BY h.project_match_id, p.project_number, p.project_name
        ORDER BY count DESC
        LIMIT 15
      ) r
    ), '[]'::jsonb),
    'byEventType', COALESCE((
      SELECT jsonb_agg(r ORDER BY r.count DESC)
      FROM (
        SELECT event_type AS type, COUNT(*)::int AS count
        FROM public.hero_histories
        WHERE is_deleted = false
          AND (p_user_email IS NULL OR user_email ILIKE '%' || p_user_email || '%')
          AND (p_project_id IS NULL OR project_match_id = p_project_id)
          AND (p_event_type IS NULL OR event_type = p_event_type)
          AND (p_date_from  IS NULL OR entry_date >= p_date_from)
          AND (p_date_to    IS NULL OR entry_date <= p_date_to)
          AND event_type IS NOT NULL
        GROUP BY event_type
        ORDER BY count DESC
        LIMIT 20
      ) r
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
