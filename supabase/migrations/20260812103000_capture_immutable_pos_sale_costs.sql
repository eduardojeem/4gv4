-- Persist the purchase cost visible to the POS transaction.  Finance reports
-- must never reconstruct historical COGS from products.purchase_price later.
begin;

create table if not exists public.sale_item_cost_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null,
  sale_id uuid not null references public.sales(id) on delete restrict,
  sale_item_id uuid not null references public.sale_items(id) on delete restrict,
  product_id uuid references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_cost numeric(14, 2),
  total_cost numeric(14, 2),
  created_at timestamptz not null default now(),
  unique (organization_id, sale_item_id),
  foreign key (organization_id, branch_id)
    references public.branches (organization_id, id) on delete restrict,
  check (
    (unit_cost is null and total_cost is null)
    or (unit_cost is not null and total_cost = round(unit_cost * quantity, 2))
  )
);

create index if not exists sale_item_cost_snapshots_org_sale_idx
  on public.sale_item_cost_snapshots (organization_id, sale_id);

create or replace function public.capture_sale_item_cost_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  sale_organization_id uuid;
  sale_branch_id uuid;
  captured_product_id uuid;
  captured_unit_cost numeric(14, 2);
begin
  select sale.organization_id, sale.branch_id, product.id, nullif(product.purchase_price, 0)
  into sale_organization_id, sale_branch_id, captured_product_id, captured_unit_cost
  from public.sales sale
  left join public.products product
    on product.id = new.product_id
   and product.organization_id = sale.organization_id
  where sale.id = new.sale_id
    and sale.organization_id = new.organization_id;

  if sale_organization_id is null or sale_branch_id is null then
    raise exception 'SALE_ITEM_COST_SNAPSHOT_SCOPE_MISMATCH';
  end if;

  if new.product_id is not null and captured_product_id is null then
    raise exception 'SALE_ITEM_COST_SNAPSHOT_PRODUCT_SCOPE_MISMATCH';
  end if;

  insert into public.sale_item_cost_snapshots (
    organization_id,
    branch_id,
    sale_id,
    sale_item_id,
    product_id,
    quantity,
    unit_cost,
    total_cost
  ) values (
    sale_organization_id,
    sale_branch_id,
    new.sale_id,
    new.id,
    new.product_id,
    new.quantity,
    captured_unit_cost,
    case
      when captured_unit_cost is null then null
      else round(captured_unit_cost * new.quantity, 2)
    end
  )
  on conflict (organization_id, sale_item_id) do nothing;

  return new;
end;
$$;

revoke all on function public.capture_sale_item_cost_snapshot() from public, anon, authenticated;

drop trigger if exists sale_items_capture_cost_snapshot on public.sale_items;
create trigger sale_items_capture_cost_snapshot
  after insert on public.sale_items
  for each row
  execute function public.capture_sale_item_cost_snapshot();

create or replace function public.prevent_sale_item_cost_snapshot_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  raise exception 'SALE_ITEM_COST_SNAPSHOT_IMMUTABLE';
end;
$$;

revoke all on function public.prevent_sale_item_cost_snapshot_mutation() from public, anon, authenticated;

drop trigger if exists sale_item_cost_snapshots_immutable on public.sale_item_cost_snapshots;
create trigger sale_item_cost_snapshots_immutable
  before update or delete on public.sale_item_cost_snapshots
  for each row
  execute function public.prevent_sale_item_cost_snapshot_mutation();

alter table public.sale_item_cost_snapshots enable row level security;

drop policy if exists sale_item_cost_snapshots_finance_read on public.sale_item_cost_snapshots;
create policy sale_item_cost_snapshots_finance_read
  on public.sale_item_cost_snapshots
  for select
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_org_permission(organization_id, 'finances.read')
  );

revoke all on table public.sale_item_cost_snapshots from anon, authenticated;
grant select on table public.sale_item_cost_snapshots to authenticated;

commit;
