-- Migration: Sales Query fields + Including Items (addons)
-- Date: 2026-06-18
-- Description:
--   1. Adds Salutation, Guest Type, and Company/OTA tax fields to reservations
--      (per ERP_Build_Doc.pdf Sales & Reservation > Reservation > Sales Query)
--   2. Adds reservation_addons table for "Including Items" (Bed & Breakfast,
--      Pick & Drop, Lunch, Dinner, Room Decoration, Cake, Flower Bouquet, Sight Seeing)
--      Each addon carries its own price/qty and can be posted to folio_charges.

-- ============================================================
-- 1. Reservations — Sales Query fields
-- ============================================================

ALTER TABLE reservations ADD COLUMN IF NOT EXISTS salutation TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS guest_type TEXT DEFAULT 'Individual';
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS use_reservation_name_only BOOLEAN DEFAULT false;

-- Company / OTA fields — only meaningful when guest_type = 'Company'
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS commission_pct NUMERIC(5,2) DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS vat_vds_pct NUMERIC(5,2) DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS tax_tds_pct NUMERIC(5,2) DEFAULT 0;

COMMENT ON COLUMN reservations.salutation IS 'Mr / Ms / Mrs / Dr etc. — printed on documents';
COMMENT ON COLUMN reservations.guest_type IS 'Individual or Company — gates Commission/VAT-VDS/TDS fields';
COMMENT ON COLUMN reservations.use_reservation_name_only IS 'If true, reservation_name is used everywhere instead of the guest full_name (Sales Query checkbox option)';
COMMENT ON COLUMN reservations.commission_pct IS 'Agency/OTA commission % — Company/OTA bookings only';
COMMENT ON COLUMN reservations.vat_vds_pct IS 'VAT/VDS % applicable for Company/OTA billing';
COMMENT ON COLUMN reservations.tax_tds_pct IS 'Tax/TDS % applicable for Company/OTA billing';

-- Guard against unexpected values while staying permissive enough for future labels
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reservations_guest_type_check'
  ) THEN
    ALTER TABLE reservations
      ADD CONSTRAINT reservations_guest_type_check
      CHECK (guest_type IN ('Individual', 'Company'));
  END IF;
END $$;

-- ============================================================
-- 2. Including Items — reservation_addons
-- ============================================================

CREATE TABLE IF NOT EXISTS reservation_addons (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  item_key      TEXT NOT NULL,        -- BB | PICKUP | LUNCH | DINNER | DECOR | CAKE | BOUQUET | SIGHTSEEING
  label         TEXT NOT NULL,        -- display label, editable per booking
  price         NUMERIC(12,2) NOT NULL DEFAULT 0,
  qty           NUMERIC(8,2) NOT NULL DEFAULT 1,
  posted        BOOLEAN NOT NULL DEFAULT false,   -- becomes true once pushed to folio_charges
  folio_charge_id UUID REFERENCES folio_charges(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    TEXT
);

CREATE INDEX IF NOT EXISTS idx_reservation_addons_reservation_id
  ON reservation_addons(reservation_id);

COMMENT ON TABLE reservation_addons IS 'Including Items selected on the Sales Query (B&B, Pick&Drop, Lunch, Dinner, Decoration, Cake, Bouquet, Sightseeing). Each row can be posted once to folio_charges.';
COMMENT ON COLUMN reservation_addons.item_key IS 'Stable key for the addon type: BB, PICKUP, LUNCH, DINNER, DECOR, CAKE, BOUQUET, SIGHTSEEING, or OTHER';
COMMENT ON COLUMN reservation_addons.posted IS 'True once this addon has been posted as a folio_charges row (OTHER charge type)';

-- ============================================================
-- 3. Quotation edit support
-- ============================================================
-- Allows the Quotation tab to update an existing sent quote instead of
-- always inserting a new row. updated_at tracks the last edit.

ALTER TABLE quotations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS room_rate NUMERIC(12,2);
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS room_count INTEGER;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS discount_pct NUMERIC(5,2);
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS valid_days INTEGER;

COMMENT ON COLUMN quotations.room_rate IS 'Snapshot of the rate used to build this quotation (for re-editing)';
COMMENT ON COLUMN quotations.room_count IS 'Snapshot of room count used to build this quotation (for re-editing)';
COMMENT ON COLUMN quotations.discount_pct IS 'Snapshot of discount % used to build this quotation (for re-editing)';
COMMENT ON COLUMN quotations.valid_days IS 'Snapshot of validity window in days used to build this quotation (for re-editing)';

-- ============================================================
-- Verify
-- ============================================================
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'reservations'
  AND column_name IN ('salutation','guest_type','use_reservation_name_only','commission_pct','vat_vds_pct','tax_tds_pct');

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'reservation_addons';

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'quotations'
  AND column_name IN ('updated_at','room_rate','room_count','discount_pct','valid_days');
