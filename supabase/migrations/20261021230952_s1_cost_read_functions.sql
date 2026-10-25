-- BORRADOR PARA REVISIÓN — NO EJECUTAR EN PRODUCCIÓN.
-- S1, Etapa 2a: lectura autorizada de costos por organización. Solo AGREGA y
-- reemplaza funciones/vistas manteniendo su contrato: no quita privilegios.
-- Se aplica ANTES de desplegar la web que usa get_product_costs y ANTES de 03.
-- Requiere 01 (has_product_cost_access). Reversión: rollback_02.sql.
--
-- Regla (igual a src/lib/products/cost-access.ts): ve costos el dueño o
-- administrador con membresía activa en esa organización, o quien tenga
-- `products.read_cost` concedido para esa organización. El rol global y los
-- permisos con organization_id NULL no cuentan.

begin;

-- ─── Permiso de lectura por organización ────────────────────────────────────
create or replace function public.can_read_product_cost(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.has_product_cost_access(p_organization_id, 'products.read_cost'), false);
$$;

revoke all on function public.can_read_product_cost(uuid) from public, anon;
grant execute on function public.can_read_product_cost(uuid) to authenticated, service_role;

-- ─── Costos de productos que el usuario puede ver ───────────────────────────
-- Única vía de lectura del costo para `authenticated` después de 03. Las
-- organizaciones se resuelven una vez (no por fila) y solo con membresía activa.
create or replace function public.get_product_costs(
  p_product_ids uuid[] default null,
  p_organization_id uuid default null
)
returns table (product_id uuid, organization_id uuid, purchase_price numeric, foreign_purchase_price numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org uuid := coalesce(p_organization_id, public.current_organization_id());
  v_selected uuid := nullif(nullif(current_setting('request.headers', true), '')::jsonb->>'x-organization-id', '')::uuid;
begin
  if auth.uid() is null or v_org is null or (v_selected is not null and v_selected <> v_org) then
    return;
  end if;
  if p_product_ids is null or cardinality(p_product_ids) > 2000 then
    raise exception 'Demasiados productos en una consulta de costos (máximo 2000)' using errcode = '22023';
  end if;
  return query
    with allowed as (
      select m.organization_id
      from public.organization_members m
      where m.user_id = auth.uid()
        and m.status = 'active'
        and m.organization_id = v_org
        and (
          m.role in ('owner', 'admin')
          or exists (
            select 1 from public.user_permissions up
            where up.user_id = m.user_id
              and up.organization_id = m.organization_id
              and up.is_active
              and up.permission = 'products.read_cost'
          )
        )
    )
    select p.id, p.organization_id, p.purchase_price::numeric, p.foreign_purchase_price::numeric
    from public.products p
    join allowed a on a.organization_id = p.organization_id
    where p_product_ids is null or p.id = any(p_product_ids);
end;
$$;

revoke all on function public.get_product_costs(uuid[], uuid) from public, anon;
grant execute on function public.get_product_costs(uuid[], uuid) to authenticated, service_role;

create or replace function public.get_variant_costs(
  p_variant_ids uuid[] default null,
  p_organization_id uuid default null
)
returns table (variant_id uuid, product_id uuid, organization_id uuid, purchase_price numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org uuid := coalesce(p_organization_id, public.current_organization_id());
  v_selected uuid := nullif(nullif(current_setting('request.headers', true), '')::jsonb->>'x-organization-id', '')::uuid;
begin
  if auth.uid() is null or v_org is null or (v_selected is not null and v_selected <> v_org) then
    return;
  end if;
  if p_variant_ids is null or cardinality(p_variant_ids) > 2000 then
    raise exception 'Demasiadas variantes en una consulta de costos (máximo 2000)' using errcode = '22023';
  end if;
  return query
    with allowed as (
      select m.organization_id
      from public.organization_members m
      where m.user_id = auth.uid()
        and m.status = 'active'
        and m.organization_id = v_org
        and (
          m.role in ('owner', 'admin')
          or exists (
            select 1 from public.user_permissions up
            where up.user_id = m.user_id
              and up.organization_id = m.organization_id
              and up.is_active
              and up.permission = 'products.read_cost'
          )
        )
    )
    select v.id, v.product_id, v.organization_id, v.purchase_price::numeric
    from public.product_variants v
    join allowed a on a.organization_id = v.organization_id
    where p_variant_ids is null or v.id = any(p_variant_ids);
end;
$$;

revoke all on function public.get_variant_costs(uuid[], uuid) from public, anon;
grant execute on function public.get_variant_costs(uuid[], uuid) to authenticated, service_role;

-- ─── Reemplazo de app_can_view_cost() (era global) ──────────────────────────
-- La versión sin argumentos se conserva por compatibilidad, pero ahora solo
-- responde por la organización activa del pedido (x-organization-id o la única
-- membresía) y falla cerrada si no se puede determinar.
create or replace function public.app_can_view_cost(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_read_product_cost(p_organization_id);
$$;

revoke all on function public.app_can_view_cost(uuid) from public, anon;
grant execute on function public.app_can_view_cost(uuid) to authenticated, service_role;

create or replace function public.app_can_view_cost()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.can_read_product_cost(public.current_organization_id()), false);
$$;

revoke all on function public.app_can_view_cost() from public, anon;
grant execute on function public.app_can_view_cost() to authenticated, service_role;

-- ─── Vistas: mismo contrato, costo solo con permiso ─────────────────────────
-- Siguen siendo security_invoker (RLS de products aplica) y ya no leen
-- products.purchase_price: el costo viene de get_product_costs().
create or replace view public.products_safe with (security_invoker = true) as
 select p.id,
    p.sku,
    p.name,
    p.description,
    p.category_id,
    p.brand,
    p.supplier_id,
    pc.purchase_price as purchase_price,
    p.sale_price,
    p.wholesale_price,
    p.offer_price,
    p.has_offer,
    p.stock_quantity,
    p.min_stock,
    p.max_stock,
    p.unit_measure,
    p.barcode,
    p.images,
    p.image_url,
    p.weight,
    p.dimensions,
    p.location,
    p.tags,
    p.is_active,
    p.featured,
    p.created_at,
    p.updated_at,
    p.brand_id,
    p.visibility,
    p.warranty_months,
    p.warranty_info,
    p.return_window_days,
    p.exchange_window_days,
    p.return_policy,
    p.exchange_policy,
    p.stock_status_computed,
    p.organization_id
   from public.products p
     left join lateral public.get_product_costs(array[p.id], p.organization_id) pc on pc.product_id = p.id;

create or replace view public.products_detailed with (security_invoker = on) as
 select p.id,
    p.sku,
    p.name,
    p.description,
    p.category_id,
    p.brand,
    p.supplier_id,
    pc.purchase_price::numeric(10,2) as purchase_price,
    p.sale_price,
    p.wholesale_price,
    p.offer_price,
    p.has_offer,
    p.stock_quantity,
    p.min_stock,
    p.max_stock,
    p.unit_measure,
    p.barcode,
    p.images,
    p.image_url,
    p.weight,
    p.dimensions,
    p.location,
    p.tags,
    p.is_active,
    p.featured,
    p.created_at,
    p.updated_at,
    c.name as category_name,
    null::text as category_color,
    null::text as category_icon,
    s.name as supplier_name,
    s.contact_name as supplier_contact,
    s.email as supplier_email,
    s.phone as supplier_phone,
        case
            when pc.purchase_price is null then null::numeric
            when pc.purchase_price > 0::numeric then round((p.sale_price - pc.purchase_price) / pc.purchase_price * 100::numeric, 2)
            else 0::numeric
        end as profit_margin_percentage,
    p.stock_quantity::numeric * pc.purchase_price::numeric(10,2) as total_stock_value,
        case
            when p.stock_quantity = 0 then 'out_of_stock'::text
            when p.stock_quantity <= p.min_stock then 'low_stock'::text
            else 'normal'::text
        end as stock_status,
    ( select count(*) as count
           from public.product_alerts pa
          where pa.product_id = p.id and pa.is_resolved = false) as active_alerts_count
   from public.products p
     left join public.categories c on p.category_id = c.id
     left join public.suppliers s on p.supplier_id = s.id
     left join lateral public.get_product_costs(array[p.id], p.organization_id) pc on pc.product_id = p.id;

create or replace view public.products_full with (security_invoker = on) as
 select p.id,
    p.sku,
    p.name,
    p.description,
    p.category_id,
    p.brand,
    p.supplier_id,
    pc.purchase_price::numeric(10,2) as purchase_price,
    p.sale_price,
    p.wholesale_price,
    p.offer_price,
    p.has_offer,
    p.stock_quantity,
    p.min_stock,
    p.max_stock,
    p.unit_measure,
    p.barcode,
    p.images,
    p.image_url,
    p.weight,
    p.dimensions,
    p.location,
    p.tags,
    p.is_active,
    p.featured,
    p.created_at,
    p.updated_at,
    c.name as category_name,
    s.name as supplier_name,
        case
            when p.stock_quantity = 0 then 'out_of_stock'::text
            when p.stock_quantity <= p.min_stock then 'low_stock'::text
            else 'in_stock'::text
        end as stock_status,
    p.sale_price - pc.purchase_price::numeric(10,2) as margin,
        case
            when pc.purchase_price is null then null::numeric
            when pc.purchase_price > 0::numeric then round((p.sale_price - pc.purchase_price) / p.sale_price * 100::numeric, 2)
            else 0::numeric
        end as margin_percentage,
    p.stock_quantity::numeric * p.sale_price as total_value
   from public.products p
     left join public.categories c on p.category_id = c.id
     left join public.suppliers s on p.supplier_id = s.id
     left join lateral public.get_product_costs(array[p.id], p.organization_id) pc on pc.product_id = p.id;

-- En los agregados, las cifras de costo se informan solo si el usuario puede
-- ver el costo de TODAS las filas que la RLS le muestra; si no, NULL.
create or replace view public.product_stats with (security_invoker = on) as
 select count(*) as total_products,
    count(*) filter (where p.is_active = true) as active_products,
    sum(p.stock_quantity::numeric * p.sale_price) as total_stock_value,
    case when bool_and(pc.product_id is not null) then sum(p.stock_quantity::numeric * pc.purchase_price) end as total_cost_value,
    case when bool_and(pc.product_id is not null) then sum(p.stock_quantity::numeric * (p.sale_price - pc.purchase_price)) end as total_margin,
    count(*) filter (where p.stock_quantity <= p.min_stock and p.stock_quantity > 0) as low_stock_count,
    count(*) filter (where p.stock_quantity = 0) as out_of_stock_count
   from public.products p
     left join lateral public.get_product_costs(array[p.id], p.organization_id) pc on pc.product_id = p.id;

create or replace view public.products_dashboard_stats with (security_invoker = on) as
 select count(*) as total_products,
    count(*) filter (where p.is_active = true) as active_products,
    count(*) filter (where p.is_active = false) as inactive_products,
    sum(p.stock_quantity) as total_stock,
    case when bool_and(pc.product_id is not null) then sum(p.stock_quantity::numeric * pc.purchase_price) end as total_inventory_value,
    count(*) filter (where p.stock_quantity = 0) as out_of_stock_count,
    count(*) filter (where p.stock_quantity <= p.min_stock and p.stock_quantity > 0) as low_stock_count,
    count(*) filter (where p.supplier_id is null) as no_supplier_count,
    count(*) filter (where p.category_id is null) as no_category_count,
    count(*) filter (where p.images is null or array_length(p.images, 1) is null) as no_image_count,
    round(avg(p.sale_price), 2) as avg_sale_price,
    case when bool_and(pc.product_id is not null) then round(avg(pc.purchase_price), 2) end as avg_purchase_price,
    case when bool_and(pc.product_id is not null) then round(avg(
        case
            when pc.purchase_price > 0::numeric then (p.sale_price - pc.purchase_price) / pc.purchase_price * 100::numeric
            else 0::numeric
        end), 2) end as avg_profit_margin
   from public.products p
     left join lateral public.get_product_costs(array[p.id], p.organization_id) pc on pc.product_id = p.id;

-- Nadie anónimo tiene filas en estas vistas (la RLS exige membresía).
revoke select on public.products_safe, public.products_detailed, public.products_full,
  public.product_stats, public.products_dashboard_stats from anon;

-- ─── RPC: mismo contrato; costo, margen y valor en NULL sin permiso ─────────
create or replace function public.search_products(
  search_term text default ''::text, category_filter uuid default null::uuid, supplier_filter uuid default null::uuid,
  status_filter character varying default null::character varying, stock_filter character varying default null::character varying,
  limit_count integer default 50, offset_count integer default 0)
 returns table(id uuid, sku character varying, name character varying, description text, category_name character varying, category_color character varying, brand character varying, supplier_name character varying, purchase_price numeric, sale_price numeric, wholesale_price numeric, stock integer, min_stock integer, status character varying, stock_status character varying, profit_margin numeric, total_value numeric, active_alerts integer, created_at timestamp with time zone)
 language plpgsql
 set search_path to 'public'
as $function$
begin
    return query
    select
        p.id,
        p.sku,
        p.name,
        p.description,
        c.name as category_name,
        null::character varying as category_color,
        p.brand,
        s.name as supplier_name,
        pc.purchase_price,
        p.sale_price,
        p.wholesale_price,
        p.stock_quantity,
        p.min_stock,
        (case when p.is_active then 'active' else 'inactive' end)::character varying as status,
        (case
            when p.stock_quantity = 0 then 'out_of_stock'
            when p.stock_quantity <= p.min_stock then 'low_stock'
            else 'normal'
        end)::character varying as stock_status,
        case
            when pc.purchase_price is null then null::numeric
            when pc.purchase_price > 0 then
                round(((p.sale_price - pc.purchase_price) / pc.purchase_price * 100)::numeric, 2)
            else 0
        end as profit_margin,
        (p.stock_quantity * pc.purchase_price) as total_value,
        (select count(*)::integer from product_alerts pa where pa.product_id = p.id and pa.is_resolved = false) as active_alerts,
        p.created_at
    from products p
    left join categories c on p.category_id = c.id
    left join suppliers s on p.supplier_id = s.id
    left join lateral public.get_product_costs(array[p.id], p.organization_id) pc on pc.product_id = p.id
    where
        (search_term = '' or
         p.name ilike '%' || search_term || '%' or
         p.sku ilike '%' || search_term || '%' or
         p.brand ilike '%' || search_term || '%' or
         p.description ilike '%' || search_term || '%')
        and (category_filter is null or p.category_id = category_filter)
        and (supplier_filter is null or p.supplier_id = supplier_filter)
        and (status_filter is null or (status_filter = 'active' and p.is_active = true) or (status_filter = 'inactive' and p.is_active = false))
        and (stock_filter is null or
             (stock_filter = 'low' and p.stock_quantity <= p.min_stock) or
             (stock_filter = 'out' and p.stock_quantity = 0) or
             (stock_filter = 'normal' and p.stock_quantity > p.min_stock))
    order by
        case when p.stock_quantity = 0 then 0 else 1 end,
        case when p.stock_quantity <= p.min_stock then 0 else 1 end,
        p.name
    limit limit_count
    offset offset_count;
end;
$function$;

create or replace function public.generate_inventory_report(start_date date default null::date, end_date date default null::date, category_filter uuid default null::uuid)
 returns table(product_id uuid, sku character varying, product_name character varying, category_name character varying, current_stock integer, stock_value numeric, entries integer, exits integer, net_movement integer, turnover_rate numeric)
 language plpgsql
 set search_path to 'public'
as $function$
begin return query
select p.id,p.sku,p.name,c.name,p.stock_quantity,p.stock_quantity*pc.purchase_price,
 coalesce(sum(pm.quantity) filter(where pm.movement_type in('entry','adjustment') and pm.quantity>0),0)::integer,
 coalesce(sum(pm.quantity) filter(where pm.movement_type in('exit','sale') and pm.quantity>0),0)::integer,
 coalesce(sum(case when pm.movement_type in('entry','adjustment') and pm.quantity>0 then pm.quantity when pm.movement_type in('exit','sale') and pm.quantity>0 then -pm.quantity else 0 end),0)::integer,
 case when p.stock_quantity>0 then round(coalesce(sum(pm.quantity) filter(where pm.movement_type in('exit','sale')),0)/p.stock_quantity::numeric,2) else 0::numeric end
from public.products p left join public.categories c on c.id=p.category_id
left join lateral public.get_product_costs(array[p.id], p.organization_id) pc on pc.product_id=p.id
left join public.product_movements pm on pm.product_id=p.id and(start_date is null or pm.created_at>=start_date) and(end_date is null or pm.created_at<end_date+1)
where p.is_active=true and(category_filter is null or p.category_id=category_filter)
group by p.id,p.sku,p.name,c.name,p.stock_quantity,pc.purchase_price
order by(p.stock_quantity*pc.purchase_price) desc nulls last, p.name; end; $function$;

create or replace function public.get_category_stats()
 returns table(category_id uuid, category_name text, product_count bigint, total_stock_value numeric, avg_margin_percentage numeric)
 language sql
 stable
 set search_path to 'public'
as $function$
  select
    c.id                                                           as category_id,
    c.name                                                         as category_name,
    count(p.id)                                                    as product_count,
    coalesce(sum(p.sale_price * p.stock_quantity), 0)             as total_stock_value,
    case when bool_and(p.id is null or pc.product_id is not null) then coalesce(
      avg(
        case
          when pc.purchase_price > 0
          then ((p.sale_price - pc.purchase_price) / pc.purchase_price) * 100
          else 0
        end
      ), 0
    ) end                                                          as avg_margin_percentage
  from public.categories c
  left join public.products p on p.category_id = c.id and p.is_active = true
  left join lateral public.get_product_costs(array[p.id], p.organization_id) pc on pc.product_id = p.id
  group by c.id, c.name
  order by c.name;
$function$;

-- anon no tiene filas: la ejecución queda solo para usuarios autenticados.
revoke execute on function public.search_products(text, uuid, uuid, character varying, character varying, integer, integer) from public, anon;
revoke execute on function public.generate_inventory_report(date, date, uuid) from public, anon;
revoke execute on function public.get_category_stats() from public, anon;
grant execute on function public.search_products(text, uuid, uuid, character varying, character varying, integer, integer) to authenticated, service_role;
grant execute on function public.generate_inventory_report(date, date, uuid) to authenticated, service_role;
grant execute on function public.get_category_stats() to authenticated, service_role;

-- dashboard_pos_summary: idéntica salvo el costo. Sin products.read_cost en la
-- organización devuelve costHidden=true y NULL en costo de mercadería, ítems sin
-- costo, costo de repuestos y ganancia neta del taller.
create or replace function public.dashboard_pos_summary_s1(p_organization_id uuid, p_branch_id uuid, p_from timestamp with time zone, p_to timestamp with time zone, p_timezone text default 'America/Asuncion'::text)
 returns jsonb
 language plpgsql
 stable
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_cost_visible boolean;
begin
  if auth.uid() is null
    or (nullif(nullif(current_setting('request.headers', true), '')::jsonb->>'x-organization-id','') is not null
        and public.current_organization_id() is distinct from p_organization_id)
    or not public.has_org_permission(p_organization_id, 'analytics.read') then
    raise exception 'No tiene permiso para consultar este resumen' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_from > p_to or not isfinite(p_from) or not isfinite(p_to) or p_to - p_from > interval '20 years' then
    raise exception 'Período inválido (máximo 20 años)' using errcode = '22023';
  end if;
  if p_timezone is null or not exists(select 1 from pg_timezone_names where name=p_timezone) then
    raise exception 'Zona horaria inválida' using errcode='22023';
  end if;
  if p_branch_id is not null and (not exists(select 1 from public.branches b where b.id=p_branch_id and b.organization_id=p_organization_id and b.is_active)
    or not public.user_has_branch_access(p_branch_id,auth.uid())) then
    raise exception 'Sucursal no disponible para este usuario' using errcode='42501';
  end if;
  v_cost_visible := public.can_read_product_cost(p_organization_id);
  return (
    with accessible_branches as materialized (
      select b.id from public.branches b
      where b.organization_id=p_organization_id and b.is_active and public.user_has_branch_access(b.id,auth.uid())
    ), period_sales as materialized (
      select s.* from public.sales s
      where s.organization_id = p_organization_id and (p_branch_id is null or s.branch_id = p_branch_id)
        and (s.branch_id is null or exists(select 1 from accessible_branches ab where ab.id=s.branch_id))
        and (s.status is null or s.status::text in ('completed','completada'))
        and s.created_at >= p_from and s.created_at <= p_to
    ), product_costs as materialized (
      select pc.product_id, pc.purchase_price from public.products p
      cross join lateral public.get_product_costs(array[p.id], p_organization_id) pc
      where p.organization_id = p_organization_id and v_cost_visible
    ), items as materialized (
      select i.quantity, i.subtotal, p.name, pc.purchase_price
      from public.sale_items i join period_sales s on s.id = i.sale_id
      left join public.products p on p.id = i.product_id and p.organization_id = p_organization_id
      left join product_costs pc on pc.product_id = p.id
    ), sales_summary as (
      select coalesce(sum(s.total_amount),0) gross, coalesce(sum(coalesce(s.subtotal_amount,s.total_amount)),0) net,
        count(*) transactions from period_sales s
    ), cost_summary as (
      select coalesce(sum(coalesce(purchase_price,0)*coalesce(quantity,0)),0) cost,
        count(*) filter(where purchase_price is null) missing from items
    ), credit_rows as (
      select c.*,
        case when i.n > 0 then i.debt else coalesce(c.principal,0) end debt,
        case when i.n > 0 then i.debt-i.paid when c.status::text in ('paid','cancelled') then 0 else coalesce(c.principal,0) end pending
      from public.customer_credits c left join lateral (
        select count(*) n,coalesce(sum(amount),0) debt,coalesce(sum(amount_paid),0) paid
        from public.credit_installments ci where ci.credit_id = c.id
      )i on true
      where c.organization_id=p_organization_id and (p_branch_id is null or c.branch_id=p_branch_id)
        and (c.branch_id is null or exists(select 1 from accessible_branches ab where ab.id=c.branch_id))
        and c.created_at >= p_from and c.created_at <= p_to
    ), repair_rows as materialized (
      select r.* from public.repairs r where r.organization_id=p_organization_id and (p_branch_id is null or r.branch_id=p_branch_id)
        and (r.branch_id is null or exists(select 1 from accessible_branches ab where ab.id=r.branch_id))
        and ((r.created_at>=p_from and r.created_at<=p_to) or (r.delivered_at>=p_from and r.delivered_at<=p_to and r.status::text='entregado')
          or r.status::text in ('listo','recibido','diagnostico','reparacion','pausado'))
    ), refunds as (
      select a.source_type,coalesce(a.refund_amount,0) amount from public.after_sales_cases a
      where a.organization_id=p_organization_id and a.status::text in ('completed','completado')
        and a.resolved_at >= p_from and a.resolved_at <= p_to
        and (exists(select 1 from public.sales s where s.id=a.sale_id and s.organization_id=p_organization_id and (p_branch_id is null or s.branch_id=p_branch_id) and (s.branch_id is null or exists(select 1 from accessible_branches ab where ab.id=s.branch_id)))
          or exists(select 1 from public.repairs r where r.id=a.repair_id and r.organization_id=p_organization_id and (p_branch_id is null or r.branch_id=p_branch_id) and (r.branch_id is null or exists(select 1 from accessible_branches ab where ab.id=r.branch_id))))
    ), refund_summary as (
      select coalesce(sum(amount) filter(where source_type::text in ('sale','venta','product','sale_item')),0) sales,
        coalesce(sum(amount) filter(where source_type::text in ('repair','reparacion')),0) repairs from refunds
    ), repair_summary as (
      select
        coalesce(sum(coalesce(final_cost,estimated_cost,0)) filter(where created_at >= p_from and created_at <= p_to),0) created_amount,
        coalesce(sum(coalesce(final_cost,estimated_cost,paid_amount,0)) filter(where status::text='entregado' and delivered_at >= p_from and delivered_at <= p_to),0) delivered_amount,
        count(*) filter(where status::text='entregado' and delivered_at >= p_from and delivered_at <= p_to) delivered_count,
        coalesce(sum(coalesce(parts_cost,0)) filter(where status::text='entregado' and delivered_at >= p_from and delivered_at <= p_to),0) parts,
        coalesce(sum(coalesce(labor_cost,0)) filter(where status::text='entregado' and delivered_at >= p_from and delivered_at <= p_to),0) labor,
        coalesce(sum(coalesce(final_cost,estimated_cost,0)) filter(where status::text='listo'),0) ready_amount,
        count(*) filter(where status::text='listo') ready_count,
        count(*) filter(where status::text in ('recibido','diagnostico','reparacion','pausado')) active_count
      from repair_rows
    ), top_products as (
      select coalesce(name,'Producto eliminado') name,sum(coalesce(quantity,0)) sales,sum(coalesce(subtotal,0)) revenue
      from items group by coalesce(name,'Producto eliminado') order by sales desc,name limit 5
    ), methods as (
      select case when payment_method in ('cash','efectivo') then 'Efectivo' when payment_method in ('card','tarjeta') then 'Tarjeta'
        when payment_method='credit' then 'Credito' when payment_method in ('transfer','transferencia') then 'Transferencia'
        when payment_method is null or payment_method='' then 'Otros' else upper(left(payment_method,1))||substr(payment_method,2) end name,
        sum(coalesce(total_amount,0)) value from period_sales group by 1
    ), days as (
      select bucket::date as bucket_day from generate_series(date_trunc('day',p_from at time zone p_timezone),date_trunc('day',p_to at time zone p_timezone),interval '1 day') as series(bucket)
    ), daily as (
      select d.bucket_day,coalesce(sum(s.total_amount),0) sales,count(s.id) transactions from days d
      left join period_sales s on (s.created_at at time zone p_timezone)::date=d.bucket_day group by d.bucket_day order by d.bucket_day
    ), recent as (
      select s.id,s.created_at,s.total_amount total,s.payment_method,
        jsonb_build_object('name',c.name) customer,c.name customer_name,
        coalesce((select sum(i.quantity) from public.sale_items i where i.sale_id=s.id),0) items_count
      from (select * from period_sales order by created_at desc,id desc limit 10)s
      left join public.customers c on c.id=s.customer_id
    )
    select jsonb_build_object(
      'totalSales',s.gross,'netSales',s.net,'totalTransactions',s.transactions,
      'averageTicket',case when s.transactions>0 then s.gross/s.transactions else 0 end,
      'costHidden',not v_cost_visible,
      'totalCost',case when v_cost_visible and c.missing = 0 then c.cost end,
      'itemsWithoutCost',case when v_cost_visible then c.missing end,
      'dailySales',coalesce((select jsonb_agg(to_jsonb(daily) order by daily.bucket_day) from daily),'[]'::jsonb),
      'topProducts',coalesce((select jsonb_agg(to_jsonb(top_products) order by top_products.sales desc,top_products.name) from top_products),'[]'::jsonb),
      'paymentMethods',coalesce((select jsonb_agg(to_jsonb(methods) order by methods.name) from methods),'[]'::jsonb),
      'recentSales',coalesce((select jsonb_agg(to_jsonb(recent) order by recent.created_at desc,recent.id desc) from recent),'[]'::jsonb),
      'creditStats',(select jsonb_build_object('totalAmount',coalesce(sum(debt),0),'count',count(*),'averageTicket',coalesce(avg(debt),0),'pendingAmount',coalesce(sum(pending) filter(where status::text in ('active','defaulted')),0)) from credit_rows where origin_type::text='sale' or origin_type is null),
      'repairCreditStats',(select jsonb_build_object('totalAmount',coalesce(sum(debt),0),'count',count(*),'pendingAmount',coalesce(sum(pending) filter(where status::text in ('active','defaulted')),0)) from credit_rows where origin_type::text='repair'),
      'repairStats',jsonb_build_object('totalAmount',r.created_amount,'deliveredAmount',r.delivered_amount,'deliveredCount',r.delivered_count,'readyAmount',r.ready_amount,'readyCount',r.ready_count,'activeCount',r.active_count,
        'deliveredPartsCost',case when v_cost_visible then r.parts end,'deliveredLaborCost',case when v_cost_visible then r.labor end,
        'netProfit',case when v_cost_visible then r.delivered_amount-r.parts-f.repairs end,'refundsAmount',f.repairs),
      'refunds',jsonb_build_object('totalAmount',f.sales+f.repairs,'salesAmount',f.sales,'repairsAmount',f.repairs)
    ) from sales_summary s cross join cost_summary c cross join repair_summary r cross join refund_summary f
  );
end;
$function$;

revoke all on function public.dashboard_pos_summary_s1(uuid,uuid,timestamptz,timestamptz,text) from public, anon;
grant execute on function public.dashboard_pos_summary_s1(uuid,uuid,timestamptz,timestamptz,text) to authenticated, service_role;

commit;
