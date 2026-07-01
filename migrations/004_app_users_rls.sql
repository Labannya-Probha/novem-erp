GRANT SELECT, UPDATE ON TABLE public.app_users TO authenticated;

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_users_select_self ON public.app_users;
CREATE POLICY app_users_select_self
  ON public.app_users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS app_users_select_tenant_staff ON public.app_users;
CREATE POLICY app_users_select_tenant_staff
  ON public.app_users
  FOR SELECT
  TO authenticated
  USING (
    my_role() IN ('SUPERUSER', 'ADMIN', 'MANAGER')
    AND tenant_id = current_tenant_id()
  );

DROP POLICY IF EXISTS app_users_update_self ON public.app_users;
CREATE POLICY app_users_update_self
  ON public.app_users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS app_users_update_tenant_staff ON public.app_users;
CREATE POLICY app_users_update_tenant_staff
  ON public.app_users
  FOR UPDATE
  TO authenticated
  USING (
    my_role() IN ('SUPERUSER', 'ADMIN')
    AND tenant_id = current_tenant_id()
  )
  WITH CHECK (tenant_id = current_tenant_id());
