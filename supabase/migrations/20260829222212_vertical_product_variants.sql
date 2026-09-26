begin;

alter table public.products
  add column if not exists has_variants boolean not null default false,
  add column if not exists variant_attribute_config jsonb not null default '[]'::jsonb;

alter table public.product_variants
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists attributes jsonb not null default '{}'::jsonb,
  add column if not exists barcode text,
  add column if not exists purchase_price numeric(14, 2) not null default 0,
  add column if not exists sale_price numeric(14, 2),
  add column if not exists wholesale_price numeric(14, 2),
  add column if not exists min_stock integer not null default 0;

update public.product_variants variant
set
  organization_id = product.organization_id,
  sale_price = coalesce(
    variant.sale_price,
    coalesce(product.sale_price, 0) + coalesce(variant.price_adjustment, 0)
  )
from public.products product
where product.id = variant.product_id
  and (
    variant.organization_id is null
    or variant.sale_price is null
  );

do $$
declare
  constraint_record record;
begin
  if exists (
    select 1
    from public.product_variants
    where organization_id is null
  ) then
    raise exception 'PRODUCT_VARIANT_ORGANIZATION_BACKFILL_FAILED';
  end if;

  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.product_variants'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (sku)'
  loop
    execute format(
      'alter table public.product_variants drop constraint if exists %I',
      constraint_record.conname
    );
  end loop;
end;
$$;

alter table public.product_variants
  alter column organization_id set not null,
  alter column sale_price set not null,
  alter column sale_price set default 0,
  add constraint product_variants_min_stock_nonnegative check (min_stock >= 0) not valid,
  add constraint product_variants_stock_nonnegative check (stock_quantity >= 0) not valid,
  add constraint product_variants_prices_nonnegative check (
    purchase_price >= 0
    and sale_price >= 0
    and (wholesale_price is null or wholesale_price >= 0)
  ) not valid;

alter table public.product_variants validate constraint product_variants_min_stock_nonnegative;
alter table public.product_variants validate constraint product_variants_stock_nonnegative;
alter table public.product_variants validate constraint product_variants_prices_nonnegative;

create unique index if not exists product_variants_org_sku_unique
  on public.product_variants (organization_id, lower(sku))
  where nullif(trim(sku), '') is not null;

create unique index if not exists product_variants_org_barcode_unique
  on public.product_variants (organization_id, lower(barcode))
  where nullif(trim(barcode), '') is not null;

create index if not exists product_variants_org_product_active_idx
  on public.product_variants (organization_id, product_id, is_active);

create table if not exists public.product_variant_attributes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  attribute_key text not null,
  label text not null,
  control text not null check (control in ('text', 'number', 'select', 'color')),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, attribute_key)
);

create index if not exists product_variant_attributes_org_product_idx
  on public.product_variant_attributes (organization_id, product_id, sort_order);

create table if not exists public.branch_variant_inventory (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  reserved_quantity integer not null default 0 check (
    reserved_quantity >= 0 and reserved_quantity <= stock_quantity
  ),
  min_stock integer not null default 0 check (min_stock >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (branch_id, variant_id),
  unique (organization_id, branch_id, variant_id)
);

create index if not exists branch_variant_inventory_org_product_idx
  on public.branch_variant_inventory (organization_id, product_id, branch_id);

create table if not exists public.variant_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  movement_type text not null check (
    movement_type in ('initial', 'adjustment', 'sale', 'sale_cancel', 'return', 'correction')
  ),
  quantity_delta integer not null check (quantity_delta <> 0),
  stock_before integer not null check (stock_before >= 0),
  stock_after integer not null check (stock_after >= 0),
  idempotency_key text not null,
  reference_type text,
  reference_id uuid,
  reason text,
  actor_id uuid not null references auth.users(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create index if not exists variant_inventory_movements_variant_created_idx
  on public.variant_inventory_movements (organization_id, variant_id, created_at desc);

alter table if exists public.sale_items
  add column if not exists variant_id uuid references public.product_variants(id) on delete set null,
  add column if not exists variant_name text,
  add column if not exists variant_sku text,
  add column if not exists variant_attributes jsonb;

create index if not exists sale_items_variant_id_idx
  on public.sale_items (variant_id)
  where variant_id is not null;

create or replace function public.validate_variant_tenant_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  product_organization_id uuid;
  branch_organization_id uuid;
  variant_product_id uuid;
  variant_organization_id uuid;
begin
  select organization_id
  into product_organization_id
  from public.products
  where id = new.product_id;

  if product_organization_id is null or product_organization_id <> new.organization_id then
    raise exception 'VARIANT_PRODUCT_NOT_IN_ORGANIZATION';
  end if;

  if tg_table_name = 'branch_variant_inventory' then
    select organization_id into branch_organization_id
    from public.branches
    where id = new.branch_id;

    select product_id, organization_id
    into variant_product_id, variant_organization_id
    from public.product_variants
    where id = new.variant_id;

    if branch_organization_id is distinct from new.organization_id then
      raise exception 'VARIANT_BRANCH_FORBIDDEN';
    end if;

    if variant_product_id is distinct from new.product_id
       or variant_organization_id is distinct from new.organization_id then
      raise exception 'VARIANT_PRODUCT_MISMATCH';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists product_variants_validate_tenant_scope on public.product_variants;
create trigger product_variants_validate_tenant_scope
  before insert or update of organization_id, product_id
  on public.product_variants
  for each row execute function public.validate_variant_tenant_scope();

drop trigger if exists product_variant_attributes_validate_tenant_scope on public.product_variant_attributes;
create trigger product_variant_attributes_validate_tenant_scope
  before insert or update of organization_id, product_id
  on public.product_variant_attributes
  for each row execute function public.validate_variant_tenant_scope();

drop trigger if exists branch_variant_inventory_validate_tenant_scope on public.branch_variant_inventory;
create trigger branch_variant_inventory_validate_tenant_scope
  before insert or update of organization_id, branch_id, product_id, variant_id
  on public.branch_variant_inventory
  for each row execute function public.validate_variant_tenant_scope();

create or replace function public.prevent_variant_movement_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'VARIANT_INVENTORY_MOVEMENT_IMMUTABLE';
end;
$$;

drop trigger if exists variant_inventory_movements_immutable on public.variant_inventory_movements;
create trigger variant_inventory_movements_immutable
  before update or delete on public.variant_inventory_movements
  for each row execute function public.prevent_variant_movement_mutation();

create or replace function public.refresh_variant_product_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_product_id uuid := coalesce(new.product_id, old.product_id);
begin
  update public.product_variants variant
  set stock_quantity = coalesce((
    select sum(inventory.stock_quantity)
    from public.branch_variant_inventory inventory
    where inventory.variant_id = variant.id
  ), 0),
  updated_at = now()
  where variant.product_id = affected_product_id;

  update public.products product
  set stock_quantity = coalesce((
    select sum(inventory.stock_quantity)
    from public.branch_variant_inventory inventory
    where inventory.product_id = affected_product_id
  ), 0),
  updated_at = now()
  where product.id = affected_product_id
    and product.has_variants = true;

  return coalesce(new, old);
end;
$$;

drop trigger if exists branch_variant_inventory_refresh_stock on public.branch_variant_inventory;
create trigger branch_variant_inventory_refresh_stock
  after insert or update of stock_quantity or delete
  on public.branch_variant_inventory
  for each row execute function public.refresh_variant_product_stock();

create or replace function public.adjust_variant_stock_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_variant_id uuid,
  p_quantity_delta integer,
  p_movement_type text,
  p_idempotency_key text,
  p_actor_id uuid,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inventory_row public.branch_variant_inventory%rowtype;
  existing_movement public.variant_inventory_movements%rowtype;
  resulting_stock integer;
begin
  if p_organization_id is null
     or p_branch_id is null
     or p_variant_id is null
     or p_actor_id is null
     or nullif(trim(p_idempotency_key), '') is null
     or p_quantity_delta = 0 then
    raise exception 'VARIANT_STOCK_INVALID_INPUT';
  end if;

  if not exists (
    select 1
    from public.organization_members member
    where member.organization_id = p_organization_id
      and member.user_id = p_actor_id
      and member.status = 'active'
  ) then
    raise exception 'VARIANT_ACTOR_FORBIDDEN';
  end if;

  select movement.* into existing_movement
  from public.variant_inventory_movements movement
  where movement.organization_id = p_organization_id
    and movement.idempotency_key = trim(p_idempotency_key);

  if found then
    return jsonb_build_object(
      'idempotent', true,
      'movement_id', existing_movement.id,
      'stock_before', existing_movement.stock_before,
      'stock_after', existing_movement.stock_after
    );
  end if;

  select inventory.* into inventory_row
  from public.branch_variant_inventory inventory
  where inventory.organization_id = p_organization_id
    and inventory.branch_id = p_branch_id
    and inventory.variant_id = p_variant_id
  for update;

  if not found then
    raise exception 'VARIANT_BRANCH_FORBIDDEN';
  end if;

  resulting_stock := inventory_row.stock_quantity + p_quantity_delta;
  if resulting_stock < 0 then
    raise exception 'VARIANT_STOCK_INSUFFICIENT|%|%',
      p_variant_id,
      inventory_row.stock_quantity;
  end if;

  update public.branch_variant_inventory
  set stock_quantity = resulting_stock,
      updated_at = now()
  where organization_id = p_organization_id
    and branch_id = p_branch_id
    and variant_id = p_variant_id;

  insert into public.variant_inventory_movements (
    organization_id,
    branch_id,
    product_id,
    variant_id,
    movement_type,
    quantity_delta,
    stock_before,
    stock_after,
    idempotency_key,
    reference_type,
    reference_id,
    reason,
    actor_id,
    metadata
  ) values (
    p_organization_id,
    p_branch_id,
    inventory_row.product_id,
    p_variant_id,
    p_movement_type,
    p_quantity_delta,
    inventory_row.stock_quantity,
    resulting_stock,
    trim(p_idempotency_key),
    nullif(trim(p_reference_type), ''),
    p_reference_id,
    nullif(trim(p_reason), ''),
    p_actor_id,
    coalesce(p_metadata, '{}'::jsonb)
  ) returning id into existing_movement.id;

  return jsonb_build_object(
    'idempotent', false,
    'movement_id', existing_movement.id,
    'stock_before', inventory_row.stock_quantity,
    'stock_after', resulting_stock
  );
exception
  when unique_violation then
    select movement.* into existing_movement
    from public.variant_inventory_movements movement
    where movement.organization_id = p_organization_id
      and movement.idempotency_key = trim(p_idempotency_key);

    if found then
      return jsonb_build_object(
        'idempotent', true,
        'movement_id', existing_movement.id,
        'stock_before', existing_movement.stock_before,
        'stock_after', existing_movement.stock_after
      );
    end if;
    raise;
end;
$$;

create or replace function public.restore_variant_stock_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_variant_id uuid,
  p_quantity integer,
  p_movement_type text,
  p_idempotency_key text,
  p_actor_id uuid,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_quantity <= 0 or p_movement_type not in ('sale_cancel', 'return', 'correction') then
    raise exception 'VARIANT_STOCK_INVALID_RESTORE';
  end if;

  return public.adjust_variant_stock_atomic(
    p_organization_id,
    p_branch_id,
    p_variant_id,
    p_quantity,
    p_movement_type,
    p_idempotency_key,
    p_actor_id,
    p_reference_type,
    p_reference_id,
    p_reason,
    p_metadata
  );
end;
$$;

create or replace function public.save_product_with_variants(
  p_product jsonb,
  p_variants jsonb,
  p_branch_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  product_id uuid := coalesce(nullif(p_product->>'id', '')::uuid, gen_random_uuid());
  organization_id uuid := nullif(p_product->>'organization_id', '')::uuid;
  has_variants boolean := coalesce((p_product->>'has_variants')::boolean, false);
  variant_entry jsonb;
  saved_variant_id uuid;
  saved_variant_ids uuid[] := '{}'::uuid[];
  initial_stock integer;
  branch_organization_id uuid;
begin
  if organization_id is null or p_actor_id is null then
    raise exception 'VARIANT_PRODUCT_INVALID_INPUT';
  end if;

  if not exists (
    select 1
    from public.organization_members member
    where member.organization_id = organization_id
      and member.user_id = p_actor_id
      and member.status = 'active'
  ) then
    raise exception 'VARIANT_ACTOR_FORBIDDEN';
  end if;

  if jsonb_typeof(coalesce(p_variants, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_product->'variant_attribute_config', '[]'::jsonb)) <> 'array' then
    raise exception 'VARIANT_PRODUCT_INVALID_INPUT';
  end if;

  if has_variants and (p_branch_id is null or jsonb_array_length(p_variants) = 0) then
    raise exception 'VARIANT_PRODUCT_REQUIRES_VARIANTS';
  end if;

  if p_branch_id is not null then
    select branch.organization_id into branch_organization_id
    from public.branches branch
    where branch.id = p_branch_id;

    if branch_organization_id is distinct from organization_id then
      raise exception 'VARIANT_BRANCH_FORBIDDEN';
    end if;
  end if;

  insert into public.products (
    id,
    organization_id,
    name,
    sku,
    description,
    category_id,
    supplier_id,
    brand,
    brand_id,
    tags,
    purchase_price,
    sale_price,
    wholesale_price,
    stock_quantity,
    min_stock,
    max_stock,
    unit_measure,
    barcode,
    images,
    image_url,
    offer_price,
    has_offer,
    installments_enabled,
    installments_public,
    installments_plans,
    visibility,
    warranty_months,
    warranty_info,
    return_window_days,
    exchange_window_days,
    return_policy,
    exchange_policy,
    is_active,
    has_variants,
    variant_attribute_config
  ) values (
    product_id,
    organization_id,
    trim(p_product->>'name'),
    trim(p_product->>'sku'),
    nullif(trim(p_product->>'description'), ''),
    nullif(p_product->>'category_id', '')::uuid,
    nullif(p_product->>'supplier_id', '')::uuid,
    nullif(trim(p_product->>'brand'), ''),
    nullif(p_product->>'brand_id', '')::uuid,
    case
      when jsonb_typeof(p_product->'tags') = 'array'
        then array(select jsonb_array_elements_text(p_product->'tags'))
      else null
    end,
    coalesce((p_product->>'purchase_price')::numeric, 0),
    coalesce((p_product->>'sale_price')::numeric, 0),
    nullif(p_product->>'wholesale_price', '')::numeric,
    case when has_variants then 0 else coalesce((p_product->>'stock_quantity')::integer, 0) end,
    coalesce((p_product->>'min_stock')::integer, 0),
    coalesce((p_product->>'max_stock')::integer, 1000),
    coalesce(nullif(trim(p_product->>'unit_measure'), ''), 'unidad'),
    nullif(trim(p_product->>'barcode'), ''),
    case
      when jsonb_typeof(p_product->'images') = 'array'
        then array(select jsonb_array_elements_text(p_product->'images'))
      else null
    end,
    nullif(trim(p_product->>'image_url'), ''),
    nullif(p_product->>'offer_price', '')::numeric,
    coalesce((p_product->>'has_offer')::boolean, false),
    coalesce((p_product->>'installments_enabled')::boolean, false),
    coalesce((p_product->>'installments_public')::boolean, true),
    coalesce(p_product->'installments_plans', '[]'::jsonb),
    coalesce(nullif(trim(p_product->>'visibility'), ''), 'public'),
    nullif(p_product->>'warranty_months', '')::integer,
    nullif(trim(p_product->>'warranty_info'), ''),
    nullif(p_product->>'return_window_days', '')::integer,
    nullif(p_product->>'exchange_window_days', '')::integer,
    nullif(trim(p_product->>'return_policy'), ''),
    nullif(trim(p_product->>'exchange_policy'), ''),
    coalesce((p_product->>'is_active')::boolean, true),
    has_variants,
    coalesce(p_product->'variant_attribute_config', '[]'::jsonb)
  )
  on conflict (id) do update
  set
    name = excluded.name,
    sku = excluded.sku,
    description = excluded.description,
    category_id = excluded.category_id,
    supplier_id = excluded.supplier_id,
    brand = excluded.brand,
    brand_id = excluded.brand_id,
    tags = excluded.tags,
    purchase_price = excluded.purchase_price,
    sale_price = excluded.sale_price,
    wholesale_price = excluded.wholesale_price,
    min_stock = excluded.min_stock,
    max_stock = excluded.max_stock,
    unit_measure = excluded.unit_measure,
    barcode = excluded.barcode,
    images = excluded.images,
    image_url = excluded.image_url,
    offer_price = excluded.offer_price,
    has_offer = excluded.has_offer,
    installments_enabled = excluded.installments_enabled,
    installments_public = excluded.installments_public,
    installments_plans = excluded.installments_plans,
    visibility = excluded.visibility,
    warranty_months = excluded.warranty_months,
    warranty_info = excluded.warranty_info,
    return_window_days = excluded.return_window_days,
    exchange_window_days = excluded.exchange_window_days,
    return_policy = excluded.return_policy,
    exchange_policy = excluded.exchange_policy,
    is_active = excluded.is_active,
    has_variants = excluded.has_variants,
    variant_attribute_config = excluded.variant_attribute_config,
    updated_at = now()
  where products.organization_id = excluded.organization_id;

  if not found then
    raise exception 'VARIANT_PRODUCT_NOT_IN_ORGANIZATION';
  end if;

  delete from public.product_variant_attributes
  where product_variant_attributes.organization_id = organization_id
    and product_variant_attributes.product_id = product_id;

  insert into public.product_variant_attributes (
    organization_id,
    product_id,
    attribute_key,
    label,
    control,
    options,
    sort_order
  )
  select
    organization_id,
    product_id,
    trim(attribute.value->>'key'),
    trim(attribute.value->>'label'),
    attribute.value->>'control',
    coalesce(attribute.value->'options', '[]'::jsonb),
    attribute.ordinality - 1
  from jsonb_array_elements(coalesce(p_product->'variant_attribute_config', '[]'::jsonb))
    with ordinality as attribute(value, ordinality);

  if not has_variants then
    update public.product_variants
    set is_active = false,
        updated_at = now()
    where product_variants.organization_id = organization_id
      and product_variants.product_id = product_id;

    return jsonb_build_object('product_id', product_id, 'variant_ids', '[]'::jsonb);
  end if;

  for variant_entry in
    select value from jsonb_array_elements(p_variants)
  loop
    initial_stock := greatest(0, coalesce((variant_entry->>'stock_quantity')::integer, 0));
    saved_variant_id := coalesce(nullif(variant_entry->>'id', '')::uuid, gen_random_uuid());

    insert into public.product_variants (
      id,
      organization_id,
      product_id,
      variant_name,
      attributes,
      sku,
      barcode,
      purchase_price,
      sale_price,
      wholesale_price,
      min_stock,
      stock_quantity,
      price_adjustment,
      is_active
    ) values (
      saved_variant_id,
      organization_id,
      product_id,
      trim(variant_entry->>'name'),
      coalesce(variant_entry->'attributes', '{}'::jsonb),
      nullif(trim(variant_entry->>'sku'), ''),
      nullif(trim(variant_entry->>'barcode'), ''),
      coalesce((variant_entry->>'purchase_price')::numeric, 0),
      coalesce((variant_entry->>'sale_price')::numeric, 0),
      nullif(variant_entry->>'wholesale_price', '')::numeric,
      greatest(0, coalesce((variant_entry->>'min_stock')::integer, 0)),
      initial_stock,
      coalesce((variant_entry->>'sale_price')::numeric, 0)
        - coalesce((p_product->>'sale_price')::numeric, 0),
      coalesce((variant_entry->>'is_active')::boolean, true)
    )
    on conflict (id) do update
    set
      variant_name = excluded.variant_name,
      attributes = excluded.attributes,
      sku = excluded.sku,
      barcode = excluded.barcode,
      purchase_price = excluded.purchase_price,
      sale_price = excluded.sale_price,
      wholesale_price = excluded.wholesale_price,
      min_stock = excluded.min_stock,
      price_adjustment = excluded.price_adjustment,
      is_active = excluded.is_active,
      updated_at = now()
    where product_variants.organization_id = excluded.organization_id
      and product_variants.product_id = excluded.product_id;

    if not found then
      raise exception 'VARIANT_PRODUCT_MISMATCH';
    end if;

    saved_variant_ids := array_append(saved_variant_ids, saved_variant_id);

    insert into public.branch_variant_inventory (
      organization_id,
      branch_id,
      product_id,
      variant_id,
      stock_quantity,
      min_stock
    ) values (
      organization_id,
      p_branch_id,
      product_id,
      saved_variant_id,
      initial_stock,
      greatest(0, coalesce((variant_entry->>'min_stock')::integer, 0))
    )
    on conflict (branch_id, variant_id) do nothing;

    if found and initial_stock > 0 then
      insert into public.variant_inventory_movements (
        organization_id,
        branch_id,
        product_id,
        variant_id,
        movement_type,
        quantity_delta,
        stock_before,
        stock_after,
        idempotency_key,
        reason,
        actor_id,
        metadata
      ) values (
        organization_id,
        p_branch_id,
        product_id,
        saved_variant_id,
        'initial',
        initial_stock,
        0,
        initial_stock,
        'variant-initial:' || p_branch_id::text || ':' || saved_variant_id::text,
        'Stock inicial de la variante',
        p_actor_id,
        '{}'::jsonb
      ) on conflict (organization_id, idempotency_key) do nothing;
    end if;

    update public.branch_variant_inventory
    set min_stock = greatest(0, coalesce((variant_entry->>'min_stock')::integer, 0)),
        updated_at = now()
    where branch_variant_inventory.organization_id = organization_id
      and branch_variant_inventory.branch_id = p_branch_id
      and branch_variant_inventory.variant_id = saved_variant_id;
  end loop;

  update public.product_variants
  set is_active = false,
      updated_at = now()
  where product_variants.organization_id = organization_id
    and product_variants.product_id = product_id
    and not (product_variants.id = any(saved_variant_ids));

  return jsonb_build_object(
    'product_id', product_id,
    'variant_ids', to_jsonb(saved_variant_ids)
  );
exception
  when unique_violation then
    if sqlerrm ilike '%barcode%' then
      raise exception 'VARIANT_BARCODE_DUPLICATE';
    end if;
    raise exception 'VARIANT_SKU_DUPLICATE';
end;
$$;

alter table public.product_variants enable row level security;
alter table public.product_variant_attributes enable row level security;
alter table public.branch_variant_inventory enable row level security;
alter table public.variant_inventory_movements enable row level security;

drop policy if exists "Authenticated users can view variants" on public.product_variants;
drop policy if exists "Admins and vendedores can manage variants" on public.product_variants;

create policy product_variants_tenant_read
on public.product_variants for select to authenticated
using (public.has_org_permission(organization_id, 'inventory.products.read'));

create policy product_variants_tenant_create
on public.product_variants for insert to authenticated
with check (public.has_org_permission(organization_id, 'inventory.products.create'));

create policy product_variants_tenant_update
on public.product_variants for update to authenticated
using (public.has_org_permission(organization_id, 'inventory.products.update'))
with check (public.has_org_permission(organization_id, 'inventory.products.update'));

create policy product_variants_tenant_delete
on public.product_variants for delete to authenticated
using (public.has_org_permission(organization_id, 'inventory.products.delete'));

create policy product_variant_attributes_tenant_read
on public.product_variant_attributes for select to authenticated
using (public.has_org_permission(organization_id, 'inventory.products.read'));

create policy product_variant_attributes_tenant_write
on public.product_variant_attributes for all to authenticated
using (public.has_org_permission(organization_id, 'inventory.products.update'))
with check (public.has_org_permission(organization_id, 'inventory.products.update'));

create policy branch_variant_inventory_tenant_read
on public.branch_variant_inventory for select to authenticated
using (
  public.has_org_permission(organization_id, 'inventory.products.read')
  and public.user_has_branch_access(branch_id)
);

create policy branch_variant_inventory_tenant_write
on public.branch_variant_inventory for all to authenticated
using (
  public.has_org_permission(organization_id, 'inventory.stock.manage')
  and public.user_has_branch_access(branch_id)
)
with check (
  public.has_org_permission(organization_id, 'inventory.stock.manage')
  and public.user_has_branch_access(branch_id)
);

create policy variant_inventory_movements_tenant_read
on public.variant_inventory_movements for select to authenticated
using (
  public.has_org_permission(organization_id, 'inventory.products.read')
  and public.user_has_branch_access(branch_id)
);

revoke all on function public.save_product_with_variants(jsonb, jsonb, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.save_product_with_variants(jsonb, jsonb, uuid, uuid)
  to service_role;

revoke all on function public.adjust_variant_stock_atomic(
  uuid, uuid, uuid, integer, text, text, uuid, text, uuid, text, jsonb
) from public, anon, authenticated;
grant execute on function public.adjust_variant_stock_atomic(
  uuid, uuid, uuid, integer, text, text, uuid, text, uuid, text, jsonb
) to service_role;

revoke all on function public.restore_variant_stock_atomic(
  uuid, uuid, uuid, integer, text, text, uuid, text, uuid, text, jsonb
) from public, anon, authenticated;
grant execute on function public.restore_variant_stock_atomic(
  uuid, uuid, uuid, integer, text, text, uuid, text, uuid, text, jsonb
) to service_role;

revoke all on function public.refresh_variant_product_stock() from public, anon, authenticated;
revoke all on function public.validate_variant_tenant_scope() from public, anon, authenticated;
revoke all on function public.prevent_variant_movement_mutation() from public, anon, authenticated;

commit;
