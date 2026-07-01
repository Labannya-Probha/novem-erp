-- Optimize tenant-scoped report RLS checks so auth and tenant helper functions are init-planned.

DROP POLICY IF EXISTS report_user_access_read_own_or_role_defaults ON public.report_user_access;
CREATE POLICY report_user_access_read_own_or_role_defaults
  ON public.report_user_access FOR SELECT TO authenticated
  USING (
    tenant_id IS NULL
    OR tenant_id = (select public.current_tenant_id())
    OR user_id = (select auth.uid())
  );

DROP POLICY IF EXISTS report_export_logs_insert_own ON public.report_export_logs;
CREATE POLICY report_export_logs_insert_own
  ON public.report_export_logs FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (select public.current_tenant_id())
    AND (generated_by = (select auth.uid()) OR generated_by IS NULL)
  );

DROP POLICY IF EXISTS report_print_logs_insert_own ON public.report_print_logs;
CREATE POLICY report_print_logs_insert_own
  ON public.report_print_logs FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (select public.current_tenant_id())
    AND (printed_by = (select auth.uid()) OR printed_by IS NULL)
  );
