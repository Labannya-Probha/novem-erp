-- Add restaurant branding fields to company_settings
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS is_restaurant_available boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS restaurant_name text;
