-- Auto-set organization_id on cash tables from the acting user's membership.
--
-- cash_closures / cash_movements / product_movements enforce tenant RLS via
-- has_org_permission(organization_id, ...). The POS client inserts rows without
-- organization_id, so the WITH CHECK policy rejected them (opaque RLS error).
--
-- This BEFORE INSERT trigger fills organization_id from the user's active
-- membership when it isn't provided, so every insert (open, close, movements)
-- satisfies RLS without the client having to know the org id.

create or replace function public.cash_set_org_from_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.organization_id is null then
    select om.organization_id
      into new.organization_id
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.status = 'active'
    order by om.created_at asc
    limit 1;
  end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.cash_closures') is not null then
    drop trigger if exists trg_cash_closures_set_org on public.cash_closures;
    create trigger trg_cash_closures_set_org
      before insert on public.cash_closures
      for each row execute function public.cash_set_org_from_membership();
  end if;

  if to_regclass('public.cash_movements') is not null then
    drop trigger if exists trg_cash_movements_set_org on public.cash_movements;
    create trigger trg_cash_movements_set_org
      before insert on public.cash_movements
      for each row execute function public.cash_set_org_from_membership();
  end if;

  if to_regclass('public.product_movements') is not null then
    drop trigger if exists trg_product_movements_set_org on public.product_movements;
    create trigger trg_product_movements_set_org
      before insert on public.product_movements
      for each row execute function public.cash_set_org_from_membership();
  end if;
end;
$$;
