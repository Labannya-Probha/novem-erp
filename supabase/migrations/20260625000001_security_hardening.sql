-- =============================================================
-- Security hardening v2
-- Addresses remaining Supabase linter findings:
--   0011 function_search_path_mutable
--   0014 extension_in_public
--   0026 pg_graphql_anon_table_exposed
--   0028 anon_security_definer_function_executable
--   0029 authenticated_security_definer_function_executable
-- Note: lint 0027 (authenticated table exposure) is intentional
--       — RLS policies restrict row visibility per tenant.
-- Note: lint auth_leaked_password_protection must be enabled in
--       Supabase Dashboard → Auth → Password settings (no SQL).
-- =============================================================

-- 1. Pin search_path on all flagged public functions (lint 0011)
--    Uses dynamic SQL so it covers every overload automatically.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('set_res_no', 'is_admin', 'handle_new_user')
  LOOP
    EXECUTE format(
      'ALTER FUNCTION public.%I(%s) SET search_path = public, pg_catalog',
      r.proname, r.args
    );
  END LOOP;
END $$;


-- 2. Revoke SELECT from anon on every public table/view/mat-view/foreign-table
--    (lint 0026 — no ERP data should be accessible before sign-in)
DO $$
DECLARE
  rel RECORD;
BEGIN
  FOR rel IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
  LOOP
    EXECUTE format('REVOKE SELECT ON public.%I FROM anon', rel.relname);
  END LOOP;
END $$;

-- Prevent future tables from inheriting anon SELECT via default privileges
DO $$
DECLARE
  owner_name TEXT;
BEGIN
  FOR owner_name IN
    SELECT DISTINCT pg_get_userbyid(c.relowner)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND pg_get_userbyid(c.relowner) IS NOT NULL
  LOOP
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE SELECT ON TABLES FROM anon',
      owner_name
    );
  END LOOP;
END $$;


-- 3. Revoke EXECUTE from anon on all SECURITY DEFINER functions
--    that must not be callable before sign-in (lint 0028).
--    email_for_username is intentionally excluded: it is required by the
--    username-based login flow (anon calls it to resolve email before auth).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname IN (
        'bootstrap_tenant',
        'handle_new_user',
        'is_admin',
        'post_journal',
        'reset_tenant_seq',
        'rls_auto_enable',
        'set_res_no',
        'sync_register_void',
        'sync_settlement',
        'wipe_module'
      )
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon',
      r.proname, r.args
    );
  END LOOP;
END $$;


-- 4. Revoke EXECUTE from authenticated on admin/internal-only functions
--    (lint 0029 — regular signed-in users must not call these destructive RPCs)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname IN (
        'bootstrap_tenant',
        'handle_new_user',
        'reset_tenant_seq',
        'rls_auto_enable',
        'sync_register_void',
        'sync_settlement',
        'wipe_module'
      )
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM authenticated',
      r.proname, r.args
    );
  END LOOP;
END $$;


-- 5. Move http extension out of public schema (lint 0014)
--    Idempotent: skips if already moved or not installed.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'http') THEN
    IF EXISTS (
      SELECT 1 FROM pg_extension e
      JOIN pg_namespace n ON n.oid = e.extnamespace
      WHERE e.extname = 'http' AND n.nspname = 'public'
    ) THEN
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
  END IF;
END $$;
