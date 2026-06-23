-- Hardens exposed SECURITY DEFINER functions in public schema.
-- 1) Convert low-risk helper functions to SECURITY INVOKER.
-- 2) Revoke PostgREST-executable roles from high-risk SECURITY DEFINER routines.

DO $$
DECLARE
  fn_name text;
  fn_oid oid;
  invoker_targets text[] := ARRAY[
    'admin_can_access_module',
    'calculate_loyalty_points',
    'current_tenant_id',
    'email_for_username',
    'generate_customer_id',
    'get_tax_rates',
    'get_tenant_short_code',
    'is_admin',
    'is_admin_or_manager',
    'is_manager_up',
    'is_module_admin',
    'log_vat_purchase',
    'log_vat_sale',
    'loyalty_points_to_taka',
    'my_role',
    'next_tenant_seq',
    'taka_to_loyalty_points',
    'tenant_short_code'
  ];
  definer_revoke_targets text[] := ARRAY[
    'handle_new_user',
    'reset_tenant_seq',
    'rls_auto_enable',
    'sync_register_void',
    'sync_settlement',
    'wipe_module'
  ];
BEGIN
  -- Convert known helper functions away from elevated execution.
  FOREACH fn_name IN ARRAY invoker_targets LOOP
    FOR fn_oid IN
      SELECT p.oid
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = fn_name
        AND p.prosecdef
    LOOP
      EXECUTE format('ALTER FUNCTION %s SECURITY INVOKER', fn_oid::regprocedure);
    END LOOP;
  END LOOP;

  -- Restrict explicit RPC execution of remaining high-risk definer routines.
  FOREACH fn_name IN ARRAY definer_revoke_targets LOOP
    FOR fn_oid IN
      SELECT p.oid
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = fn_name
        AND p.prosecdef
    LOOP
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn_oid::regprocedure);
    END LOOP;
  END LOOP;
END
$$;
