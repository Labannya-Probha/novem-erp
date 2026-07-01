-- Fix common Supabase security lints reported by the database linter.
--
-- This migration:
--   1. Sets an immutable search_path on helper functions exposed by the app.
--   2. Revokes anon SELECT on existing public-schema relations to prevent
--      GraphQL/introspection discovery.
--   3. Removes the broad public listing policy for the branding bucket.
--   4. Moves the http extension out of the public schema when present.

DO $$
DECLARE
  fn_name text;
BEGIN
  -- Harden helper functions used by RLS and RPCs.
  FOR fn_name IN ('current_tenant_id', 'is_admin', 'my_role', 'set_res_no', 'handle_new_user')
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn_name
    ) THEN
      EXECUTE format('ALTER FUNCTION public.%I() SET search_path = public, pg_catalog', fn_name);

      IF fn_name IN ('current_tenant_id', 'is_admin', 'my_role', 'set_res_no') THEN
        EXECUTE format('ALTER FUNCTION public.%I() SECURITY INVOKER', fn_name);
      END IF;
    END IF;
  END LOOP;
END
$$;

DO $$
DECLARE
  rel record;
  owner_role record;
BEGIN
  -- Revoke anon SELECT from existing public relations so they are not exposed
  -- through the public GraphQL schema / introspection path.
  FOR rel IN
    SELECT c.oid::regclass::text AS relation_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
  LOOP
    EXECUTE format('REVOKE SELECT ON %s FROM anon', rel.relation_name);
  END LOOP;

  -- Ensure new public tables/views do not inherit anon SELECT by default.
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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage'
      AND c.relname = 'objects'
      AND p.polname = 'Branding files are publicly readable'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Branding files are publicly readable" ON storage.objects';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'http') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'extensions') THEN
      CREATE SCHEMA extensions;
    END IF;

    BEGIN
      ALTER EXTENSION http SET SCHEMA extensions;
    EXCEPTION
      WHEN feature_not_supported THEN
        DROP EXTENSION IF EXISTS http;
        CREATE EXTENSION http WITH SCHEMA extensions;
    END;
  END IF;
END
$$;
