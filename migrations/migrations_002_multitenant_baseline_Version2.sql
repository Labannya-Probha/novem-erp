CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS tenant_id uuid,
  ADD COLUMN IF NOT EXISTS property_name text;

ALTER TABLE public.app_users           ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.reservations        ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.reservation_rooms   ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.rooms               ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.folio_charges       ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.payments            ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.invoices            ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.quotations          ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.guests              ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.employees           ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.attendance_records  ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.leave_types         ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.leave_applications  ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.agencies            ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.shareholders        ADD COLUMN IF NOT EXISTS tenant_id uuid;

CREATE INDEX IF NOT EXISTS idx_company_settings_tenant_id   ON public.company_settings (tenant_id);
CREATE INDEX IF NOT EXISTS idx_app_users_tenant_id          ON public.app_users (tenant_id);
CREATE INDEX IF NOT EXISTS idx_reservations_tenant_id       ON public.reservations (tenant_id);
CREATE INDEX IF NOT EXISTS idx_reservation_rooms_tenant_id  ON public.reservation_rooms (tenant_id);
CREATE INDEX IF NOT EXISTS idx_rooms_tenant_id              ON public.rooms (tenant_id);
CREATE INDEX IF NOT EXISTS idx_folio_charges_tenant_id      ON public.folio_charges (tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id           ON public.payments (tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id           ON public.invoices (tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotations_tenant_id         ON public.quotations (tenant_id);
CREATE INDEX IF NOT EXISTS idx_guests_tenant_id             ON public.guests (tenant_id);
CREATE INDEX IF NOT EXISTS idx_employees_tenant_id          ON public.employees (tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_tenant_id ON public.attendance_records (tenant_id);
CREATE INDEX IF NOT EXISTS idx_leave_types_tenant_id        ON public.leave_types (tenant_id);
CREATE INDEX IF NOT EXISTS idx_leave_applications_tenant_id ON public.leave_applications (tenant_id);
CREATE INDEX IF NOT EXISTS idx_agencies_tenant_id           ON public.agencies (tenant_id);
CREATE INDEX IF NOT EXISTS idx_shareholders_tenant_id       ON public.shareholders (tenant_id);