-- Migration 010: Ensure auth → app_users link and handle_new_user trigger
-- Fixes "Signups not allowed for this instance" by:
--   1. Guaranteeing the handle_new_user trigger function exists and correctly
--      inserts a row in public.app_users whenever a new auth.users record is
--      created (including via the admin-create-user Edge Function).
--   2. Confirming the INSERT RLS policy for app_users allows the trigger
--      (running as postgres / service-role) to create the initial profile row.
--   3. Adding a lightweight RLS INSERT policy so SUPERUSER accounts can also
--      insert rows directly (needed for the update-after-create pattern in
--      Settings.jsx → addStaff).

-- ============================================================
-- PART 1: handle_new_user trigger function
-- Creates / replaces the function that fires on auth.users INSERT.
-- The trigger copies basic metadata from auth.users into app_users so the
-- front-end always has a matching profile row, even when signups are handled
-- by the admin-create-user Edge Function rather than the public signUp() API.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  INSERT INTO public.app_users (id, email, full_name, username, role, tenant_id, is_active, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'username',  split_part(NEW.email, '.', 1)),
    'FRONT_OFFICE',
    (NEW.raw_user_meta_data->>'tenant_id')::uuid,
    true,
    now()
  )
  ON CONFLICT (id) DO NOTHING;   -- idempotent: safe to re-run / re-trigger
  RETURN NEW;
END;
$$;

-- Revoke direct RPC execution — this function should only run as a trigger.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- PART 2: Attach the trigger to auth.users (idempotent)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
      AND tgrelid = 'auth.users'::regclass
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
  END IF;
END
$$;

-- ============================================================
-- PART 3: RLS — allow service role / postgres to INSERT rows
-- The trigger runs with SECURITY DEFINER (postgres context) so it bypasses
-- RLS automatically.  However, the admin-create-user Edge Function may also
-- need to upsert the row directly if the trigger misfires in some edge case.
-- Adding an explicit policy for service_role is a belt-and-suspenders measure.
-- ============================================================

-- Ensure INSERT privilege exists for authenticated role
-- (service_role always bypasses RLS, so no policy needed for it)
GRANT INSERT ON TABLE public.app_users TO authenticated;

-- Allow authenticated users with ADMIN or SUPERUSER roles to insert new staff
-- rows into their own tenant (required for future direct-insert patterns).
DROP POLICY IF EXISTS app_users_insert_admin ON public.app_users;
CREATE POLICY app_users_insert_admin
  ON public.app_users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    my_role() IN ('ADMIN', 'SUPERUSER')
    AND tenant_id = current_tenant_id()
  );

-- ============================================================
-- PART 4: Ensure all module tables carry a tenant_id column
-- These tables are referenced by various ERP modules. Adding the column with
-- IF NOT EXISTS means the migration is safe to re-run on instances that
-- already have the column (from an earlier deployment).
-- ============================================================
ALTER TABLE public.inventory_items        ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.purchase_orders        ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.purchase_order_lines   ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.consumption_entries    ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.consumption_lines      ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.journal_entries        ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.journal_lines          ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.pos_orders             ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.pos_order_items        ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.housekeeping_tasks     ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.maintenance_requests   ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.tasks                  ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.payroll_records        ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.allowance_config       ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.role_permissions       ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.admin_feature_access   ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.doc_register           ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.properties             ADD COLUMN IF NOT EXISTS tenant_id uuid;

-- Create indexes for any tenant_id columns that are missing them.
-- (These are safe no-ops if the index already exists.)
CREATE INDEX IF NOT EXISTS idx_inventory_items_tid      ON public.inventory_items      (tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tid      ON public.purchase_orders      (tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_lines_tid ON public.purchase_order_lines (tenant_id);
CREATE INDEX IF NOT EXISTS idx_consumption_entries_tid  ON public.consumption_entries  (tenant_id);
CREATE INDEX IF NOT EXISTS idx_consumption_lines_tid    ON public.consumption_lines    (tenant_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_tid      ON public.journal_entries      (tenant_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_tid        ON public.journal_lines        (tenant_id);
CREATE INDEX IF NOT EXISTS idx_pos_orders_tid           ON public.pos_orders           (tenant_id);
CREATE INDEX IF NOT EXISTS idx_pos_order_items_tid      ON public.pos_order_items      (tenant_id);
CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_tid   ON public.housekeeping_tasks   (tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_tid ON public.maintenance_requests (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_tid                ON public.tasks                (tenant_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_tid      ON public.payroll_records      (tenant_id);
CREATE INDEX IF NOT EXISTS idx_allowance_config_tid     ON public.allowance_config     (tenant_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_tid     ON public.role_permissions     (tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_feature_access_tid ON public.admin_feature_access (tenant_id);
CREATE INDEX IF NOT EXISTS idx_doc_register_tid         ON public.doc_register         (tenant_id);
CREATE INDEX IF NOT EXISTS idx_properties_tid           ON public.properties           (tenant_id);
