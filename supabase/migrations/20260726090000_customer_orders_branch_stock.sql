-- Scope dashboard orders and their stock reservations to the active branch.

alter table public.customer_orders
  add column if not exists branch_id uuid references public.branches(id) on delete set null;

create index if not exists idx_customer_orders_org_branch_created
  on public.customer_orders(organization_id, branch_id, created_at desc);

create or replace function public.decrement_branch_order_stock(
  p_product_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_quantity integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  if p_quantity <= 0 then
    return false;
  end if;

  if not exists (
    select 1
      from public.branches
     where id = p_branch_id
       and organization_id = p_organization_id
       and is_active = true
  ) then
    return false;
  end if;

  update public.branch_inventory bi
     set stock_quantity = bi.stock_quantity - p_quantity,
         updated_at = now()
    from public.products p
   where bi.branch_id = p_branch_id
     and bi.product_id = p_product_id
     and bi.stock_quantity >= p_quantity
     and p.id = bi.product_id
     and p.organization_id = p_organization_id;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.increment_branch_order_stock(
  p_product_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_quantity integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  if p_quantity <= 0 then
    return false;
  end if;

  update public.branch_inventory bi
     set stock_quantity = bi.stock_quantity + p_quantity,
         updated_at = now()
    from public.products p, public.branches b
   where bi.branch_id = p_branch_id
     and bi.product_id = p_product_id
     and p.id = bi.product_id
     and p.organization_id = p_organization_id
     and b.id = bi.branch_id
     and b.organization_id = p_organization_id;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.decrement_branch_order_stock(uuid, uuid, uuid, integer) from public;
revoke all on function public.increment_branch_order_stock(uuid, uuid, uuid, integer) from public;
grant execute on function public.decrement_branch_order_stock(uuid, uuid, uuid, integer) to service_role;
grant execute on function public.increment_branch_order_stock(uuid, uuid, uuid, integer) to service_role;

comment on column public.customer_orders.branch_id is
  'Branch whose inventory was reserved when the dashboard order was created.';
