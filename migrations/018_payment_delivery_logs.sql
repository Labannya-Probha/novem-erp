-- Delivery audit logs for reservation payment message dispatch (WhatsApp/Email)
create table if not exists public.payment_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null,
  reservation_id uuid null references public.reservations(id) on delete set null,
  payment_id uuid null references public.payments(id) on delete set null,
  payment_no text null,
  channel text not null check (channel in ('WHATSAPP', 'EMAIL')),
  recipient text not null,
  status text not null check (status in ('SUCCESS', 'FAILED')),
  provider text null,
  provider_message text null,
  error_message text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_delivery_logs_reservation on public.payment_delivery_logs (reservation_id, created_at desc);
create index if not exists idx_payment_delivery_logs_payment on public.payment_delivery_logs (payment_id, created_at desc);
create index if not exists idx_payment_delivery_logs_tenant on public.payment_delivery_logs (tenant_id, created_at desc);
