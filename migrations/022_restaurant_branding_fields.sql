ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS is_restaurant_available boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS restaurant_name text;
