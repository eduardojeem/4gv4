create role anon; create role authenticated; create role service_role;
create schema auth; create schema extensions;
create function extensions.uuid_generate_v4() returns uuid language sql as $$select gen_random_uuid()$$;
create function auth.uid() returns uuid language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
create table organizations(id uuid primary key);
create table organization_members(organization_id uuid,user_id uuid,status text,role text);
create table branches(id uuid primary key,organization_id uuid,is_active boolean,is_default boolean default false,created_at timestamptz default now());
create table customers(id uuid primary key,organization_id uuid);
create table products(id uuid primary key,organization_id uuid,stock_quantity integer,updated_at timestamptz,has_variants boolean default false);
create table sales(id uuid primary key,organization_id uuid,branch_id uuid,customer_id uuid,subtotal_amount numeric,total_amount numeric,status text default 'completed');
create table sale_items(id uuid primary key,sale_id uuid,organization_id uuid,product_id uuid,quantity integer,subtotal numeric,variant_id uuid);
create table repairs(id uuid primary key default gen_random_uuid(),organization_id uuid,branch_id uuid,customer_id uuid,parent_repair_id uuid,device_type text,device_brand text,device_model text,problem_description text,technician_id uuid,priority text,urgency text,status text,estimated_cost numeric,labor_cost numeric,warranty_months integer,warranty_type text,ticket_number text,final_cost numeric);
create table repair_notes(repair_id uuid,note_text text,author_id uuid,author_name text,is_internal boolean);
create table product_movements(product_id uuid,movement_type text,quantity integer,previous_stock integer,new_stock integer,reference_type text,reference_id uuid,notes text,user_id uuid,organization_id uuid,branch_id uuid);
create table customer_store_credits(organization_id uuid,customer_id uuid,amount numeric,reason text,source_type text,source_id uuid,created_by uuid);
create table cash_closures(id uuid primary key,organization_id uuid,branch_id uuid,date timestamptz,register_id text,created_at timestamptz default now());
create table cash_movements(id uuid primary key default gen_random_uuid(),session_id uuid,organization_id uuid,branch_id uuid,type text,amount numeric,reason text,payment_method text,created_by uuid,finance_payment_id uuid,payroll_payment_id uuid);
create table after_sales_cases(id uuid primary key default gen_random_uuid(),organization_id uuid,case_number text default 'TEST',source_type text,request_type text,status text default 'open',customer_id uuid,repair_id uuid,sale_id uuid,sale_item_id uuid,product_id uuid,quantity integer,reason text,notes text,refund_amount numeric,refund_method text,restock_action text,replacement_product_id uuid,replacement_quantity integer,price_difference numeric,generated_repair_id uuid,approved_at timestamptz,resolved_at timestamptz,created_by uuid,resolved_by uuid,created_at timestamptz default now(),updated_at timestamptz default now());
create function public.has_org_permission(org uuid,perm text) returns boolean language sql stable security definer as $$select perm <> 'finances.read' and exists(select 1 from organization_members where organization_id=org and user_id=auth.uid() and status='active')$$;
create function public.get_user_role(uuid) returns text language sql stable as $$select 'admin'::text$$;
create function public.user_has_branch_access(branch uuid,actor uuid default auth.uid()) returns boolean language sql stable security definer as $$select exists(select 1 from branches b join organization_members m on m.organization_id=b.organization_id where b.id=branch and m.user_id=actor and m.status='active')$$;
create function public.server_record_cash_movement_atomic(p_actor_user_id uuid,p_organization_id uuid,p_branch_id uuid,p_session_id uuid,p_type text,p_amount numeric,p_reason text) returns jsonb language plpgsql as $$begin if not exists(select 1 from cash_closures where id=p_session_id and organization_id=p_organization_id and branch_id=p_branch_id and date is null) then raise exception 'OPEN_CASH_SESSION_NOT_FOUND'; end if; insert into cash_movements(session_id,organization_id,branch_id,type,amount,reason,created_by) values(p_session_id,p_organization_id,p_branch_id,p_type,p_amount,p_reason,p_actor_user_id);return '{}'::jsonb;end$$;
create function public.reverse_loyalty_points_for_refund(uuid,uuid,uuid,numeric,text) returns jsonb language sql as $$select null::jsonb$$;
alter table cash_movements enable row level security;
create policy "tenant members can read cash movements" on cash_movements for select to authenticated using(has_org_permission(organization_id,'pos.sales.read'));
create policy cash_movements_finance_aware_read on cash_movements for select to authenticated using(has_org_permission(organization_id,'pos.sales.read') and (finance_payment_id is null and payroll_payment_id is null or has_org_permission(organization_id,'finances.read')));
create policy movimientos_caja_alcance_sucursal on cash_movements as restrictive to authenticated using(user_has_branch_access(branch_id));
grant all on cash_movements to anon,authenticated;
grant all on after_sales_cases,customer_store_credits to authenticated;

-- Inventory schema and production trigger bodies: exercise the real aggregate path.
create table branch_inventory(branch_id uuid,product_id uuid,stock_quantity integer not null,reserved_quantity integer default 0,updated_at timestamptz,primary key(branch_id,product_id));
create table product_variants(id uuid primary key,organization_id uuid,product_id uuid,stock_quantity integer,updated_at timestamptz);
create table branch_variant_inventory(organization_id uuid,branch_id uuid,product_id uuid,variant_id uuid,stock_quantity integer,updated_at timestamptz,primary key(branch_id,variant_id));
create table variant_inventory_movements(id uuid primary key default gen_random_uuid(),organization_id uuid,branch_id uuid,product_id uuid,variant_id uuid,movement_type text,quantity_delta integer,stock_before integer,stock_after integer,idempotency_key text,reference_type text,reference_id uuid,reason text,actor_id uuid,metadata jsonb,unique(organization_id,idempotency_key));

CREATE OR REPLACE FUNCTION "public"."adjust_variant_stock_atomic"("p_organization_id" "uuid", "p_branch_id" "uuid", "p_variant_id" "uuid", "p_quantity_delta" integer, "p_movement_type" "text", "p_idempotency_key" "text", "p_actor_id" "uuid", "p_reference_type" "text" DEFAULT NULL::"text", "p_reference_id" "uuid" DEFAULT NULL::"uuid", "p_reason" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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

CREATE OR REPLACE FUNCTION "public"."refresh_product_stock_from_branch_inventory"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_product_id UUID;
BEGIN
  v_product_id := COALESCE(NEW.product_id, OLD.product_id);

  UPDATE public.products
  SET stock_quantity = COALESCE((
    SELECT SUM(bi.stock_quantity)
    FROM public.branch_inventory bi
    WHERE bi.product_id = v_product_id
  ), 0),
      updated_at = NOW()
  WHERE id = v_product_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION "public"."refresh_variant_product_stock"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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

CREATE OR REPLACE FUNCTION "public"."sync_product_total_stock"("p_product_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_total INTEGER;
  v_rows INTEGER;
BEGIN
  IF p_product_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(stock_quantity), 0), COUNT(*)
  INTO v_total, v_rows
  FROM public.branch_inventory
  WHERE product_id = p_product_id;

  -- Sin ninguna fila por sucursal, la columna global es el unico dato que hay:
  -- ponerla en cero borraria el stock de una instalacion de una sola sucursal
  -- que nunca inicializo `branch_inventory`.
  IF v_rows = 0 THEN
    RETURN;
  END IF;

  UPDATE public.products
  SET stock_quantity = v_total,
      updated_at = NOW()
  WHERE id = p_product_id
    AND stock_quantity IS DISTINCT FROM v_total;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."sync_product_total_stock_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_product_total_stock(OLD.product_id);
    RETURN OLD;
  END IF;

  PERFORM public.sync_product_total_stock(NEW.product_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."sync_default_branch_inventory_from_product_stock"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_active_branch_count INTEGER;
  v_default_branch_id UUID;
BEGIN
  SELECT COUNT(*)
  INTO v_active_branch_count
  FROM public.branches b
  WHERE b.organization_id = NEW.organization_id
    AND b.is_active = TRUE;

  IF v_active_branch_count <= 1 AND NEW.stock_quantity IS DISTINCT FROM OLD.stock_quantity THEN
    SELECT b.id
    INTO v_default_branch_id
    FROM public.branches b
    WHERE b.organization_id = NEW.organization_id
      AND b.is_active = TRUE
    ORDER BY b.is_default DESC, b.created_at ASC
    LIMIT 1;

    IF v_default_branch_id IS NOT NULL THEN
      INSERT INTO public.branch_inventory (branch_id, product_id, stock_quantity)
      VALUES (v_default_branch_id, NEW.id, COALESCE(NEW.stock_quantity, 0))
      ON CONFLICT (branch_id, product_id)
      DO UPDATE
      SET stock_quantity = EXCLUDED.stock_quantity,
          updated_at = NOW();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER "branch_variant_inventory_refresh_stock" AFTER INSERT OR DELETE OR UPDATE OF "stock_quantity" ON "public"."branch_variant_inventory" FOR EACH ROW EXECUTE FUNCTION "public"."refresh_variant_product_stock"();

CREATE OR REPLACE TRIGGER "trg_branch_inventory_refresh_product_stock" AFTER INSERT OR DELETE OR UPDATE ON "public"."branch_inventory" FOR EACH ROW EXECUTE FUNCTION "public"."refresh_product_stock_from_branch_inventory"();

CREATE OR REPLACE TRIGGER "trg_branch_inventory_sync_total" AFTER INSERT OR DELETE OR UPDATE OF "stock_quantity" ON "public"."branch_inventory" FOR EACH ROW EXECUTE FUNCTION "public"."sync_product_total_stock_trigger"();

CREATE OR REPLACE TRIGGER "trg_products_sync_default_branch_inventory" AFTER UPDATE OF "stock_quantity" ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."sync_default_branch_inventory_from_product_stock"();
