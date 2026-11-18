create table public.organizations(id uuid primary key);
create table public.organization_members(organization_id uuid, user_id uuid, status text);
create table public.products(id uuid primary key, organization_id uuid not null, sku text, stock_quantity integer);
create table public.product_variants(id uuid primary key, product_id uuid, organization_id uuid, sku text, is_active boolean);
create table public.branch_variant_inventory(variant_id uuid, organization_id uuid, branch_id uuid, stock_quantity integer);
create table public.product_batches(id uuid default gen_random_uuid(), organization_id uuid, product_id uuid, variant_id uuid, lot_code text, expires_on date, quantity integer check(quantity > 0), created_by uuid);
create function public.has_org_permission(uuid,text) returns boolean language sql stable as $$ select $1::text = current_setting('test.org',true) $$;
-- Delegated existing functions are test doubles. The new wrapper and its
-- transactional behavior, casts, scope and privileges execute in real Postgres.
create function public.create_simple_product_atomic(p_product jsonb,p_branch_id uuid,p_actor_id uuid) returns jsonb language plpgsql as $$
declare v_id uuid := gen_random_uuid(); begin
 insert into public.products values(v_id,(p_product->>'organization_id')::uuid,p_product->>'sku',coalesce((p_product->>'stock_quantity')::int,0));
 return jsonb_build_object('product_id',v_id);
end; $$;
create function public.save_product_with_variants(p_product jsonb,p_variants jsonb,p_branch_id uuid,p_actor_id uuid) returns jsonb language plpgsql as $$
declare v_id uuid := gen_random_uuid(); r jsonb; v uuid; begin
 insert into public.products values(v_id,(p_product->>'organization_id')::uuid,p_product->>'sku',0);
 for r in select * from jsonb_array_elements(p_variants) loop
  v:=gen_random_uuid(); insert into public.product_variants values(v,v_id,(p_product->>'organization_id')::uuid,r->>'sku',true);
  insert into public.branch_variant_inventory values(v,(p_product->>'organization_id')::uuid,p_branch_id,coalesce((r->>'stock_quantity')::int,0));
 end loop;
 return jsonb_build_object('product_id',v_id);
end; $$;
