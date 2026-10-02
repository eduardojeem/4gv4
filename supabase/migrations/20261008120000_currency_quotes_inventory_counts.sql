-- Tres herramientas para la operación diaria de las tiendas:
--
--  1. Precios en otra moneda. Un producto puede tener su precio en USD (u otra
--     moneda) y el precio en guaraníes se calcula con el tipo de cambio de la
--     empresa. `sale_price` sigue siendo el precio que usa todo el sistema
--     (POS, tienda, reportes): solo cambia quién lo calcula.
--  2. Presupuestos. Se arman, se mandan por WhatsApp con un enlace público y
--     se convierten en venta desde el POS.
--  3. Toma de inventario física. Se cuenta, se ven las diferencias y se ajusta
--     el stock de la sucursal dejando un movimiento por cada producto.

begin;

-- ════════════════════════════════════════════════════════════════════════
-- 1. Precios en otra moneda
-- ════════════════════════════════════════════════════════════════════════

-- 1 unidad de `currency` = `rate` en la moneda de la empresa.
create table if not exists public.exchange_rates (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  currency text not null check (char_length(currency) = 3 and currency = upper(currency)),
  rate numeric(18,6) not null check (rate > 0),
  -- A cuánto se redondea el precio calculado: 1, 100, 500, 1000 guaraníes...
  rounding numeric(12,2) not null default 1 check (rounding in (0.01, 1, 10, 50, 100, 500, 1000)),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (organization_id, currency)
);

create table if not exists public.exchange_rate_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  currency text not null,
  previous_rate numeric(18,6),
  rate numeric(18,6) not null,
  rounding numeric(12,2) not null,
  products_updated integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index if not exists exchange_rate_history_org_idx
  on public.exchange_rate_history (organization_id, currency, created_at desc);

alter table public.products
  add column if not exists price_currency text
    check (price_currency is null or (char_length(price_currency) = 3 and price_currency = upper(price_currency))),
  add column if not exists foreign_sale_price numeric(14,4) check (foreign_sale_price is null or foreign_sale_price >= 0),
  add column if not exists foreign_wholesale_price numeric(14,4) check (foreign_wholesale_price is null or foreign_wholesale_price >= 0),
  add column if not exists foreign_purchase_price numeric(14,4) check (foreign_purchase_price is null or foreign_purchase_price >= 0);

create index if not exists products_price_currency_idx
  on public.products (organization_id, price_currency) where price_currency is not null;

create or replace function public.convert_currency_amount(p_amount numeric, p_rate numeric, p_rounding numeric)
returns numeric
language sql immutable
set search_path = pg_catalog
as $$
  select case
    when p_amount is null then null
    else round(p_amount * p_rate / nullif(p_rounding, 0)) * p_rounding
  end
$$;

-- Con moneda extranjera, los precios en moneda local se calculan siempre acá:
-- da igual si el producto se guarda desde el formulario, una importación o el
-- POS, el precio queda alineado con el tipo de cambio vigente.
-- Security definer: el precio se calcula igual sin importar quién guarda el
-- producto (la tienda, un proceso del sistema). Solo lee filas de la misma
-- empresa del producto.
create or replace function public.apply_product_foreign_prices()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local text;
  v_rate numeric;
  v_rounding numeric;
begin
  if new.price_currency is null then
    new.foreign_sale_price := null;
    new.foreign_wholesale_price := null;
    new.foreign_purchase_price := null;
    return new;
  end if;

  select coalesce(settings.currency, 'PYG') into v_local
  from public.organization_settings settings
  where settings.organization_id = new.organization_id;

  -- Elegir la moneda local equivale a no tener moneda extranjera.
  if new.price_currency = coalesce(v_local, 'PYG') then
    new.price_currency := null;
    new.foreign_sale_price := null;
    new.foreign_wholesale_price := null;
    new.foreign_purchase_price := null;
    return new;
  end if;

  if new.foreign_sale_price is null then
    raise exception 'FOREIGN_PRICE_REQUIRED';
  end if;

  select rates.rate, rates.rounding into v_rate, v_rounding
  from public.exchange_rates rates
  where rates.organization_id = new.organization_id
    and rates.currency = new.price_currency;

  if not found then
    raise exception 'EXCHANGE_RATE_MISSING|%', new.price_currency;
  end if;

  new.sale_price := public.convert_currency_amount(new.foreign_sale_price, v_rate, v_rounding);
  if new.foreign_wholesale_price is not null then
    new.wholesale_price := public.convert_currency_amount(new.foreign_wholesale_price, v_rate, v_rounding);
  end if;
  -- El costo no se redondea: es para calcular margen, no un precio de góndola.
  if new.foreign_purchase_price is not null then
    new.purchase_price := round(new.foreign_purchase_price * v_rate, 2);
  end if;
  return new;
end;
$$;

drop trigger if exists products_apply_foreign_prices on public.products;
create trigger products_apply_foreign_prices
  before insert or update on public.products
  for each row execute function public.apply_product_foreign_prices();

-- Cambia el tipo de cambio y recalcula todos los precios en esa moneda,
-- dejando el cambio en el historial de precios de cada producto.
create or replace function public.set_exchange_rate(
  p_organization_id uuid,
  p_currency text,
  p_rate numeric,
  p_rounding numeric default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_currency text := upper(trim(coalesce(p_currency, '')));
  v_local text;
  v_previous numeric;
  v_before jsonb;
  v_updated integer := 0;
  v_reason text;
begin
  if v_uid is null or not public.has_org_permission(p_organization_id, 'settings.manage') then
    raise exception 'EXCHANGE_RATE_FORBIDDEN';
  end if;
  if char_length(v_currency) <> 3 then raise exception 'EXCHANGE_RATE_INVALID_CURRENCY'; end if;
  if p_rate is null or p_rate <= 0 then raise exception 'EXCHANGE_RATE_INVALID_RATE'; end if;

  select coalesce(settings.currency, 'PYG') into v_local
  from public.organization_settings settings where settings.organization_id = p_organization_id;
  if v_currency = coalesce(v_local, 'PYG') then raise exception 'EXCHANGE_RATE_LOCAL_CURRENCY'; end if;

  select rates.rate into v_previous
  from public.exchange_rates rates
  where rates.organization_id = p_organization_id and rates.currency = v_currency
  for update;

  insert into public.exchange_rates (organization_id, currency, rate, rounding, updated_at, updated_by)
  values (p_organization_id, v_currency, p_rate, coalesce(p_rounding, 1), now(), v_uid)
  on conflict (organization_id, currency) do update
    set rate = excluded.rate, rounding = excluded.rounding, updated_at = now(), updated_by = v_uid;

  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'sale', p.sale_price, 'wholesale', p.wholesale_price)), '[]'::jsonb)
  into v_before
  from public.products p
  where p.organization_id = p_organization_id and p.price_currency = v_currency;

  -- El trigger recalcula; tocar la fila alcanza.
  update public.products p
  set updated_at = now()
  where p.organization_id = p_organization_id and p.price_currency = v_currency;
  get diagnostics v_updated = row_count;

  v_reason := format('Tipo de cambio %s: %s → %s', v_currency, coalesce(v_previous::text, 'sin cargar'), p_rate::text);

  insert into public.product_price_history (product_id, price_type, old_price, new_price, change_reason, user_id)
  select p.id, 'sale_price', (b.value->>'sale')::numeric, p.sale_price, v_reason, v_uid
  from jsonb_array_elements(v_before) b
  join public.products p on p.id = (b.value->>'id')::uuid
  where p.sale_price is distinct from (b.value->>'sale')::numeric;

  insert into public.exchange_rate_history (organization_id, currency, previous_rate, rate, rounding, products_updated, created_by)
  values (p_organization_id, v_currency, v_previous, p_rate, coalesce(p_rounding, 1), v_updated, v_uid);

  return jsonb_build_object('currency', v_currency, 'rate', p_rate, 'previous_rate', v_previous, 'products_updated', v_updated);
end;
$$;

-- Se borra solo si ningún producto la usa: si no, esos precios quedarían sin base.
create or replace function public.delete_exchange_rate(p_organization_id uuid, p_currency text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_org_permission(p_organization_id, 'settings.manage') then
    raise exception 'EXCHANGE_RATE_FORBIDDEN';
  end if;
  if exists (
    select 1 from public.products p
    where p.organization_id = p_organization_id and p.price_currency = upper(p_currency)
  ) then
    raise exception 'EXCHANGE_RATE_IN_USE';
  end if;
  delete from public.exchange_rates
  where organization_id = p_organization_id and currency = upper(p_currency);
end;
$$;

alter table public.exchange_rates enable row level security;
alter table public.exchange_rate_history enable row level security;

drop policy if exists exchange_rates_read on public.exchange_rates;
create policy exchange_rates_read on public.exchange_rates
  for select to authenticated
  using (public.get_org_role(organization_id) is not null);

drop policy if exists exchange_rate_history_read on public.exchange_rate_history;
create policy exchange_rate_history_read on public.exchange_rate_history
  for select to authenticated
  using (public.has_org_permission(organization_id, 'inventory.products.read'));

-- Escritura solo por las funciones de arriba.
revoke insert, update, delete on public.exchange_rates from anon, authenticated;
revoke insert, update, delete on public.exchange_rate_history from anon, authenticated;
revoke all on function public.set_exchange_rate(uuid, text, numeric, numeric) from public, anon;
grant execute on function public.set_exchange_rate(uuid, text, numeric, numeric) to authenticated;
revoke all on function public.delete_exchange_rate(uuid, text) from public, anon;
grant execute on function public.delete_exchange_rate(uuid, text) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- Numeración correlativa por empresa (presupuestos y tomas de inventario)
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.assign_document_number()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Serializa por empresa: dos documentos creados a la vez no repiten número.
  perform pg_advisory_xact_lock(hashtextextended(tg_table_name || ':' || new.organization_id::text, 0));
  execute format('select coalesce(max(number), 0) + 1 from public.%I where organization_id = $1', tg_table_name)
    into new.number
    using new.organization_id;
  return new;
end;
$$;

create or replace function public.touch_document_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
-- 2. Presupuestos
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  number integer not null,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null check (char_length(trim(customer_name)) between 1 and 160),
  customer_phone text check (customer_phone is null or char_length(customer_phone) <= 40),
  customer_email text check (customer_email is null or char_length(customer_email) <= 160),
  customer_ruc text check (customer_ruc is null or char_length(customer_ruc) <= 30),
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'rejected', 'converted', 'cancelled')),
  price_mode text not null default 'retail' check (price_mode in ('retail', 'wholesale')),
  valid_until date,
  notes text check (notes is null or char_length(notes) <= 2000),
  currency text not null default 'PYG',
  subtotal numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  share_token uuid not null default gen_random_uuid() unique,
  sale_id uuid references public.sales(id) on delete set null,
  sent_at timestamptz,
  converted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, number)
);
create index if not exists quotes_org_created_idx on public.quotes (organization_id, created_at desc);
create index if not exists quotes_customer_idx on public.quotes (customer_id) where customer_id is not null;

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  position integer not null default 0,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  description text not null check (char_length(trim(description)) between 1 and 300),
  sku text,
  quantity integer not null check (quantity > 0 and quantity <= 100000),
  -- Precio de lista al cotizar (ya en el modo minorista o mayorista elegido).
  unit_price numeric(14,2) not null check (unit_price >= 0),
  discount_rate numeric(5,2) not null default 0 check (discount_rate between 0 and 100),
  line_total numeric(14,2) not null check (line_total >= 0)
);
create index if not exists quote_items_quote_idx on public.quote_items (quote_id, position);

drop trigger if exists quotes_assign_number on public.quotes;
create trigger quotes_assign_number before insert on public.quotes
  for each row execute function public.assign_document_number();
drop trigger if exists quotes_touch_updated_at on public.quotes;
create trigger quotes_touch_updated_at before update on public.quotes
  for each row execute function public.touch_document_updated_at();

alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;

drop policy if exists quotes_member_access on public.quotes;
create policy quotes_member_access on public.quotes
  for all to authenticated
  using (public.has_org_permission(organization_id, 'pos.sales.create'))
  with check (public.has_org_permission(organization_id, 'pos.sales.create'));

drop policy if exists quote_items_member_access on public.quote_items;
create policy quote_items_member_access on public.quote_items
  for all to authenticated
  using (public.has_org_permission(organization_id, 'pos.sales.create'))
  with check (
    public.has_org_permission(organization_id, 'pos.sales.create')
    and exists (select 1 from public.quotes q where q.id = quote_id and q.organization_id = quote_items.organization_id)
  );

-- ════════════════════════════════════════════════════════════════════════
-- 3. Toma de inventario física
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.inventory_counts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  number integer not null,
  name text not null check (char_length(trim(name)) between 1 and 120),
  category_id uuid references public.categories(id) on delete set null,
  status text not null default 'counting' check (status in ('counting', 'applied', 'cancelled')),
  notes text check (notes is null or char_length(notes) <= 2000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  applied_by uuid references auth.users(id) on delete set null,
  applied_at timestamptz,
  -- Resumen al aplicar, para la lista sin recorrer los ítems.
  summary jsonb not null default '{}'::jsonb,
  unique (organization_id, number)
);
create index if not exists inventory_counts_org_idx on public.inventory_counts (organization_id, created_at desc);

create table if not exists public.inventory_count_items (
  id uuid primary key default gen_random_uuid(),
  count_id uuid not null references public.inventory_counts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  name text not null,
  sku text,
  barcode text,
  category_name text,
  unit_cost numeric(14,2) not null default 0,
  -- Stock del sistema al abrir la toma.
  system_qty integer not null,
  counted_qty integer check (counted_qty is null or counted_qty >= 0),
  -- Stock del sistema en el momento de contar este producto. La diferencia se
  -- mide contra esto: lo que se vendió entre que se contó y se aplicó no se
  -- cuenta como faltante.
  system_qty_at_count integer,
  counted_at timestamptz,
  counted_by uuid references auth.users(id) on delete set null,
  applied_delta integer
);
create unique index if not exists inventory_count_items_unique
  on public.inventory_count_items (count_id, product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists inventory_count_items_barcode_idx on public.inventory_count_items (count_id, barcode);

drop trigger if exists inventory_counts_assign_number on public.inventory_counts;
create trigger inventory_counts_assign_number before insert on public.inventory_counts
  for each row execute function public.assign_document_number();
drop trigger if exists inventory_counts_touch_updated_at on public.inventory_counts;
create trigger inventory_counts_touch_updated_at before update on public.inventory_counts
  for each row execute function public.touch_document_updated_at();

alter table public.inventory_counts enable row level security;
alter table public.inventory_count_items enable row level security;

drop policy if exists inventory_counts_read on public.inventory_counts;
create policy inventory_counts_read on public.inventory_counts
  for select to authenticated
  using (public.has_org_permission(organization_id, 'inventory.products.read') and public.user_has_branch_access(branch_id));

drop policy if exists inventory_counts_write on public.inventory_counts;
create policy inventory_counts_write on public.inventory_counts
  for insert to authenticated
  with check (public.has_org_permission(organization_id, 'inventory.stock.manage') and public.user_has_branch_access(branch_id));

drop policy if exists inventory_counts_update on public.inventory_counts;
create policy inventory_counts_update on public.inventory_counts
  for update to authenticated
  -- Una toma aplicada ya no se toca: el registro es lo que quedó en el stock.
  using (status = 'counting' and public.has_org_permission(organization_id, 'inventory.stock.manage') and public.user_has_branch_access(branch_id))
  with check (public.has_org_permission(organization_id, 'inventory.stock.manage') and public.user_has_branch_access(branch_id));

-- Solo se borra una toma sin aplicar (por ejemplo, si falló al abrirse): no tocó el stock.
drop policy if exists inventory_counts_delete on public.inventory_counts;
create policy inventory_counts_delete on public.inventory_counts
  for delete to authenticated
  using (status = 'counting' and public.has_org_permission(organization_id, 'inventory.stock.manage') and public.user_has_branch_access(branch_id));

drop policy if exists inventory_count_items_read on public.inventory_count_items;
create policy inventory_count_items_read on public.inventory_count_items
  for select to authenticated
  using (exists (
    select 1 from public.inventory_counts c
    where c.id = count_id
      and public.has_org_permission(c.organization_id, 'inventory.products.read')
      and public.user_has_branch_access(c.branch_id)
  ));

drop policy if exists inventory_count_items_write on public.inventory_count_items;
create policy inventory_count_items_write on public.inventory_count_items
  for all to authenticated
  using (exists (
    select 1 from public.inventory_counts c
    where c.id = count_id and c.status = 'counting'
      and public.has_org_permission(c.organization_id, 'inventory.stock.manage')
      and public.user_has_branch_access(c.branch_id)
  ))
  with check (exists (
    select 1 from public.inventory_counts c
    where c.id = count_id and c.status = 'counting' and c.organization_id = inventory_count_items.organization_id
      and public.has_org_permission(c.organization_id, 'inventory.stock.manage')
      and public.user_has_branch_access(c.branch_id)
  ));

-- Aplica la toma: ajusta el stock de la sucursal y deja un movimiento por
-- cada producto con diferencia. Todo o nada, en una transacción.
create or replace function public.apply_inventory_count(p_count_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count public.inventory_counts%rowtype;
  v_item public.inventory_count_items%rowtype;
  v_current integer;
  v_reserved integer;
  v_new integer;
  v_delta integer;
  v_note text;
  v_adjusted integer := 0;
  v_counted integer := 0;
  v_units_in integer := 0;
  v_units_out integer := 0;
  v_value numeric := 0;
  v_summary jsonb;
begin
  select * into v_count from public.inventory_counts where id = p_count_id for update;
  if not found then raise exception 'COUNT_NOT_FOUND'; end if;
  if v_uid is null
     or not public.has_org_permission(v_count.organization_id, 'inventory.stock.manage')
     or not public.user_has_branch_access(v_count.branch_id, v_uid) then
    raise exception 'COUNT_FORBIDDEN';
  end if;
  if v_count.status <> 'counting' then raise exception 'COUNT_NOT_OPEN'; end if;

  v_note := format('Toma de inventario #%s', v_count.number);

  for v_item in
    select * from public.inventory_count_items
    where count_id = v_count.id and counted_qty is not null
    order by product_id, variant_id
  loop
    v_counted := v_counted + 1;
    v_delta := v_item.counted_qty - coalesce(v_item.system_qty_at_count, v_item.system_qty);

    if v_delta = 0 then
      update public.inventory_count_items set applied_delta = 0 where id = v_item.id;
      continue;
    end if;

    if v_item.variant_id is null then
      select stock_quantity into v_current
      from public.branch_inventory
      where branch_id = v_count.branch_id and product_id = v_item.product_id
      for update;
      v_current := coalesce(v_current, 0);
      v_new := greatest(0, v_current + v_delta);

      insert into public.branch_inventory (branch_id, product_id, stock_quantity, reserved_quantity)
      values (v_count.branch_id, v_item.product_id, v_new, 0)
      on conflict (branch_id, product_id) do update
        set stock_quantity = excluded.stock_quantity, updated_at = now();

      if v_new <> v_current then
        insert into public.product_movements (
          organization_id, branch_id, product_id, movement_type, quantity,
          previous_stock, new_stock, unit_cost, total_cost, notes,
          reference_id, reference_type, user_id, created_at
        ) values (
          v_count.organization_id, v_count.branch_id, v_item.product_id, 'adjustment', abs(v_new - v_current),
          v_current, v_new, v_item.unit_cost, round(abs(v_new - v_current) * v_item.unit_cost, 2), v_note,
          v_count.id, 'inventory_count', v_uid, now()
        );
      end if;
    else
      select stock_quantity, reserved_quantity into v_current, v_reserved
      from public.branch_variant_inventory
      where organization_id = v_count.organization_id and branch_id = v_count.branch_id and variant_id = v_item.variant_id
      for update;

      if not found then
        v_current := 0;
        v_reserved := 0;
        insert into public.branch_variant_inventory (organization_id, branch_id, product_id, variant_id, stock_quantity)
        values (v_count.organization_id, v_count.branch_id, v_item.product_id, v_item.variant_id, 0);
      end if;

      -- Lo reservado (pedidos sin entregar) no puede quedar por encima del stock.
      v_new := greatest(coalesce(v_reserved, 0), v_current + v_delta);

      if v_new <> v_current then
        update public.branch_variant_inventory
        set stock_quantity = v_new, updated_at = now()
        where organization_id = v_count.organization_id and branch_id = v_count.branch_id and variant_id = v_item.variant_id;

        insert into public.variant_inventory_movements (
          organization_id, branch_id, product_id, variant_id, movement_type, quantity_delta,
          stock_before, stock_after, idempotency_key, reference_type, reference_id, reason, actor_id
        ) values (
          v_count.organization_id, v_count.branch_id, v_item.product_id, v_item.variant_id, 'adjustment', v_new - v_current,
          v_current, v_new, 'inventory_count:' || v_item.id::text, 'inventory_count', v_count.id, v_note, v_uid
        );
      end if;
    end if;

    update public.inventory_count_items set applied_delta = v_new - v_current where id = v_item.id;
    if v_new <> v_current then
      v_adjusted := v_adjusted + 1;
      if v_new > v_current then v_units_in := v_units_in + (v_new - v_current);
      else v_units_out := v_units_out + (v_current - v_new); end if;
      v_value := v_value + (v_new - v_current) * v_item.unit_cost;
    end if;
  end loop;

  v_summary := jsonb_build_object(
    'counted', v_counted,
    'adjusted', v_adjusted,
    'units_in', v_units_in,
    'units_out', v_units_out,
    'value_difference', round(v_value, 2),
    'not_counted', (select count(*) from public.inventory_count_items where count_id = v_count.id and counted_qty is null)
  );

  update public.inventory_counts
  set status = 'applied', applied_at = now(), applied_by = v_uid, summary = v_summary
  where id = v_count.id;

  return v_summary;
end;
$$;

revoke all on function public.apply_inventory_count(uuid) from public, anon;
grant execute on function public.apply_inventory_count(uuid) to authenticated;

commit;
