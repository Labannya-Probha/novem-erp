-- Restore the username lookup RPC used by the public login form.
-- app_users is intentionally not readable by anon, so this helper needs
-- elevated execution even after the broader function-hardening pass.

DO $$
DECLARE
  fn_oid oid;
BEGIN
  FOR fn_oid IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'email_for_username'
  LOOP
    EXECUTE format('ALTER FUNCTION %s SECURITY DEFINER', fn_oid::regprocedure);
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn_oid::regprocedure);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', fn_oid::regprocedure);
  END LOOP;
END
$$;
