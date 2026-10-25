-- Set an absolute branch stock target while holding the inventory row lock.
-- The request ledger makes retries (including no-op targets) idempotent.
begin;

create schema if not exists private;

create table if not exists private.variant_branch_stock_target_requests (
  organization_id uuid not null,
  idempotency_key text not null,
  branch_id uuid not null,
  product_id uuid not null,
  variant_id uuid not null,
  actor_id uuid not null,
  target_quantity integer not null check (target_quantity >= 0),
  stock_before integer not null check (stock_before >= 0),
  stock_after integer not null check (stock_after >= 0),
  applied_delta integer not null,
  movement_id uuid,
  reference_type text,
  reference_id uuid,
  created_at timestamptz not null default now(),
  primary key (organization_id, idempotency_key)
);

alter table private.variant_branch_stock_target_requests enable row level security;
revoke all on table private.variant_branch_stock_target_requests from public, anon, authenticated, service_role;

create or replace function public.set_variant_branch_stock_target(
  p_organization_id uuid,
  p_branch_id uuid,
  p_variant_id uuid,
  p_target_quantity integer,
  p_idempotency_key text,
  p_actor_id uuid,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  target_product_id uuid;
  target_min_stock integer;
  branch_organization_id uuid;
  inventory_row public.branch_variant_inventory%rowtype;
  existing_request private.variant_branch_stock_target_requests%rowtype;
  applied_delta integer;
  resulting_stock integer;
  created_movement_id uuid;
  inserted_rows integer;
begin
  if p_organization_id is null
     or p_branch_id is null
     or p_variant_id is null
     or p_actor_id is null
     or p_target_quantity is null
     or p_target_quantity < 0
     or nullif(trim(p_idempotency_key), '') is null
     or char_length(trim(p_idempotency_key)) > 255
     or trim(p_idempotency_key) not like 'variant-target:%' then
    raise exception 'VARIANT_STOCK_INVALID_INPUT';
  end if;

  if not exists (
    select 1 from public.organization_members member
    where member.organization_id = p_organization_id
      and member.user_id = p_actor_id
      and member.status = 'active'
  ) then
    raise exception 'VARIANT_ACTOR_FORBIDDEN';
  end if;

  -- A retried request returns its original result before reading current stock.
  select request.* into existing_request
  from private.variant_branch_stock_target_requests request
  where request.organization_id = p_organization_id
    and request.idempotency_key = trim(p_idempotency_key);

  if found then
    if existing_request.branch_id is distinct from p_branch_id
       or existing_request.variant_id is distinct from p_variant_id
       or existing_request.target_quantity is distinct from p_target_quantity
       or existing_request.actor_id is distinct from p_actor_id
       or existing_request.reference_type is distinct from nullif(trim(p_reference_type), '')
       or existing_request.reference_id is distinct from p_reference_id then
      raise exception 'VARIANT_STOCK_IDEMPOTENCY_CONFLICT';
    end if;

    return jsonb_build_object(
      'idempotent', true,
      'movement_id', existing_request.movement_id,
      'stock_before', existing_request.stock_before,
      'stock_after', existing_request.stock_after,
      'applied_delta', existing_request.applied_delta
    );
  end if;

  select branch.organization_id into branch_organization_id
  from public.branches branch
  where branch.id = p_branch_id;

  if branch_organization_id is distinct from p_organization_id then
    raise exception 'VARIANT_BRANCH_FORBIDDEN';
  end if;

  select variant.product_id, greatest(0, coalesce(variant.min_stock, 0))
    into target_product_id, target_min_stock
  from public.product_variants variant
  join public.products product
    on product.id = variant.product_id
   and product.organization_id = variant.organization_id
  where variant.id = p_variant_id
    and variant.organization_id = p_organization_id
  for key share of variant, product;

  if target_product_id is null then
    raise exception 'VARIANT_PRODUCT_NOT_IN_ORGANIZATION';
  end if;

  -- Concurrent first writes both attempt the same zero row; the PK arbitrates.
  insert into public.branch_variant_inventory (
    organization_id, branch_id, product_id, variant_id, stock_quantity, min_stock
  ) values (
    p_organization_id, p_branch_id, target_product_id, p_variant_id, 0, target_min_stock
  )
  on conflict do nothing;

  select inventory.* into inventory_row
  from public.branch_variant_inventory inventory
  where inventory.organization_id = p_organization_id
    and inventory.branch_id = p_branch_id
    and inventory.product_id = target_product_id
    and inventory.variant_id = p_variant_id
  for update;

  if not found then
    raise exception 'VARIANT_BRANCH_FORBIDDEN';
  end if;

  -- Recheck after the row lock so same-key concurrent callers observe the winner.
  select request.* into existing_request
  from private.variant_branch_stock_target_requests request
  where request.organization_id = p_organization_id
    and request.idempotency_key = trim(p_idempotency_key);

  if found then
    if existing_request.branch_id is distinct from p_branch_id
       or existing_request.variant_id is distinct from p_variant_id
       or existing_request.target_quantity is distinct from p_target_quantity
       or existing_request.actor_id is distinct from p_actor_id
       or existing_request.reference_type is distinct from nullif(trim(p_reference_type), '')
       or existing_request.reference_id is distinct from p_reference_id then
      raise exception 'VARIANT_STOCK_IDEMPOTENCY_CONFLICT';
    end if;

    return jsonb_build_object(
      'idempotent', true,
      'movement_id', existing_request.movement_id,
      'stock_before', existing_request.stock_before,
      'stock_after', existing_request.stock_after,
      'applied_delta', existing_request.applied_delta
    );
  end if;

  applied_delta := p_target_quantity - inventory_row.stock_quantity;
  resulting_stock := p_target_quantity;

  -- Claim the idempotency key before changing stock. This also safely arbitrates
  -- a key reused concurrently for a different variant or branch.
  insert into private.variant_branch_stock_target_requests (
    organization_id, idempotency_key, branch_id, product_id, variant_id, actor_id,
    target_quantity, stock_before, stock_after, applied_delta, movement_id,
    reference_type, reference_id
  ) values (
    p_organization_id, trim(p_idempotency_key), p_branch_id, target_product_id, p_variant_id, p_actor_id,
    p_target_quantity, inventory_row.stock_quantity, resulting_stock, applied_delta, null,
    nullif(trim(p_reference_type), ''), p_reference_id
  ) on conflict (organization_id, idempotency_key) do nothing;
  get diagnostics inserted_rows = row_count;

  if inserted_rows = 0 then
    select request.* into existing_request
    from private.variant_branch_stock_target_requests request
    where request.organization_id = p_organization_id
      and request.idempotency_key = trim(p_idempotency_key);
    if not found
       or existing_request.branch_id is distinct from p_branch_id
       or existing_request.variant_id is distinct from p_variant_id
       or existing_request.target_quantity is distinct from p_target_quantity
       or existing_request.actor_id is distinct from p_actor_id
       or existing_request.reference_type is distinct from nullif(trim(p_reference_type), '')
       or existing_request.reference_id is distinct from p_reference_id then
      raise exception 'VARIANT_STOCK_IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object(
      'idempotent', true,
      'movement_id', existing_request.movement_id,
      'stock_before', existing_request.stock_before,
      'stock_after', existing_request.stock_after,
      'applied_delta', existing_request.applied_delta
    );
  end if;

  if applied_delta <> 0 then
    update public.branch_variant_inventory
    set stock_quantity = resulting_stock,
        updated_at = now()
    where organization_id = p_organization_id
      and branch_id = p_branch_id
      and product_id = target_product_id
      and variant_id = p_variant_id;

    insert into public.variant_inventory_movements (
      organization_id, branch_id, product_id, variant_id, movement_type,
      quantity_delta, stock_before, stock_after, idempotency_key,
      reference_type, reference_id, reason, actor_id, metadata
    ) values (
      p_organization_id, p_branch_id, target_product_id, p_variant_id, 'adjustment',
      applied_delta, inventory_row.stock_quantity, resulting_stock, trim(p_idempotency_key),
      nullif(trim(p_reference_type), ''), p_reference_id, nullif(trim(p_reason), ''),
      p_actor_id, coalesce(p_metadata, '{}'::jsonb)
    ) returning id into created_movement_id;

    update private.variant_branch_stock_target_requests
    set movement_id = created_movement_id
    where organization_id = p_organization_id
      and idempotency_key = trim(p_idempotency_key);
  end if;

  return jsonb_build_object(
    'idempotent', false,
    'movement_id', created_movement_id,
    'stock_before', inventory_row.stock_quantity,
    'stock_after', resulting_stock,
    'applied_delta', applied_delta
  );
end;
$function$;

revoke all on function public.set_variant_branch_stock_target(uuid, uuid, uuid, integer, text, uuid, text, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.set_variant_branch_stock_target(uuid, uuid, uuid, integer, text, uuid, text, uuid, text, jsonb) to service_role;

comment on function public.set_variant_branch_stock_target(uuid, uuid, uuid, integer, text, uuid, text, uuid, text, jsonb)
is 'Sets a variant stock target atomically for one organization branch; service-role only and idempotent per request key.';

commit;
