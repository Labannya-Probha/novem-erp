-- Multi-tenant POS receipt, KOT/BOT print engine foundation.

create table if not exists print_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references properties(id) on delete cascade,
  property_id uuid references properties(id) on delete cascade,
  outlet_id uuid,
  receipt_template_code text not null default 'THERMAL_RECEIPT_V1',
  kot_template_code text not null default 'THERMAL_KOT_V1',
  bot_template_code text not null default 'THERMAL_BOT_V1',
  print_width text not null default '80mm' check (print_width in ('58mm', '80mm')),
  customer_copy_enabled boolean not null default true,
  merchant_copy_enabled boolean not null default true,
  resort_copy_enabled boolean not null default true,
  kot_auto_print boolean not null default true,
  bot_auto_print boolean not null default true,
  delivery_copy_auto_print boolean not null default false,
  show_logo boolean not null default true,
  show_qr boolean not null default true,
  show_vat boolean not null default true,
  show_service_charge boolean not null default true,
  show_discount boolean not null default true,
  show_round_off boolean not null default true,
  loyalty_section_enabled boolean not null default false,
  header_text text,
  footer_text text,
  default_language text not null default 'en',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, property_id, outlet_id)
);

create table if not exists print_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references properties(id) on delete cascade,
  profile_code text not null,
  profile_name text not null,
  copy_title text not null,
  template_code text not null,
  paper_size text not null default '80mm',
  copies integer not null default 1 check (copies between 1 and 5),
  show_logo boolean not null default true,
  show_qr boolean not null default true,
  show_tax_information boolean not null default true,
  show_payment_details boolean not null default true,
  show_cashier boolean not null default true,
  show_waiter boolean not null default true,
  show_terminal boolean not null default true,
  show_shift boolean not null default true,
  show_audit_trail boolean not null default false,
  watermark text,
  auto_print_enabled boolean not null default false,
  ask_before_print_enabled boolean not null default true,
  export_pdf_enabled boolean not null default true,
  active boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, profile_code)
);

create table if not exists print_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references properties(id) on delete cascade,
  template_code text not null,
  template_name text not null,
  document_type text not null,
  renderer text not null default 'REACT',
  paper_size text not null default '80mm',
  version integer not null default 1,
  config jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, template_code)
);

create table if not exists printer_devices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references properties(id) on delete cascade,
  property_id uuid references properties(id) on delete cascade,
  outlet_id uuid,
  device_name text not null,
  device_type text not null default 'THERMAL',
  connection_type text not null default 'BROWSER',
  ip_address inet,
  port integer,
  paper_size text not null default '80mm',
  escpos_enabled boolean not null default true,
  auto_cut_enabled boolean not null default true,
  cash_drawer_enabled boolean not null default false,
  silent_print_enabled boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists kitchen_stations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references properties(id) on delete cascade,
  property_id uuid references properties(id) on delete cascade,
  outlet_id uuid,
  station_code text not null,
  station_name text not null,
  station_type text not null default 'KITCHEN',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, outlet_id, station_code)
);

create table if not exists terminals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references properties(id) on delete cascade,
  property_id uuid references properties(id) on delete cascade,
  outlet_id uuid,
  terminal_code text not null,
  terminal_name text not null,
  ip_address inet,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, outlet_id, terminal_code)
);

create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references properties(id) on delete cascade,
  property_id uuid references properties(id) on delete cascade,
  outlet_id uuid,
  shift_code text not null,
  shift_name text not null,
  opened_by uuid references app_users(id),
  closed_by uuid references app_users(id),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  status text not null default 'OPEN',
  cash_opening numeric(14,2) not null default 0,
  cash_closing numeric(14,2) not null default 0
);

create table if not exists printer_routes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references properties(id) on delete cascade,
  property_id uuid references properties(id) on delete cascade,
  outlet_id uuid,
  kitchen_station_id uuid references kitchen_stations(id) on delete set null,
  printer_device_id uuid references printer_devices(id) on delete set null,
  profile_code text not null,
  item_category text,
  terminal_code text,
  shift_code text,
  priority integer not null default 100,
  active boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists print_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references properties(id) on delete cascade,
  property_id uuid references properties(id) on delete cascade,
  outlet_id uuid,
  order_id uuid,
  invoice_id uuid,
  profile_code text not null,
  copy_type text not null,
  printer_device_id uuid references printer_devices(id) on delete set null,
  status text not null default 'QUEUED',
  payload jsonb not null default '{}'::jsonb,
  document_hash text,
  requested_by uuid references app_users(id),
  requested_at timestamptz not null default now(),
  printed_at timestamptz,
  error_message text
);

create table if not exists print_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references properties(id) on delete cascade,
  property_id uuid references properties(id) on delete cascade,
  outlet_id uuid,
  print_job_id uuid references print_jobs(id) on delete set null,
  order_id uuid,
  invoice_id uuid,
  copy_type text not null,
  printed_by uuid references app_users(id),
  printed_at timestamptz not null default now(),
  terminal text,
  printer_device text,
  ip_address inet,
  reprint_count integer not null default 0,
  void_status text,
  document_hash text,
  filter_context jsonb not null default '{}'::jsonb
);

create table if not exists kot_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references properties(id) on delete cascade,
  property_id uuid references properties(id) on delete cascade,
  outlet_id uuid,
  order_id uuid,
  kot_no text not null,
  kitchen_station_id uuid references kitchen_stations(id) on delete set null,
  status text not null default 'NEW_ORDER',
  priority text not null default 'NORMAL',
  items jsonb not null default '[]'::jsonb,
  notes text,
  printed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, kot_no)
);

create table if not exists bot_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references properties(id) on delete cascade,
  property_id uuid references properties(id) on delete cascade,
  outlet_id uuid,
  order_id uuid,
  bot_no text not null,
  bar_station_id uuid references kitchen_stations(id) on delete set null,
  status text not null default 'NEW_ORDER',
  priority text not null default 'NORMAL',
  items jsonb not null default '[]'::jsonb,
  notes text,
  printed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, bot_no)
);

create index if not exists idx_print_profiles_tenant on print_profiles(tenant_id, profile_code);
create index if not exists idx_print_jobs_tenant_status on print_jobs(tenant_id, status, requested_at desc);
create index if not exists idx_print_logs_tenant_time on print_logs(tenant_id, printed_at desc);
create index if not exists idx_printer_routes_tenant_profile on printer_routes(tenant_id, profile_code, active);
create index if not exists idx_kot_tickets_tenant_status on kot_tickets(tenant_id, status, created_at desc);
create index if not exists idx_bot_tickets_tenant_status on bot_tickets(tenant_id, status, created_at desc);

alter table print_settings enable row level security;
alter table print_profiles enable row level security;
alter table print_templates enable row level security;
alter table printer_devices enable row level security;
alter table kitchen_stations enable row level security;
alter table terminals enable row level security;
alter table shifts enable row level security;
alter table printer_routes enable row level security;
alter table print_jobs enable row level security;
alter table print_logs enable row level security;
alter table kot_tickets enable row level security;
alter table bot_tickets enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'print_settings', 'print_profiles', 'print_templates', 'printer_devices',
    'kitchen_stations', 'terminals', 'shifts', 'printer_routes',
    'print_jobs', 'print_logs', 'kot_tickets', 'bot_tickets'
  ]
  loop
    execute format('drop policy if exists %I on %I', tbl || ' tenant read', tbl);
    execute format('create policy %I on %I for select to authenticated using (tenant_id = current_tenant_id() or is_superuser())', tbl || ' tenant read', tbl);
    execute format('drop policy if exists %I on %I', tbl || ' tenant insert', tbl);
    execute format('create policy %I on %I for insert to authenticated with check (tenant_id = current_tenant_id() or is_superuser())', tbl || ' tenant insert', tbl);
    execute format('drop policy if exists %I on %I', tbl || ' tenant update', tbl);
    execute format('create policy %I on %I for update to authenticated using (tenant_id = current_tenant_id() or is_superuser()) with check (tenant_id = current_tenant_id() or is_superuser())', tbl || ' tenant update', tbl);
    execute format('drop policy if exists %I on %I', tbl || ' admin delete', tbl);
    execute format('create policy %I on %I for delete to authenticated using ((tenant_id = current_tenant_id() and is_admin()) or is_superuser())', tbl || ' admin delete', tbl);
  end loop;
end $$;

grant select, insert, update, delete on print_settings, print_profiles, print_templates, printer_devices,
  kitchen_stations, terminals, shifts, printer_routes, print_jobs, print_logs, kot_tickets, bot_tickets to authenticated;

insert into print_profiles (tenant_id, profile_code, profile_name, copy_title, template_code, paper_size, show_audit_trail, watermark, auto_print_enabled)
select t.id, p.profile_code, p.profile_name, p.copy_title, p.template_code, p.paper_size, p.show_audit_trail, p.watermark, p.auto_print_enabled
from properties t
cross join (
  values
    ('CUSTOMER_COPY', 'Customer Receipt Copy', 'CUSTOMER COPY', 'THERMAL_RECEIPT_V1', '80mm', false, 'CUSTOMER COPY', false),
    ('MERCHANT_COPY', 'Merchant Receipt Copy', 'MERCHANT COPY', 'THERMAL_RECEIPT_V1', '80mm', true, 'MERCHANT COPY', false),
    ('RESORT_COPY', 'Resort Accounting Copy', 'RESORT COPY', 'THERMAL_RECEIPT_V1', '80mm', true, 'RESORT COPY', false),
    ('KITCHEN_COPY', 'Kitchen Order Ticket', 'KITCHEN ORDER TICKET', 'THERMAL_KOT_V1', '80mm', false, 'KOT', true),
    ('BAR_COPY', 'Bar Order Ticket', 'BAR ORDER TICKET', 'THERMAL_BOT_V1', '80mm', false, 'BOT', true),
    ('DELIVERY_COPY', 'Delivery Copy', 'DELIVERY COPY', 'THERMAL_DELIVERY_V1', '80mm', true, 'DELIVERY COPY', false),
    ('VOID_COPY', 'Void Copy', 'VOID COPY', 'THERMAL_VOID_V1', '80mm', true, 'VOID COPY', false),
    ('REPRINT_COPY', 'Reprint Copy', 'REPRINT COPY', 'THERMAL_RECEIPT_V1', '80mm', true, 'REPRINT COPY', false),
    ('AUDIT_COPY', 'Audit Copy', 'AUDIT COPY', 'THERMAL_RECEIPT_V1', '80mm', true, 'AUDIT COPY', false),
    ('DRAFT_COPY', 'Draft Copy', 'DRAFT COPY', 'THERMAL_RECEIPT_V1', '80mm', false, 'DRAFT COPY', false)
) as p(profile_code, profile_name, copy_title, template_code, paper_size, show_audit_trail, watermark, auto_print_enabled)
on conflict (tenant_id, profile_code) do nothing;

