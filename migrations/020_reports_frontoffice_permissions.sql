-- Fix report panel/front-office Supabase access for authenticated users.
-- Applies tenant-scoped RLS policies when a table has tenant_id; otherwise
-- grants authenticated access without changing table data shape.

DO $$
DECLARE
  report_table text;
  has_tenant boolean;
  select_policy text;
BEGIN
  FOREACH report_table IN ARRAY ARRAY[
    'folio_charges',
    'payments',
    'pos_orders',
    'facility_sales',
    'invoices',
    'reservations',
    'rooms',
    'day_closes',
    'reservation_rooms',
    'tax_config',
    'company_settings',
    'guest_ids',
    'reservation_guests',
    'reservation_addons',
    'guests',
    'quotations'
  ]
  LOOP
    IF to_regclass(format('public.%I', report_table)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', report_table);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', report_table);

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = report_table
        AND column_name = 'tenant_id'
    ) INTO has_tenant;

    select_policy := format('%I_report_authenticated_select', report_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', select_policy, report_table);

    IF has_tenant THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id())',
        select_policy,
        report_table
      );
    ELSE
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
        select_policy,
        report_table
      );
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  has_tenant boolean;
BEGIN
  IF to_regclass('public.tasks') IS NULL THEN
    RETURN;
  END IF;

  GRANT SELECT, INSERT, UPDATE ON public.tasks TO authenticated;
  ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'tenant_id'
  ) INTO has_tenant;

  DROP POLICY IF EXISTS tasks_frontoffice_clearance_select ON public.tasks;
  DROP POLICY IF EXISTS tasks_frontoffice_clearance_insert ON public.tasks;
  DROP POLICY IF EXISTS tasks_frontoffice_clearance_update ON public.tasks;

  IF has_tenant THEN
    CREATE POLICY tasks_frontoffice_clearance_select
      ON public.tasks FOR SELECT TO authenticated
      USING (tenant_id = public.current_tenant_id());

    CREATE POLICY tasks_frontoffice_clearance_insert
      ON public.tasks FOR INSERT TO authenticated
      WITH CHECK (tenant_id = public.current_tenant_id());

    CREATE POLICY tasks_frontoffice_clearance_update
      ON public.tasks FOR UPDATE TO authenticated
      USING (tenant_id = public.current_tenant_id())
      WITH CHECK (tenant_id = public.current_tenant_id());
  ELSE
    CREATE POLICY tasks_frontoffice_clearance_select
      ON public.tasks FOR SELECT TO authenticated
      USING (true);

    CREATE POLICY tasks_frontoffice_clearance_insert
      ON public.tasks FOR INSERT TO authenticated
      WITH CHECK (true);

    CREATE POLICY tasks_frontoffice_clearance_update
      ON public.tasks FOR UPDATE TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
