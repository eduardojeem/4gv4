-- Read-only aggregate: caller privileges and RLS remain in force for every source.
create or replace function public.dashboard_pos_summary(
  p_organization_id uuid, p_branch_id uuid, p_from timestamptz, p_to timestamptz,
  p_timezone text default 'America/Asuncion'
) returns jsonb language plpgsql stable security invoker set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not public.has_org_permission(p_organization_id, 'analytics.read') then
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
    ), items as materialized (
      select i.quantity, i.subtotal, p.name, p.purchase_price
      from public.sale_items i join period_sales s on s.id = i.sale_id
      left join public.products p on p.id = i.product_id and p.organization_id = p_organization_id
    ), sales_summary as (
      select coalesce(sum(s.total_amount),0) gross, coalesce(sum(coalesce(s.subtotal_amount,s.total_amount)),0) net,
        count(*) transactions from period_sales s
    ), cost_summary as (
      select coalesce(sum(coalesce(purchase_price,0)*coalesce(quantity,0)),0) cost,
        count(*) filter(where purchase_price is null or purchase_price <= 0) missing from items
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
      'totalCost',c.cost,'itemsWithoutCost',c.missing,
      'dailySales',coalesce((select jsonb_agg(to_jsonb(daily) order by daily.bucket_day) from daily),'[]'::jsonb),
      'topProducts',coalesce((select jsonb_agg(to_jsonb(top_products) order by top_products.sales desc,top_products.name) from top_products),'[]'::jsonb),
      'paymentMethods',coalesce((select jsonb_agg(to_jsonb(methods) order by methods.name) from methods),'[]'::jsonb),
      'recentSales',coalesce((select jsonb_agg(to_jsonb(recent) order by recent.created_at desc,recent.id desc) from recent),'[]'::jsonb),
      'creditStats',(select jsonb_build_object('totalAmount',coalesce(sum(debt),0),'count',count(*),'averageTicket',coalesce(avg(debt),0),'pendingAmount',coalesce(sum(pending) filter(where status::text in ('active','defaulted')),0)) from credit_rows where origin_type::text='sale' or origin_type is null),
      'repairCreditStats',(select jsonb_build_object('totalAmount',coalesce(sum(debt),0),'count',count(*),'pendingAmount',coalesce(sum(pending) filter(where status::text in ('active','defaulted')),0)) from credit_rows where origin_type::text='repair'),
      'repairStats',jsonb_build_object('totalAmount',r.created_amount,'deliveredAmount',r.delivered_amount,'deliveredCount',r.delivered_count,'readyAmount',r.ready_amount,'readyCount',r.ready_count,'activeCount',r.active_count,'deliveredPartsCost',r.parts,'deliveredLaborCost',r.labor,'netProfit',r.delivered_amount-r.parts-f.repairs,'refundsAmount',f.repairs),
      'refunds',jsonb_build_object('totalAmount',f.sales+f.repairs,'salesAmount',f.sales,'repairsAmount',f.repairs)
    ) from sales_summary s cross join cost_summary c cross join repair_summary r cross join refund_summary f
  );
end;
$$;
revoke all on function public.dashboard_pos_summary(uuid,uuid,timestamptz,timestamptz,text) from public,anon;
grant execute on function public.dashboard_pos_summary(uuid,uuid,timestamptz,timestamptz,text) to authenticated;
