-- Keep tenant license defaults active with a 2-month renewal window.
ALTER TABLE public.tenant_subscriptions
  ALTER COLUMN status SET DEFAULT 'ACTIVE',
  ALTER COLUMN next_billing_date SET DEFAULT ((CURRENT_DATE + INTERVAL '2 months')::date);

UPDATE public.tenant_subscriptions
SET next_billing_date = ((CURRENT_DATE + INTERVAL '2 months')::date)
WHERE next_billing_date IS NULL;
