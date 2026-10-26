-- Make the shared home summary count low stock in active variants at the
-- authorized branch granularity. Simple-product semantics remain unchanged.
create or replace function public.dashboard_home_summary(
 p_organization_id uuid,
 p_branch_id uuid default null,
 p_modules text[] default array['orders','repairs','inventory','services']::text[]
) returns jsonb
language plpgsql stable security invoker
set search_path = pg_catalog, public
as $$
declare
 v_zone text; v_today date; v_start timestamptz; v_end timestamptz; v_week timestamptz;
 v_sales jsonb; v_customers jsonb;
 v_allowed_branches uuid[];
 v_catalog jsonb := '{"physicalCount":0,"servicesCount":0,"lowStockCount":0}';
 v_orders bigint := 0;
 v_repairs jsonb := '{"activeCount":0,"todayCount":0,"todayAmount":0,"deliveredCount":0,"deliveredAmount":0,"readyCount":0,"readyAmount":0}';
begin
 if auth.uid() is null then raise exception 'DASHBOARD_AUTH_REQUIRED' using errcode='42501'; end if;
 if p_organization_id is null or not exists(select 1 from public.organization_members where organization_id=p_organization_id and user_id=auth.uid() and status='active') then
  raise exception 'DASHBOARD_ORGANIZATION_FORBIDDEN' using errcode='42501';
 end if;
 select coalesce(array_agg(b.id),array[]::uuid[]) into v_allowed_branches
 from public.branches b where b.organization_id=p_organization_id and b.is_active
  and public.user_has_branch_access(b.id,auth.uid());
 if p_branch_id is not null and not (p_branch_id=any(v_allowed_branches)) then
  raise exception 'DASHBOARD_BRANCH_FORBIDDEN' using errcode='42501';
 end if;

 select timezone into v_zone from public.organization_settings where organization_id=p_organization_id limit 1;
 if v_zone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=v_zone) then v_zone := 'America/Asuncion'; end if;
 v_today := (now() at time zone v_zone)::date;
 v_start := v_today::timestamp at time zone v_zone;
 v_end := (v_today+1)::timestamp at time zone v_zone;
 v_week := (v_today-6)::timestamp at time zone v_zone;
 with daily as (
  select (s.created_at at time zone v_zone)::date day_key, sum(coalesce(s.total_amount,0)) amount, count(*) quantity
  from public.sales s where s.organization_id=p_organization_id and (p_branch_id is null or s.branch_id=p_branch_id)
   and (s.branch_id is null or s.branch_id=any(v_allowed_branches))
   and s.created_at>=v_week and s.created_at<v_end and lower(btrim(s.status::text)) in ('completed','completada')
  group by 1
 ), days as (select v_today-i day_key from generate_series(0,6) i)
 select jsonb_build_object('todayAmount',coalesce(max(d.amount) filter(where days.day_key=v_today),0),
  'todayCount',coalesce(max(d.quantity) filter(where days.day_key=v_today),0),
  'daily',jsonb_agg(coalesce(d.amount,0) order by days.day_key)) into v_sales from days left join daily d using(day_key);
 with daily as (
  select (c.created_at at time zone v_zone)::date day_key,count(*) quantity from public.customers c
   where c.organization_id=p_organization_id and c.created_at>=v_week and c.created_at<v_end group by 1
 ), days as (select v_today-i day_key from generate_series(0,6) i)
 select jsonb_build_object('newCount',coalesce(sum(d.quantity),0),'daily',jsonb_agg(coalesce(d.quantity,0) order by days.day_key))
 into v_customers from days left join daily d using(day_key);

 if p_modules && array['inventory','services']::text[] then
  with classified as (
   select p.id,p.stock_quantity,p.min_stock,p.has_variants,
    (lower(coalesce(p.unit_measure,''))='servicio'
      or (c.id is not null and lower(coalesce(c.name,'')) like '%servicio%')) service,
    exists(select 1 from public.product_variants any_variant where any_variant.product_id=p.id and any_variant.organization_id=p_organization_id) has_variant_rows
   from public.products p left join public.categories c on c.id=p.category_id and c.organization_id=p_organization_id and c.is_active
   where p.organization_id=p_organization_id and p.is_active
  ), variant_alerts as (
   select v.product_id,
    bool_or(case
      when p_branch_id is not null then coalesce(i.stock_quantity,0)<=coalesce(i.min_stock,v.min_stock,0)
      when i.variant_id is not null then coalesce(i.stock_quantity,0)<=coalesce(i.min_stock,v.min_stock,0)
      else coalesce(v.stock_quantity,0)<=coalesce(v.min_stock,0)
    end) affected
   from public.product_variants v
   left join public.branch_variant_inventory i
    on i.organization_id=v.organization_id and i.product_id=v.product_id and i.variant_id=v.id
    and ((p_branch_id is not null and i.branch_id=p_branch_id)
      or (p_branch_id is null and i.branch_id=any(v_allowed_branches)))
   where v.organization_id=p_organization_id and v.is_active
   group by v.product_id
  )
  select jsonb_build_object(
   'physicalCount',count(*) filter(where not c.service),
   'servicesCount',count(*) filter(where c.service),
   'lowStockCount',count(*) filter(where not c.service and case
     when c.has_variants or c.has_variant_rows then coalesce(a.affected,false)
     else coalesce(c.stock_quantity,0)<=coalesce(c.min_stock,5)
   end)) into v_catalog
  from classified c left join variant_alerts a on a.product_id=c.id;
 end if;
 if 'orders'=any(p_modules) then
  select count(*) into v_orders from public.customer_orders where organization_id=p_organization_id
   and (p_branch_id is null or branch_id=p_branch_id)
   and (branch_id is null or branch_id=any(v_allowed_branches)) and status::text in ('PENDING','CONFIRMED','PREPARING','READY','SHIPPED');
 end if;
 if 'repairs'=any(p_modules) then
  select jsonb_build_object(
   'activeCount',count(*) filter(where status::text in ('recibido','diagnostico','reparacion','pausado')),
   'todayCount',count(*) filter(where created_at>=v_start and created_at<v_end),
   'todayAmount',coalesce(sum(coalesce(final_cost,estimated_cost,0)) filter(where created_at>=v_start and created_at<v_end),0),
   'deliveredCount',count(*) filter(where status::text='entregado' and delivered_at>=v_start and delivered_at<v_end),
   'deliveredAmount',coalesce(sum(coalesce(final_cost,estimated_cost,paid_amount,0)) filter(where status::text='entregado' and delivered_at>=v_start and delivered_at<v_end),0),
   'readyCount',count(*) filter(where status::text='listo'),
   'readyAmount',coalesce(sum(coalesce(final_cost,estimated_cost,0)) filter(where status::text='listo'),0)) into v_repairs
  from public.repairs where organization_id=p_organization_id and (p_branch_id is null or branch_id=p_branch_id)
   and (branch_id is null or branch_id=any(v_allowed_branches));
 end if;
 return jsonb_build_object('version',1,'timeZone',v_zone,'today',v_today,'generatedAt',now(),
  'sales',v_sales,'customers',v_customers,'catalog',v_catalog,'orders',jsonb_build_object('activeCount',v_orders),'repairs',v_repairs);
end;
$$;
revoke all on function public.dashboard_home_summary(uuid,uuid,text[]) from public,anon;
grant execute on function public.dashboard_home_summary(uuid,uuid,text[]) to authenticated;
comment on function public.dashboard_home_summary(uuid,uuid,text[]) is 'Branch-aware low-stock summary for simple products and active variants; caller-scoped membership and branch checks remain enforced.';
