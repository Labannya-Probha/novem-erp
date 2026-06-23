-- Migration 009: Fix Supabase security linter warnings
-- Addresses:
--   lint 0027 (pg_graphql_authenticated_table_exposed) — objects visible in
--             the GraphQL schema to every signed-in user
--   lint 0028 (anon_security_definer_function_executable) — SECURITY DEFINER
--             functions callable without signing in
--   lint 0029 (authenticated_security_definer_function_executable) — SECURITY
--             DEFINER functions callable by any signed-in user

-- ============================================================
-- PART 1: GraphQL schema exposure (lint 0027)
-- ============================================================
-- Strategy:
--   • Reporting views that are NOT queried directly by the JS client →
--     revoke SELECT from authenticated so they disappear from the schema.
--   • Tables / views that the JS client DOES query via PostgREST (REST API) →
--     tag them with @graphql({"omit":true}) so pg_graphql hides them from
--     the GraphQL introspection schema while keeping REST API access intact.

-- 1a. Reporting views — safe to remove authenticated read access entirely.
--     None of these are referenced in the frontend source code.
REVOKE SELECT ON TABLE public.v_inv_item_avg_cost FROM authenticated;
REVOKE SELECT ON TABLE public.v_ledger             FROM authenticated;
REVOKE SELECT ON TABLE public.v_menu_item_cost     FROM authenticated;
REVOKE SELECT ON TABLE public.v_trial_balance      FROM authenticated;

-- 1b. Operational views/tables that the frontend queries via PostgREST.
--     Revoking SELECT would break the app, so we instead exclude them from
--     the GraphQL introspection schema with a pg_graphql directive comment.
--     This prevents unauthenticated GraphQL discovery while the REST API
--     (which the application uses exclusively) continues to work normally.
COMMENT ON VIEW  public.v_guest_profile        IS E'@graphql({"omit":true})';
COMMENT ON VIEW  public.v_mushak_610           IS E'@graphql({"omit":true})';
COMMENT ON VIEW  public.v_stock_balance        IS E'@graphql({"omit":true})';
COMMENT ON TABLE public.vat_purchase_register  IS E'@graphql({"omit":true})';
COMMENT ON TABLE public.vat_sales_register     IS E'@graphql({"omit":true})';
COMMENT ON TABLE public.vds_certificates       IS E'@graphql({"omit":true})';
COMMENT ON TABLE public.vendor_payments        IS E'@graphql({"omit":true})';
COMMENT ON TABLE public.vendors                IS E'@graphql({"omit":true})';

-- ============================================================
-- PART 2: SECURITY DEFINER function exposure (lint 0028/0029)
-- ============================================================
-- Revoke direct RPC execution from public roles for every SECURITY DEFINER
-- function that should not be reachable via the Supabase REST/GraphQL APIs.
-- Functions are looked up dynamically so the migration is safe even if a
-- function does not yet exist in a given environment.

DO $$
DECLARE
  fn_rec record;

  -- Functions that must not be callable by ANY API role.
  -- These are administrative / trigger utilities only; no frontend code
  -- invokes them directly via supabase.rpc().
  full_revoke_targets text[] := ARRAY[
    'bootstrap_tenant',
    'handle_new_user',
    'reset_tenant_seq',
    'rls_auto_enable',
    'sync_register_void',
    'sync_settlement'
  ];

  -- Functions that authenticated users call legitimately from the frontend
  -- (posting.js → post_journal; Settings.jsx → wipe_module) but that anon
  -- must never be allowed to execute.
  anon_only_revoke_targets text[] := ARRAY[
    'post_journal',
    'wipe_module'
  ];

  fn_name text;
BEGIN
  -- Full revoke: strip EXECUTE from PUBLIC, anon, and authenticated.
  FOREACH fn_name IN ARRAY full_revoke_targets LOOP
    FOR fn_rec IN
      SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = fn_name
        AND p.prosecdef
    LOOP
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',
        fn_rec.sig
      );
    END LOOP;
  END LOOP;

  -- Anon-only revoke: strip EXECUTE from anon (and PUBLIC) but leave
  -- authenticated intact so signed-in users can still call these functions.
  FOREACH fn_name IN ARRAY anon_only_revoke_targets LOOP
    FOR fn_rec IN
      SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = fn_name
        AND p.prosecdef
    LOOP
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon',
        fn_rec.sig
      );
      -- Ensure authenticated retains (or regains) the explicit grant so the
      -- application continues to work after the PUBLIC revoke above.
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION %s TO authenticated',
        fn_rec.sig
      );
    END LOOP;
  END LOOP;
END
$$;

-- ============================================================
-- PART 3: Default privileges — prevent future regressions
-- ============================================================
-- When new tables or views are created by the owner role(s), do not
-- automatically expose them to authenticated or anon via the GraphQL schema.
-- The application should grant access explicitly where needed.
DO $$
DECLARE
  owner_role record;
BEGIN
  FOR owner_role IN
    SELECT DISTINCT pg_get_userbyid(c.relowner) AS role_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND pg_get_userbyid(c.relowner) IS NOT NULL
  LOOP
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public '
      'REVOKE SELECT ON TABLES FROM authenticated',
      owner_role.role_name
    );
  END LOOP;
END
$$;
