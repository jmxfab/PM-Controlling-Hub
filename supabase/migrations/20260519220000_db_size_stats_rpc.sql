-- DB-Size-Monitor RPC: liefert Total-Bytes + Top-10 groesste Tabellen
CREATE OR REPLACE FUNCTION public.compute_db_size_stats()
RETURNS TABLE (
  total_bytes bigint,
  table_count bigint,
  largest_tables jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH sizes AS (
    SELECT
      N.nspname || '.' || C.relname AS full_name,
      pg_total_relation_size(C.oid) AS bytes
    FROM pg_class C
    JOIN pg_namespace N ON N.oid = C.relnamespace
    WHERE C.relkind = 'r'
      AND N.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'auth', 'storage', 'graphql', 'graphql_public', 'realtime', 'supabase_functions', 'extensions', 'vault', 'net', 'pgsodium')
      AND N.nspname NOT LIKE 'pg_temp_%'
      AND N.nspname NOT LIKE 'pg_toast_temp_%'
  ),
  agg AS (
    SELECT
      COALESCE(SUM(bytes), 0)::bigint AS total_bytes,
      COUNT(*)::bigint AS table_count
    FROM sizes
  ),
  top AS (
    SELECT jsonb_agg(jsonb_build_object('name', full_name, 'bytes', bytes) ORDER BY bytes DESC) AS largest_tables
    FROM (
      SELECT full_name, bytes
      FROM sizes
      ORDER BY bytes DESC
      LIMIT 10
    ) t
  )
  SELECT agg.total_bytes, agg.table_count, COALESCE(top.largest_tables, '[]'::jsonb)
  FROM agg, top;
$$;

REVOKE EXECUTE ON FUNCTION public.compute_db_size_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_db_size_stats() TO service_role;
COMMENT ON FUNCTION public.compute_db_size_stats() IS
  'Liefert Gesamt-DB-Groesse + Top-10 groesste Tabellen. Service-Role only.';
