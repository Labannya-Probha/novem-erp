-- Restore username lookup for the public login flow.
-- The login page calls public.email_for_username() before authentication,
-- so it must remain executable by anon/authenticated and run with definer rights.

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
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, auth, pg_temp', fn_oid::regprocedure);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn_oid::regprocedure);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', fn_oid::regprocedure);
  END LOOP;
END
$$;
