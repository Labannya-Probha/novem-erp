-- Expose SaaS administration tables to authenticated clients.
-- RLS policies still control which tenant rows are visible or writable.

GRANT SELECT, INSERT, UPDATE ON public.tenant_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tenant_usage_snapshots TO authenticated;
