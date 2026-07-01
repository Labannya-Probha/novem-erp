alter table public.requisitions
  add column if not exists route_decision text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'requisitions_route_decision_check'
      and conrelid = 'public.requisitions'::regclass
  ) then
    alter table public.requisitions
      add constraint requisitions_route_decision_check
      check (route_decision is null or route_decision in ('PO', 'TRANSFER'));
  end if;
end $$;

comment on column public.requisitions.route_decision is
  'Inventory requisition routing decision: PO, TRANSFER, or NULL.';

notify pgrst, 'reload schema';
