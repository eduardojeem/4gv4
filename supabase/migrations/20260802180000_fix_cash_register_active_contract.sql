alter table if exists public.cash_registers
  add column if not exists is_active boolean;

update public.cash_registers
set is_active = true
where is_active is null;

alter table if exists public.cash_registers
  alter column is_active set default true,
  alter column is_active set not null;

with sole_registers as (
  select
    organization_id,
    branch_id,
    min(id::text) as register_id
  from public.cash_registers
  group by organization_id, branch_id
  having count(*) = 1
)
update public.cash_closures c
set register_id = sole_registers.register_id,
    updated_at = now()
from sole_registers
where c.organization_id = sole_registers.organization_id
  and c.branch_id = sole_registers.branch_id
  and c.date is null
  and c.register_id = 'principal'
  and not exists (
    select 1
    from public.cash_closures existing
    where existing.organization_id = c.organization_id
      and existing.branch_id = c.branch_id
      and existing.register_id = sole_registers.register_id
      and existing.date is null
      and existing.id <> c.id
  );

update public.cash_registers r
set is_open = exists (
      select 1
      from public.cash_closures c
      where c.organization_id = r.organization_id
        and c.branch_id = r.branch_id
        and c.register_id = r.id::text
        and c.date is null
    ),
    balance = coalesce((
      select public.calculate_cash_session_expected(c.id, c.organization_id, c.branch_id)
      from public.cash_closures c
      where c.organization_id = r.organization_id
        and c.branch_id = r.branch_id
        and c.register_id = r.id::text
        and c.date is null
      order by c.created_at desc
      limit 1
    ), 0);

notify pgrst, 'reload schema';
