-- SaaS tenant administration foundation.
-- Adds subscription controls and superuser-safe RLS visibility for tenant administration.

CREATE OR REPLACE FUNCTION public.is_superuser()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT role = 'SUPERUSER'
      FROM public.app_users
      WHERE auth_id = auth.uid()
        AND is_active = true
      LIMIT 1
    ),
    false
  )
$$;

CREATE TABLE IF NOT EXISTS public.tenant_subscriptions (
  tenant_id uuid PRIMARY KEY REFERENCES public.properties(id) ON DELETE CASCADE,
  plan_code text NOT NULL DEFAULT 'PROFESSIONAL',
  status text NOT NULL DEFAULT 'ACTIVE',
  user_limit integer NOT NULL DEFAULT 25,
  property_limit integer NOT NULL DEFAULT 1,
  storage_limit_mb integer NOT NULL DEFAULT 10240,
  billing_email text,
  billing_cycle text NOT NULL DEFAULT 'MONTHLY',
  monthly_fee numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BDT',
  next_billing_date date,
  modules_enabled jsonb NOT NULL DEFAULT '{"reservations": true, "frontOffice": true, "pos": true, "accounting": true, "inventory": true, "hr": true, "reports": true}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.tenant_subscriptions
  DROP CONSTRAINT IF EXISTS tenant_subscriptions_plan_code_check,
  DROP CONSTRAINT IF EXISTS tenant_subscriptions_status_check,
  DROP CONSTRAINT IF EXISTS tenant_subscriptions_billing_cycle_check;

ALTER TABLE public.tenant_subscriptions
  ADD CONSTRAINT tenant_subscriptions_plan_code_check
    CHECK (plan_code IN ('TRIAL', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE')),
  ADD CONSTRAINT tenant_subscriptions_status_check
    CHECK (status IN ('TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED')),
  ADD CONSTRAINT tenant_subscriptions_billing_cycle_check
    CHECK (billing_cycle IN ('MONTHLY', 'QUARTERLY', 'YEARLY'));

CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_status
  ON public.tenant_subscriptions(status);

CREATE TABLE IF NOT EXISTS public.tenant_usage_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  users_count integer NOT NULL DEFAULT 0,
  active_users_count integer NOT NULL DEFAULT 0,
  reservations_count integer NOT NULL DEFAULT 0,
  pos_orders_count integer NOT NULL DEFAULT 0,
  invoices_count integer NOT NULL DEFAULT 0,
  storage_used_mb numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, snapshot_date)
);

ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_usage_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_subscriptions_superuser_select ON public.tenant_subscriptions;
CREATE POLICY tenant_subscriptions_superuser_select
  ON public.tenant_subscriptions FOR SELECT TO authenticated
  USING (public.is_superuser() OR tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_subscriptions_superuser_write ON public.tenant_subscriptions;
CREATE POLICY tenant_subscriptions_superuser_write
  ON public.tenant_subscriptions FOR ALL TO authenticated
  USING (public.is_superuser())
  WITH CHECK (public.is_superuser());

DROP POLICY IF EXISTS tenant_usage_superuser_select ON public.tenant_usage_snapshots;
CREATE POLICY tenant_usage_superuser_select
  ON public.tenant_usage_snapshots FOR SELECT TO authenticated
  USING (public.is_superuser() OR tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_usage_superuser_write ON public.tenant_usage_snapshots;
CREATE POLICY tenant_usage_superuser_write
  ON public.tenant_usage_snapshots FOR ALL TO authenticated
  USING (public.is_superuser())
  WITH CHECK (public.is_superuser());

DROP POLICY IF EXISTS app_users_superuser_select ON public.app_users;
CREATE POLICY app_users_superuser_select
  ON public.app_users FOR SELECT TO authenticated
  USING (public.is_superuser());

DROP POLICY IF EXISTS company_settings_superuser_select ON public.company_settings;
CREATE POLICY company_settings_superuser_select
  ON public.company_settings FOR SELECT TO authenticated
  USING (public.is_superuser());

INSERT INTO public.tenant_subscriptions (tenant_id, plan_code, status, billing_email, currency)
SELECT
  p.id,
  'PROFESSIONAL',
  CASE WHEN p.is_active THEN 'ACTIVE' ELSE 'SUSPENDED' END,
  cs.email,
  COALESCE(cs.currency, 'BDT')
FROM public.properties p
LEFT JOIN public.company_settings cs ON cs.tenant_id = p.id
ON CONFLICT (tenant_id) DO NOTHING;
