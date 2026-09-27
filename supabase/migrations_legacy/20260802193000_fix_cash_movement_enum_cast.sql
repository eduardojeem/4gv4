create or replace function public.sync_cash_register_balance_from_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_register_id text;
begin
  select c.register_id
  into target_register_id
  from public.cash_closures c
  where c.id = new.session_id
    and c.organization_id = new.organization_id
    and c.branch_id = new.branch_id;

  if target_register_id is not null then
    update public.cash_registers r
    set balance = coalesce(r.balance, 0)
      + public.cash_movement_effect(new.type::text, new.payment_method, new.amount)
    where r.id::text = target_register_id
      and r.organization_id = new.organization_id
      and r.branch_id = new.branch_id;
  end if;

  return new;
end;
$$;
