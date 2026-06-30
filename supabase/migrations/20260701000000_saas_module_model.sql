-- Enterprise SaaS module baseline for Aura Stay ERP.
-- Adds tenant module controls, branding settings, audit/log tables and a
-- defensive tenant RLS pass across hospitality ERP tables that carry tenant_id.

create table if not exists public.tenant_branding (
  tenant_id uuid primary key references public.properties(id) on delete cascade,
  tenant_name text,
  property_name text,
  logo_url text,
  primary_color text default '#1F6F78',
  secondary_color text default '#EAF4F1',
  accent_color text default '#2E7D32',
  sidebar_bg_color text default '#123F2A',
  sidebar_text_color text default '#FFFFFF',
  button_color text default '#1F6F78',
  table_header_color text default '#EAF4F1',
  report_header_color text default '#0F4C81',
  font_family text default 'Inter',
  theme_mode text default 'light' check (theme_mode in ('light', 'dark')),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists public.tenant_module_settings (
  tenant_id uuid not null references public.properties(id) on delete cascade,
  module_code text not null,
  enabled boolean not null default true,
  package_code text default 'PROFESSIONAL',
  features jsonb not null default '{}'::jsonb,
  user_limit integer,
  usage_limit jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (tenant_id, module_code)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.properties(id) on delete cascade,
  actor_id uuid,
  actor_name text,
  module_code text,
  action text not null,
  entity_name text,
  entity_id text,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.login_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.properties(id) on delete cascade,
  user_id uuid,
  username text,
  status text not null default 'SUCCESS',
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.report_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.properties(id) on delete cascade,
  report_code text not null,
  report_name text,
  action text not null check (action in ('GENERATE', 'EXPORT', 'PRINT')),
  export_type text,
  filters jsonb not null default '{}'::jsonb,
  generated_by uuid,
  generated_at timestamptz not null default now()
);

create index if not exists idx_tenant_module_settings_tenant on public.tenant_module_settings(tenant_id, enabled);
create index if not exists idx_audit_logs_tenant_time on public.audit_logs(tenant_id, created_at desc);
create index if not exists idx_login_history_tenant_time on public.login_history(tenant_id, created_at desc);
create index if not exists idx_report_logs_tenant_time on public.report_logs(tenant_id, generated_at desc);

grant select, insert, update, delete on public.tenant_branding to authenticated;
grant select, insert, update, delete on public.tenant_module_settings to authenticated;
grant select, insert on public.audit_logs to authenticated;
grant select, insert on public.login_history to authenticated;
grant select, insert on public.report_logs to authenticated;
grant select, insert, update, delete on public.tenant_branding to service_role;
grant select, insert, update, delete on public.tenant_module_settings to service_role;
grant select, insert, update, delete on public.audit_logs to service_role;
grant select, insert, update, delete on public.login_history to service_role;
grant select, insert, update, delete on public.report_logs to service_role;

insert into public.tenant_branding (
  tenant_id, tenant_name, property_name, logo_url, primary_color, secondary_color,
  accent_color, sidebar_bg_color, sidebar_text_color, button_color,
  table_header_color, report_header_color, font_family, theme_mode
)
select
  p.id,
  coalesce(cs.software_name, cs.name, p.name),
  coalesce(cs.name, p.name),
  cs.logo_url,
  coalesce(cs.primary_color, '#1F6F78'),
  coalesce(cs.secondary_color, '#EAF4F1'),
  coalesce(cs.accent_color, '#2E7D32'),
  coalesce(cs.sidebar_bg_color, cs.brand_primary, '#123F2A'),
  coalesce(cs.sidebar_text_color, '#FFFFFF'),
  coalesce(cs.button_color, cs.primary_color, '#1F6F78'),
  coalesce(cs.table_header_color, '#EAF4F1'),
  coalesce(cs.report_header_color, cs.brand_primary, '#0F4C81'),
  coalesce(cs.font_family, 'Inter'),
  coalesce(cs.theme_mode, 'light')
from public.properties p
left join public.company_settings cs on cs.tenant_id = p.id
on conflict (tenant_id) do update set
  tenant_name = excluded.tenant_name,
  property_name = excluded.property_name,
  logo_url = excluded.logo_url,
  primary_color = excluded.primary_color,
  secondary_color = excluded.secondary_color,
  accent_color = excluded.accent_color,
  sidebar_bg_color = excluded.sidebar_bg_color,
  sidebar_text_color = excluded.sidebar_text_color,
  button_color = excluded.button_color,
  table_header_color = excluded.table_header_color,
  report_header_color = excluded.report_header_color,
  font_family = excluded.font_family,
  theme_mode = excluded.theme_mode,
  updated_at = now();

insert into public.tenant_module_settings (tenant_id, module_code, enabled, package_code, features)
select p.id, module_code, true, coalesce(ts.plan_code, 'PROFESSIONAL'), '{}'::jsonb
from public.properties p
left join public.tenant_subscriptions ts on ts.tenant_id = p.id
cross join (
  values
    ('dashboard'), ('reservations'), ('frontOffice'), ('housekeeping'),
    ('pos'), ('accounting'), ('inventory'), ('hr'), ('reports'),
    ('tasks'), ('settings')
) as modules(module_code)
on conflict (tenant_id, module_code) do nothing;

alter table public.tenant_branding enable row level security;
alter table public.tenant_module_settings enable row level security;
alter table public.audit_logs enable row level security;
alter table public.login_history enable row level security;
alter table public.report_logs enable row level security;

drop policy if exists tenant_branding_read on public.tenant_branding;
create policy tenant_branding_read on public.tenant_branding
  for select to authenticated using (tenant_id = public.current_tenant_id() or public.is_superuser());

drop policy if exists tenant_branding_admin_write on public.tenant_branding;
create policy tenant_branding_admin_write on public.tenant_branding
  for all to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_superuser())
  with check (tenant_id = public.current_tenant_id() or public.is_superuser());

drop policy if exists tenant_module_settings_read on public.tenant_module_settings;
create policy tenant_module_settings_read on public.tenant_module_settings
  for select to authenticated using (tenant_id = public.current_tenant_id() or public.is_superuser());

drop policy if exists tenant_module_settings_admin_write on public.tenant_module_settings;
create policy tenant_module_settings_admin_write on public.tenant_module_settings
  for all to authenticated
  using (public.is_superuser())
  with check (public.is_superuser());

drop policy if exists audit_logs_read on public.audit_logs;
create policy audit_logs_read on public.audit_logs
  for select to authenticated using (tenant_id = public.current_tenant_id() or public.is_superuser());

drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert on public.audit_logs
  for insert to authenticated with check (tenant_id = public.current_tenant_id() or public.is_superuser());

drop policy if exists login_history_read on public.login_history;
create policy login_history_read on public.login_history
  for select to authenticated using (tenant_id = public.current_tenant_id() or public.is_superuser());

drop policy if exists login_history_insert on public.login_history;
create policy login_history_insert on public.login_history
  for insert to authenticated with check (tenant_id = public.current_tenant_id() or public.is_superuser());

drop policy if exists report_logs_read on public.report_logs;
create policy report_logs_read on public.report_logs
  for select to authenticated using (tenant_id = public.current_tenant_id() or public.is_superuser());

drop policy if exists report_logs_insert on public.report_logs;
create policy report_logs_insert on public.report_logs
  for insert to authenticated with check (tenant_id = public.current_tenant_id() or public.is_superuser());

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'reservations','reservation_rooms','reservation_guests','rooms','guests',
    'folios','folio_charges','payments','invoices','quotations',
    'pos_orders','pos_order_items','menu_items','menu_categories',
    'inv_items','vendors','requisitions','purchase_orders','goods_receipts',
    'stock_transfers','stock_returns','store_locations',
    'employees','attendance_records','leave_applications','payroll_runs',
    'journal_entries','journal_lines','chart_of_accounts','fixed_assets',
    'company_settings','tax_config','role_privileges','admin_feature_access'
  ] loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = tbl and column_name = 'tenant_id'
    ) then
      execute format('create index if not exists %I on public.%I (tenant_id)', 'idx_' || tbl || '_tenant_saas', tbl);
      execute format('alter table public.%I enable row level security', tbl);
    end if;
  end loop;
end $$;
