-- Costo historico de los items de un pedido de la tienda web.
--
-- `customer_order_items` guarda el precio de venta pero no el costo, asi que
-- Finanzas contaba la facturacion del canal web sin poder calcular su margen: la
-- utilidad quedaba marcada como provisoria cada vez que habia un pedido.
--
-- Se captura con un trigger, igual que en el POS, y por el mismo motivo que ahi:
-- reconstruir el costo despues desde `products.purchase_price` daria el precio de
-- compra de hoy, no el del dia de la venta, y con eso el margen historico cambia
-- solo cada vez que se actualiza una lista de precios.

begin;

create table if not exists public.customer_order_item_cost_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  order_id uuid not null references public.customer_orders(id) on delete cascade,
  order_item_id uuid not null references public.customer_order_items(id) on delete cascade,
  product_id uuid references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_cost numeric(14, 2),
  total_cost numeric(14, 2),
  created_at timestamptz not null default now(),
  unique (organization_id, order_item_id),
  check (
    (unit_cost is null and total_cost is null)
    or (unit_cost is not null and total_cost = round(unit_cost * quantity, 2))
  )
);

create index if not exists customer_order_item_cost_snapshots_org_order_idx
  on public.customer_order_item_cost_snapshots (organization_id, order_id);

alter table public.customer_order_item_cost_snapshots enable row level security;

drop policy if exists "tenant members read order cost snapshots"
  on public.customer_order_item_cost_snapshots;
create policy "tenant members read order cost snapshots"
  on public.customer_order_item_cost_snapshots for select
  using (public.is_org_member(organization_id));

create or replace function public.capture_customer_order_item_cost()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  order_organization_id uuid;
  captured_product_id uuid;
  captured_unit_cost numeric(14, 2);
begin
  select o.organization_id, product.id, nullif(product.purchase_price, 0)
  into order_organization_id, captured_product_id, captured_unit_cost
  from public.customer_orders o
  left join public.products product
    on product.id = new.product_id
   and product.organization_id = o.organization_id
  where o.id = new.order_id;

  -- Sin pedido no hay a que asociar el costo, pero tampoco se corta la creacion
  -- del pedido por esto: el snapshot es un dato de reporte, no del negocio.
  if order_organization_id is null then
    return new;
  end if;

  insert into public.customer_order_item_cost_snapshots (
    organization_id,
    order_id,
    order_item_id,
    product_id,
    quantity,
    unit_cost,
    total_cost
  ) values (
    order_organization_id,
    new.order_id,
    new.id,
    captured_product_id,
    new.quantity,
    captured_unit_cost,
    case when captured_unit_cost is null then null else round(captured_unit_cost * new.quantity, 2) end
  )
  on conflict (organization_id, order_item_id) do nothing;

  return new;
end;
$$;

drop trigger if exists capture_customer_order_item_cost_trigger
  on public.customer_order_items;
create trigger capture_customer_order_item_cost_trigger
  after insert on public.customer_order_items
  for each row
  execute function public.capture_customer_order_item_cost();

commit;
