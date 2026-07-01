-- Uniform audit logging across reservation/contact/payment lifecycle tables.
-- Captures CREATE / EDIT / DELETE events with actor and timestamp in public.audit_log.

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_new jsonb;
  v_old jsonb;
  v_row jsonb;
  v_row_id text;
  v_tenant_text text;
  v_tenant_id uuid;
  v_claims jsonb := '{}'::jsonb;
  v_actor text;
  v_action text;
begin
  if tg_table_name = 'audit_log' then
    return coalesce(new, old);
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    v_new := to_jsonb(new);
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    v_old := to_jsonb(old);
  end if;

  v_row := coalesce(v_new, v_old, '{}'::jsonb);
  v_row_id := coalesce(v_row->>'id', v_old->>'id', v_new->>'id', '');
  v_tenant_text := coalesce(v_row->>'tenant_id', v_old->>'tenant_id', v_new->>'tenant_id', null);

  begin
    if v_tenant_text is not null and v_tenant_text <> '' then
      v_tenant_id := v_tenant_text::uuid;
    else
      v_tenant_id := null;
    end if;
  exception when others then
    v_tenant_id := null;
  end;

  begin
    v_claims := coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb;
  exception when others then
    v_claims := '{}'::jsonb;
  end;

  v_actor := coalesce(
    nullif(v_new->>'updated_by', ''),
    nullif(v_new->>'created_by', ''),
    nullif(v_old->>'updated_by', ''),
    nullif(v_old->>'created_by', ''),
    nullif(v_claims->>'email', ''),
    nullif(v_claims->>'sub', ''),
    'SYSTEM'
  );

  v_action := case tg_op
    when 'INSERT' then 'CREATE'
    when 'UPDATE' then 'EDIT'
    when 'DELETE' then 'DELETE'
    else tg_op
  end;

  insert into public.audit_log (
    tenant_id,
    actor,
    action,
    entity,
    entity_id,
    details
  )
  values (
    v_tenant_id,
    v_actor,
    v_action,
    tg_table_name,
    v_row_id,
    jsonb_build_object(
      'schema', tg_table_schema,
      'table', tg_table_name,
      'operation', tg_op,
      'timestamp', now(),
      'record_id', v_row_id,
      'changed_by_uid', nullif(v_claims->>'sub', ''),
      'changed_by_email', nullif(v_claims->>'email', ''),
      'old', case when tg_op in ('UPDATE', 'DELETE') then v_old else null end,
      'new', case when tg_op in ('INSERT', 'UPDATE') then v_new else null end
    )
  );

  return coalesce(new, old);
exception when others then
  -- Never block business writes because of audit logging failures.
  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
  tables text[] := array[
    'guests',
    'reservation_guests',
    'guest_ids',
    'reservations',
    'reservation_rooms',
    'reservation_addons',
    'folio_charges',
    'payments',
    'invoices',
    'quotations',
    'refunds',
    'payment_delivery_logs',
    'agencies',
    'shareholders',
    'companies'
  ];
begin
  foreach t in array tables loop
    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = t
        and c.relkind = 'r'
    ) then
      execute format('drop trigger if exists trg_audit_row_change on public.%I', t);
      execute format(
        'create trigger trg_audit_row_change after insert or update or delete on public.%I for each row execute function public.audit_row_change()',
        t
      );
    end if;
  end loop;
end
$$;
