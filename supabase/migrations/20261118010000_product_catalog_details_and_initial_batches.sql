-- New catalog details and initial lots share the product-creation transaction.
-- Forward only. Do not apply to production as part of local development.
begin;

create table public.product_catalog_details (
  product_id uuid primary key references public.products(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 20000),
  updated_at timestamptz not null default now()
);
alter table public.product_catalog_details enable row level security;
create policy product_catalog_details_read on public.product_catalog_details for select to authenticated
  using (public.has_org_permission(organization_id, 'inventory.products.read')
    and exists (select 1 from public.products p where p.id = product_id and p.organization_id = product_catalog_details.organization_id));
revoke all on public.product_catalog_details from public, anon, authenticated;
grant select on public.product_catalog_details to authenticated;
grant all on public.product_catalog_details to service_role;

create function public.create_product_catalog_atomic(p_product jsonb, p_variants jsonb, p_branch_id uuid, p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := nullif(p_product->>'organization_id', '')::uuid;
  v_result jsonb;
  v_id uuid;
  v_batch jsonb;
  v_variant record;
  v_count integer;
  v_seen text[] := '{}';
begin
  if v_org is null or p_actor_id is null or nullif(p_product->>'id', '') is not null then raise exception 'CATALOG_CREATE_ONLY'; end if;
  if not exists (select 1 from public.organization_members m where m.organization_id = v_org and m.user_id = p_actor_id and m.status = 'active') then raise exception 'CATALOG_ACTOR_FORBIDDEN'; end if;
  if p_product ? 'product_details' and jsonb_typeof(p_product->'product_details') <> 'object' then raise exception 'CATALOG_DETAILS_INVALID'; end if;
  if coalesce(jsonb_typeof(p_product->'initial_batches'), 'array') <> 'array' then raise exception 'CATALOG_BATCH_INVALID'; end if;
  if coalesce(p_product->>'unit_measure', '') = 'servicio' and
    (coalesce((p_product->>'stock_quantity')::numeric, 0) <> 0 or coalesce((p_product->>'has_variants')::boolean, false)
      or jsonb_array_length(coalesce(p_product->'initial_batches', '[]'::jsonb)) > 0 or coalesce(p_product->'initial_batch','null'::jsonb) <> 'null'::jsonb)
    then raise exception 'CATALOG_SERVICE_INVENTORY'; end if;
  if coalesce((p_product->>'has_variants')::boolean, false) then
    v_result := public.save_product_with_variants(p_product, p_variants, p_branch_id, p_actor_id);
  else
    if jsonb_array_length(coalesce(p_product->'initial_batches', '[]'::jsonb)) > 0 then raise exception 'CATALOG_BATCH_REQUIRES_VARIANTS'; end if;
    v_result := public.create_simple_product_atomic(p_product, p_branch_id, p_actor_id);
  end if;
  v_id := (v_result->>'product_id')::uuid;
  if not exists (select 1 from public.products p where p.id = v_id and p.organization_id = v_org) then raise exception 'CATALOG_PRODUCT_SCOPE'; end if;
  if p_product ? 'product_details' then
    insert into public.product_catalog_details(product_id, organization_id, details) values(v_id, v_org, p_product->'product_details');
  end if;

  -- Explicit lot per variant. Older callers with one aggregate lot are expanded
  -- across the actual variant quantities rather than silently losing the lot.
  if coalesce((p_product->>'has_variants')::boolean, false) then
    for v_variant in select v.id, v.sku, i.stock_quantity from public.product_variants v
      join public.branch_variant_inventory i on i.variant_id = v.id and i.organization_id = v_org and i.branch_id = p_branch_id
      where v.product_id = v_id and v.organization_id = v_org and v.is_active is not false and i.stock_quantity > 0
    loop
      v_batch := null;
      select count(*) into v_count from jsonb_array_elements(coalesce(p_product->'initial_batches', '[]'::jsonb)) b where b->>'sku' = v_variant.sku;
      if v_count > 1 then raise exception 'CATALOG_BATCH_DUPLICATE'; end if;
      select b into v_batch from jsonb_array_elements(coalesce(p_product->'initial_batches', '[]'::jsonb)) b where b->>'sku' = v_variant.sku;
      if v_batch is null then v_batch := nullif(p_product->'initial_batch', 'null'::jsonb); end if;
      if v_batch is not null then
        if v_variant.stock_quantity <= 0 or nullif(v_batch->>'expires_on', '') is null then raise exception 'CATALOG_BATCH_WITHOUT_STOCK'; end if;
        insert into public.product_batches(organization_id, product_id, variant_id, lot_code, expires_on, quantity, created_by)
          values(v_org, v_id, v_variant.id, nullif(trim(v_batch->>'lot_code'), ''), (v_batch->>'expires_on')::date, v_variant.stock_quantity, p_actor_id);
        v_seen := array_append(v_seen, v_variant.sku);
      end if;
    end loop;
    if exists (select 1 from jsonb_array_elements(coalesce(p_product->'initial_batches', '[]'::jsonb)) b where not (b->>'sku' = any(v_seen))) then raise exception 'CATALOG_BATCH_VARIANT_NOT_FOUND'; end if;
  end if;
  return v_result;
end;
$$;
revoke all on function public.create_product_catalog_atomic(jsonb,jsonb,uuid,uuid) from public, anon, authenticated;
grant execute on function public.create_product_catalog_atomic(jsonb,jsonb,uuid,uuid) to service_role;
commit;
