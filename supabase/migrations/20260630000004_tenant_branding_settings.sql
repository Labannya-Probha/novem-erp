-- Tenant-level SaaS branding controls.
-- These columns allow each property/tenant to control the ERP shell,
-- report presentation, buttons, table headers, font, and light/dark mode.

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS secondary_color text,
  ADD COLUMN IF NOT EXISTS sidebar_bg_color text,
  ADD COLUMN IF NOT EXISTS sidebar_text_color text,
  ADD COLUMN IF NOT EXISTS button_color text,
  ADD COLUMN IF NOT EXISTS table_header_color text,
  ADD COLUMN IF NOT EXISTS report_header_color text,
  ADD COLUMN IF NOT EXISTS font_family text DEFAULT 'Inter',
  ADD COLUMN IF NOT EXISTS theme_mode text DEFAULT 'light';

ALTER TABLE public.company_settings
  DROP CONSTRAINT IF EXISTS company_settings_theme_mode_check;

ALTER TABLE public.company_settings
  ADD CONSTRAINT company_settings_theme_mode_check
  CHECK (theme_mode IS NULL OR theme_mode IN ('light', 'dark'));

UPDATE public.company_settings
SET
  secondary_color = COALESCE(secondary_color, '#EAF4F1'),
  sidebar_bg_color = COALESCE(sidebar_bg_color, brand_primary, '#123F2A'),
  sidebar_text_color = COALESCE(sidebar_text_color, '#FFFFFF'),
  button_color = COALESCE(button_color, primary_color, '#1F6F78'),
  table_header_color = COALESCE(table_header_color, '#EAF4F1'),
  report_header_color = COALESCE(report_header_color, brand_primary, '#0F4C81'),
  font_family = COALESCE(font_family, 'Inter'),
  theme_mode = COALESCE(theme_mode, 'light'),
  updated_at = COALESCE(updated_at, now());
