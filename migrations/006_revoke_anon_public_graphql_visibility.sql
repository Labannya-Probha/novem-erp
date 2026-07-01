-- Supabase lint 0026: prevent public GraphQL schema discovery with anon key.
-- Revoke anon SELECT from all existing public schema relations and defaults.

DO $$
DECLARE
  rel record;
  owner_role record;
BEGIN
  FOR rel IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
  LOOP
    EXECUTE format('REVOKE SELECT ON TABLE public.%I FROM anon', rel.relname);
  END LOOP;

  FOR owner_role IN
    SELECT DISTINCT pg_get_userbyid(c.relowner) AS role_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND pg_get_userbyid(c.relowner) IS NOT NULL
  LOOP
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE SELECT ON TABLES FROM anon',
      owner_role.role_name
    );
  END LOOP;
END
$$;
