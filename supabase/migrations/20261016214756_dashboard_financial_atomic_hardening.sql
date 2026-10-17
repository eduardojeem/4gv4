-- Prepare locally; apply deliberately after review. No historical amounts are changed.
begin;

create table public.after_sales_resolution_requests (
  organization_id uuid not null references public.organizations(id),
  case_id uuid not null references public.after_sales_cases(id),
  action text not null,
  request jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(organization_id,case_id,action)
);
alter table public.after_sales_resolution_requests enable row level security;
revoke all on public.after_sales_resolution_requests from public,anon,authenticated;
grant select,insert on public.after_sales_resolution_requests to service_role;

-- Internal stock write: explicit tenant, branch, actor and case reference.
create or replace function public.after_sales_stock_change(
  p_org uuid,p_branch uuid,p_actor uuid,p_product uuid,p_delta integer,p_case uuid,p_label text,p_variant uuid default null
) returns void language plpgsql security invoker set search_path=pg_catalog,public,auth as $$
declare old_stock integer; global_stock integer; uses_variants boolean;
begin
  if p_product is null or p_delta is null or p_delta=0 then raise exception 'AFTER_SALES_INVALID_PRODUCT'; end if;
  if not (public.has_org_permission(p_org,'inventory.stock.manage')
    or public.has_org_permission(p_org,'inventory.products.update'))
    or not public.user_has_branch_access(p_branch,p_actor)
    or not exists(select 1 from public.branches b where b.id=p_branch and b.organization_id=p_org and b.is_active)
    then raise exception 'AFTER_SALES_FORBIDDEN'; end if;
  select p.stock_quantity,coalesce(p.has_variants,false) into global_stock,uses_variants
    from public.products p where p.id=p_product and p.organization_id=p_org for update;
  if not found then raise exception 'AFTER_SALES_INVALID_PRODUCT'; end if;
  if uses_variants then
    -- A replacement variant is not selectable in the current case contract.
    -- Reject the dispatch instead of decrementing the parent product's stock.
    if p_variant is null then raise exception 'AFTER_SALES_VARIANT_REQUIRED'; end if;
    if not exists(select 1 from public.product_variants v where v.id=p_variant and v.product_id=p_product and v.organization_id=p_org)
      then raise exception 'AFTER_SALES_INVALID_PRODUCT'; end if;
    begin
      perform public.adjust_variant_stock_atomic(p_org,p_branch,p_variant,p_delta,
        case when p_delta>0 then 'return' else 'sale' end,
        'after-sales:'||p_case::text||case when p_delta>0 then ':restock:' else ':replacement:' end||p_variant::text,
        p_actor,'after_sales',p_case,p_label,jsonb_build_object('case_id',p_case));
    exception
      when raise_exception then
        if sqlerrm like 'VARIANT_STOCK_INSUFFICIENT%' then raise exception 'AFTER_SALES_INSUFFICIENT_STOCK'; end if;
        if sqlerrm like 'VARIANT_BRANCH_FORBIDDEN%' then raise exception 'AFTER_SALES_INVALID_PRODUCT'; end if;
        raise;
    end;
    return;
  end if;
  if p_variant is not null then raise exception 'AFTER_SALES_INVALID_PRODUCT'; end if;
  select bi.stock_quantity into old_stock from public.branch_inventory bi
    where bi.branch_id=p_branch and bi.product_id=p_product for update;
  if not found then
    -- Legacy single-branch products may not have initialized branch inventory.
    -- Never borrow another branch's global balance for a multi-branch dispatch.
    old_stock:=case when (select count(*) from public.branches b where b.organization_id=p_org and b.is_active)=1
      and not exists(select 1 from public.branch_inventory bi where bi.product_id=p_product)
      then coalesce(global_stock,0) else 0 end;
  end if;
  if old_stock+p_delta<0 then raise exception 'AFTER_SALES_INSUFFICIENT_STOCK'; end if;
  -- Branch inventory is canonical. Its existing production triggers refresh the
  -- product aggregate; writing products too would apply the delta twice.
  insert into public.branch_inventory(branch_id,product_id,stock_quantity,reserved_quantity)
    values(p_branch,p_product,old_stock+p_delta,0)
    on conflict(branch_id,product_id) do update set stock_quantity=excluded.stock_quantity,updated_at=now();
  insert into public.product_movements(product_id,movement_type,quantity,previous_stock,new_stock,
    reference_type,reference_id,notes,user_id,organization_id,branch_id)
  values(p_product,case when p_delta>0 then 'entry' else 'exit' end,abs(p_delta),old_stock,old_stock+p_delta,
    'after_sales',p_case,p_label,p_actor,p_org,p_branch);
end $$;
revoke all on function public.after_sales_stock_change(uuid,uuid,uuid,uuid,integer,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.after_sales_stock_change(uuid,uuid,uuid,uuid,integer,uuid,text,uuid) to service_role;

create or replace function public.server_resolve_after_sales_case_atomic(
  p_actor_user_id uuid,p_organization_id uuid,p_case_id uuid,p_input jsonb
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare
  c public.after_sales_cases%rowtype;
  parent public.repairs%rowtype;
  created_repair public.repairs%rowtype;
  item public.sale_items%rowtype;
  sale public.sales%rowtype;
  stored public.after_sales_resolution_requests%rowtype;
  current_status text; target text; stored_status text; action_key text; identity jsonb;
  kind text; note text; prefix text; branch uuid; cash_session uuid;
  refund numeric; method text; restock text; cap numeric; line_total numeric; prior_units numeric; prior_refunds numeric;
  outcome jsonb:='{}'::jsonb; result jsonb; coverage text; reversed jsonb;
begin
  perform public.assert_service_cash_actor(p_actor_user_id);
  if jsonb_typeof(p_input) is distinct from 'object'
    or not public.has_org_permission(p_organization_id,'crm.customers.manage') then raise exception 'AFTER_SALES_FORBIDDEN'; end if;
  select * into c from public.after_sales_cases where id=p_case_id and organization_id=p_organization_id for update;
  if not found then raise exception 'AFTER_SALES_NOT_FOUND'; end if;

  -- Validate references and branch before consulting any persisted result.
  if c.sale_id is not null then
    select * into sale from public.sales where id=c.sale_id and organization_id=p_organization_id for update;
    if not found or coalesce(sale.status,'') not in ('completed','completada') then raise exception 'AFTER_SALES_INVALID_SOURCE'; end if;
    branch:=sale.branch_id;
  elsif c.repair_id is not null then
    select * into parent from public.repairs where id=c.repair_id and organization_id=p_organization_id for update;
    if not found then raise exception 'AFTER_SALES_INVALID_SOURCE'; end if;
    branch:=parent.branch_id;
  else raise exception 'AFTER_SALES_INVALID_SOURCE';
  end if;
  if branch is null or not public.user_has_branch_access(branch,p_actor_user_id) then raise exception 'AFTER_SALES_FORBIDDEN'; end if;
  if c.customer_id is not null and not exists(select 1 from public.customers where id=c.customer_id and organization_id=p_organization_id) then raise exception 'AFTER_SALES_INVALID_SOURCE'; end if;

  current_status:=case c.status when 'abierto' then 'open' when 'aprobado' then 'approved'
    when 'completado' then 'completed' when 'rechazado' then 'rejected' when 'cancelado' then 'cancelled' else c.status end;
  target:=nullif(p_input->>'status','');
  if target is not null and target not in ('approved','completed','rejected','cancelled') then raise exception 'AFTER_SALES_INVALID_REQUEST'; end if;
  if p_input-'status'='{}'::jsonb and target is null then raise exception 'AFTER_SALES_INVALID_REQUEST'; end if;
  -- Only transitions carry external effects. Repeating an ordinary edit after
  -- a different edit must apply again rather than return an obsolete snapshot.
  action_key:=target;
  identity:=jsonb_build_object('actor',p_actor_user_id,'input',p_input);
  select * into stored from public.after_sales_resolution_requests
    where organization_id=p_organization_id and case_id=p_case_id and action=action_key;
  if found then
    if stored.request is distinct from identity then raise exception 'AFTER_SALES_ALREADY_RESOLVED'; end if;
    return stored.result||jsonb_build_object('replayed',true);
  end if;
  if current_status in ('completed','rejected','cancelled') then raise exception 'AFTER_SALES_ALREADY_RESOLVED'; end if;
  if target is not null and not (
    current_status='open' and target in ('approved','rejected','cancelled')
    or current_status='approved' and target in ('completed','cancelled')
  ) then raise exception 'AFTER_SALES_INVALID_TRANSITION'; end if;
  note:=nullif(btrim(p_input->>'notes'),'');
  if length(coalesce(note,''))>2000 or target='rejected' and length(coalesce(note,''))<5 then raise exception 'AFTER_SALES_INVALID_NOTES'; end if;
  kind:=case c.request_type when 'garantia_reparacion' then 'repair_warranty' when 'garantia_producto' then 'product_warranty'
    when 'cambio' then 'exchange' when 'devolucion' then 'return' else c.request_type end;
  refund:=case when p_input ? 'refund_amount' then coalesce((p_input->>'refund_amount')::numeric,0) else coalesce(c.refund_amount,0) end;
  method:=case when p_input ? 'refund_method' then nullif(p_input->>'refund_method','') else c.refund_method end;
  restock:=coalesce(case when p_input ? 'restock_action' then nullif(p_input->>'restock_action','') else c.restock_action end,case when kind='product_warranty' then 'quarantine' when kind in ('return','exchange') then 'sellable' else 'none' end);
  if refund<0 or refund>9999999999 or refund<>round(refund,2) or refund::text in ('NaN','Infinity','-Infinity')
    or restock not in ('sellable','quarantine','none') or method is not null and method not in ('cash','store_credit') then raise exception 'AFTER_SALES_INVALID_REQUEST'; end if;

  if target='completed' then
    -- One effective refund is validated and then used for the write.
    if refund>0 and method is null then raise exception 'AFTER_SALES_REFUND_METHOD_REQUIRED'; end if;
    if refund>0 and method='store_credit' and c.customer_id is null then raise exception 'AFTER_SALES_CUSTOMER_REQUIRED'; end if;
    if c.sale_id is not null then
      if c.sale_item_id is null then raise exception 'AFTER_SALES_LINE_REQUIRED'; end if;
      select * into item from public.sale_items where id=c.sale_item_id and sale_id=c.sale_id and organization_id=p_organization_id for update;
      if not found or item.quantity<=0 or item.subtotal<0 or c.quantity<=0 or c.quantity>item.quantity
        or c.product_id is distinct from item.product_id then raise exception 'AFTER_SALES_INVALID_SOURCE'; end if;
      select coalesce(sum(subtotal),0) into line_total from public.sale_items where sale_id=c.sale_id and organization_id=p_organization_id;
      if line_total<=0 or sale.total_amount<0 then
        if refund>0 then raise exception 'AFTER_SALES_REFUND_EXCEEDS_CAP'; end if;
        cap:=0;
      else
        -- Allocate the actual invoice total, including its header discount/tax.
        cap:=round(sale.total_amount*(item.subtotal/line_total)*(c.quantity::numeric/item.quantity),2);
      end if;
      select coalesce(sum(quantity),0) into prior_units from public.after_sales_cases
        where organization_id=p_organization_id and sale_item_id=c.sale_item_id and id<>c.id and status in ('completed','completado');
      if prior_units+c.quantity>item.quantity then raise exception 'AFTER_SALES_QUANTITY_EXCEEDED'; end if;
      select coalesce(sum(a.refund_amount),0) into prior_refunds from public.after_sales_cases a
        where a.organization_id=p_organization_id and a.sale_id=c.sale_id and a.id<>c.id and a.status in ('completed','completado');
      if refund>cap or refund+prior_refunds>sale.total_amount then raise exception 'AFTER_SALES_REFUND_EXCEEDS_CAP'; end if;
    elsif refund>0 then
      if parent.final_cost is null then raise exception 'AFTER_SALES_REFUND_EXCEEDS_CAP'; end if;
      select coalesce(sum(a.refund_amount),0) into prior_refunds from public.after_sales_cases a
        where a.organization_id=p_organization_id and a.repair_id=c.repair_id and a.id<>c.id and a.status in ('completed','completado');
      if refund+prior_refunds>greatest(0,parent.final_cost) then raise exception 'AFTER_SALES_REFUND_EXCEEDS_CAP'; end if;
    end if;
    if refund>0 and method='cash' then
      if not public.has_org_permission(p_organization_id,'pos.cash.manage') then raise exception 'AFTER_SALES_FORBIDDEN'; end if;
      select id into cash_session from public.cash_closures
        where organization_id=p_organization_id and branch_id=branch and date is null
        order by (lower(coalesce(register_id,''))='principal') desc,created_at desc limit 1 for update;
      if not found then raise exception 'OPEN_CASH_SESSION_NOT_FOUND'; end if;
    end if;
    -- Deterministic product lock order prevents opposite exchanges deadlocking.
    perform 1 from public.products where id in (c.product_id,c.replacement_product_id) and organization_id=p_organization_id order by id for update;
    if restock='sellable' then
      perform public.after_sales_stock_change(p_organization_id,branch,p_actor_user_id,c.product_id,c.quantity,c.id,'Devolución posventa '||c.case_number,item.variant_id);
      outcome:=outcome||jsonb_build_object('restock',jsonb_build_object('restocked',c.quantity,'action',restock));
    end if;
    if c.replacement_product_id is not null then
      perform public.after_sales_stock_change(p_organization_id,branch,p_actor_user_id,c.replacement_product_id,-coalesce(c.replacement_quantity,1),c.id,'Cambio posventa '||c.case_number);
      outcome:=outcome||jsonb_build_object('replacement',jsonb_build_object('dispatched',coalesce(c.replacement_quantity,1)));
    end if;
    if refund>0 then
      if method='store_credit' then
        insert into public.customer_store_credits(organization_id,customer_id,amount,reason,source_type,source_id,created_by)
          values(p_organization_id,c.customer_id,refund,'Reintegro posventa '||c.case_number,'after_sales',c.id,p_actor_user_id);
      else
        perform public.server_record_cash_movement_atomic(p_actor_user_id,p_organization_id,branch,cash_session,'cash_out',refund,'Reintegro posventa '||c.case_number);
      end if;
      outcome:=outcome||jsonb_build_object('refund',jsonb_build_object('method',method,'amount',refund));
      if c.sale_id is not null and c.customer_id is not null then
        -- Missing optional loyalty module is explicit, other failures roll back.
        begin
          reversed:=to_jsonb(public.reverse_loyalty_points_for_refund(p_organization_id,c.customer_id,c.sale_id,refund,'refund:'||c.id));
          if reversed is not null then outcome:=outcome||jsonb_build_object('loyaltyPointsReversed',abs(coalesce((reversed->>'points')::integer,0))); end if;
        exception when undefined_table or undefined_function then
          outcome:=outcome||jsonb_build_object('loyaltyUnavailable',true);
        end;
      end if;
    end if;
  elsif target='approved' and kind='repair_warranty' then
    if parent.id is null or parent.customer_id is null or nullif(parent.device_brand,'') is null or nullif(parent.device_model,'') is null then raise exception 'AFTER_SALES_INVALID_SOURCE'; end if;
    if not (public.has_org_permission(p_organization_id,'repairs.orders.create') or public.has_org_permission(p_organization_id,'repairs.orders.update')) then raise exception 'AFTER_SALES_FORBIDDEN'; end if;
    if c.generated_repair_id is not null then raise exception 'AFTER_SALES_ALREADY_RESOLVED'; end if;
    coverage:=case parent.warranty_type when 'labor' then 'Garantía de mano de obra: los repuestos se cobran.' when 'parts' then 'Garantía de repuestos: la mano de obra se cobra.' else 'Garantía completa: sin cargo al cliente.' end;
    insert into public.repairs(organization_id,branch_id,customer_id,parent_repair_id,device_type,device_brand,device_model,problem_description,technician_id,priority,urgency,status,estimated_cost,labor_cost,warranty_months,warranty_type)
      values(p_organization_id,branch,parent.customer_id,parent.id,parent.device_type,parent.device_brand,parent.device_model,
        '[Garantía de '||coalesce(parent.ticket_number,parent.id::text)||'] '||coalesce(note,c.reason),parent.technician_id,
        coalesce(parent.priority,'medium'),coalesce(parent.urgency,'normal'),'recibido',0,0,coalesce(parent.warranty_months,0),parent.warranty_type)
      returning * into created_repair;
    insert into public.repair_notes(repair_id,note_text,author_id,author_name,is_internal)
      values(created_repair.id,'Retrabajo de garantía. '||coverage,p_actor_user_id,'Sistema',true);
    c.generated_repair_id:=created_repair.id;
    outcome:=outcome||jsonb_build_object('warrantyRepair',jsonb_build_object('repairId',created_repair.id,'ticketNumber',created_repair.ticket_number));
  end if;

  stored_status:=case when c.status in ('abierto','aprobado','rechazado','completado','cancelado') then
    case target when 'approved' then 'aprobado' when 'completed' then 'completado' when 'rejected' then 'rechazado' when 'cancelled' then 'cancelado' else c.status end
    else coalesce(target,c.status) end;
  prefix:=case target when 'completed' then 'Resolución: ' when 'rejected' then 'Motivo de rechazo: ' when 'cancelled' then 'Cancelación: ' else '' end;
  update public.after_sales_cases set status=stored_status,updated_at=now(),
    notes=case when note is null then notes else concat_ws(E'\n\n',nullif(btrim(notes),''),prefix||note) end,
    refund_amount=case when target='completed' or p_input ? 'refund_amount' then refund else refund_amount end,
    refund_method=case when target='completed' and refund>0 then method when p_input ? 'refund_method' then method else refund_method end,
    restock_action=case when target='completed' then restock when p_input ? 'restock_action' then p_input->>'restock_action' else restock_action end,
    generated_repair_id=c.generated_repair_id,
    approved_at=case when target='approved' then now() else approved_at end,
    resolved_at=case when target in ('completed','rejected','cancelled') then now() else resolved_at end,
    resolved_by=case when target in ('completed','rejected','cancelled') then p_actor_user_id else resolved_by end
    where id=c.id and organization_id=p_organization_id returning * into c;
  result:=jsonb_build_object('data',to_jsonb(c))||outcome;
  if action_key is not null then
    insert into public.after_sales_resolution_requests(organization_id,case_id,action,request,result)
      values(p_organization_id,c.id,action_key,identity,result);
  end if;
  return result;
end $$;
revoke all on function public.server_resolve_after_sales_case_atomic(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.server_resolve_after_sales_case_atomic(uuid,uuid,uuid,jsonb) to service_role;

create or replace function public.server_create_after_sales_case_atomic(
  p_actor_user_id uuid,p_organization_id uuid,p_input jsonb
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare
  sale public.sales%rowtype; parent public.repairs%rowtype; item public.sale_items%rowtype; c public.after_sales_cases%rowtype;
  source text:=p_input->>'source_type'; kind text:=p_input->>'request_type';
  v_sale_id uuid:=(p_input->>'sale_id')::uuid; v_repair_id uuid:=(p_input->>'repair_id')::uuid;
  v_item_id uuid:=(p_input->>'sale_item_id')::uuid; v_product_id uuid:=(p_input->>'product_id')::uuid;
  v_customer_id uuid:=(p_input->>'customer_id')::uuid; replacement_id uuid:=(p_input->>'replacement_product_id')::uuid;
  units integer:=coalesce((p_input->>'quantity')::integer,1); branch uuid; previous_units numeric; total_lines numeric; refund numeric:=coalesce((p_input->>'refund_amount')::numeric,0);
begin
  perform public.assert_service_cash_actor(p_actor_user_id);
  if not public.has_org_permission(p_organization_id,'crm.customers.manage') then raise exception 'AFTER_SALES_FORBIDDEN'; end if;
  if jsonb_typeof(p_input) is distinct from 'object' or source is null or source not in ('sale','repair')
    or kind is null or kind not in ('repair_warranty','product_warranty','exchange','return') or units not between 1 and 10000
    or length(btrim(coalesce(p_input->>'reason',''))) not between 1 and 1000
    or coalesce((p_input->>'replacement_quantity')::integer,1) not between 1 and 10000
    or refund::text in ('NaN','Infinity','-Infinity') or length(coalesce(p_input->>'notes',''))>2000 or refund<0 or refund>9999999999 or refund<>round(refund,2) then raise exception 'AFTER_SALES_INVALID_REQUEST'; end if;
  if source='sale' then
    if kind='repair_warranty' or v_sale_id is null or v_item_id is null then raise exception 'AFTER_SALES_LINE_REQUIRED'; end if;
    select * into sale from public.sales s where s.id=v_sale_id and s.organization_id=p_organization_id for update;
    if not found then raise exception 'AFTER_SALES_INVALID_SOURCE'; end if;
    branch:=sale.branch_id;
    select * into item from public.sale_items i where i.id=v_item_id and i.sale_id=sale.id and i.organization_id=p_organization_id for update;
    if not found or item.quantity<=0 then raise exception 'AFTER_SALES_INVALID_SOURCE'; end if;
    if v_product_id is not null and v_product_id is distinct from item.product_id then raise exception 'AFTER_SALES_INVALID_PRODUCT'; end if;
    v_product_id:=item.product_id;
    if v_customer_id is not null and sale.customer_id is not null and v_customer_id<>sale.customer_id then raise exception 'AFTER_SALES_INVALID_SOURCE'; end if;
    v_customer_id:=coalesce(v_customer_id,sale.customer_id);
    select coalesce(sum(a.quantity),0) into previous_units from public.after_sales_cases a
      where a.organization_id=p_organization_id and a.sale_item_id=item.id
        and a.status not in ('rejected','rechazado','cancelled','cancelado');
    if previous_units+units>item.quantity then raise exception 'AFTER_SALES_QUANTITY_EXCEEDED'; end if;
    select coalesce(sum(i.subtotal),0) into total_lines from public.sale_items i where i.sale_id=sale.id and i.organization_id=p_organization_id;
    if refund>0 and (total_lines<=0 or refund>round(sale.total_amount*(item.subtotal/total_lines)*(units::numeric/item.quantity),2)) then raise exception 'AFTER_SALES_REFUND_EXCEEDS_CAP'; end if;
    v_repair_id:=null;
  else
    if kind<>'repair_warranty' or v_repair_id is null then raise exception 'AFTER_SALES_INVALID_SOURCE'; end if;
    select * into parent from public.repairs r where r.id=v_repair_id and r.organization_id=p_organization_id for update;
    if not found then raise exception 'AFTER_SALES_INVALID_SOURCE'; end if;
    branch:=parent.branch_id;
    if v_customer_id is not null and v_customer_id is distinct from parent.customer_id then raise exception 'AFTER_SALES_INVALID_SOURCE'; end if;
    v_customer_id:=parent.customer_id;
    v_sale_id:=null;v_item_id:=null;v_product_id:=null;
    if refund>0 and (parent.final_cost is null or refund>greatest(0,parent.final_cost)) then raise exception 'AFTER_SALES_REFUND_EXCEEDS_CAP'; end if;
  end if;
  if branch is null or not public.user_has_branch_access(branch,p_actor_user_id) then raise exception 'AFTER_SALES_FORBIDDEN'; end if;
  if v_customer_id is not null and not exists(select 1 from public.customers customer where customer.id=v_customer_id and customer.organization_id=p_organization_id) then raise exception 'AFTER_SALES_INVALID_SOURCE'; end if;
  if v_product_id is not null and not exists(select 1 from public.products p where p.id=v_product_id and p.organization_id=p_organization_id) then raise exception 'AFTER_SALES_INVALID_PRODUCT'; end if;
  if replacement_id is not null and not exists(select 1 from public.products p where p.id=replacement_id and p.organization_id=p_organization_id) then raise exception 'AFTER_SALES_INVALID_PRODUCT'; end if;
  if exists(select 1 from public.after_sales_cases a where a.organization_id=p_organization_id
    and (case a.request_type when 'garantia_reparacion' then 'repair_warranty' when 'garantia_producto' then 'product_warranty' when 'cambio' then 'exchange' when 'devolucion' then 'return' else a.request_type end)=kind
    and a.status in ('open','abierto','approved','aprobado')
    and (source='sale' and a.sale_item_id=v_item_id or source='repair' and a.repair_id=parent.id)) then raise exception 'AFTER_SALES_OPEN_CASE_EXISTS'; end if;
  insert into public.after_sales_cases(organization_id,source_type,request_type,status,customer_id,repair_id,sale_id,sale_item_id,product_id,quantity,reason,notes,refund_amount,replacement_product_id,replacement_quantity,price_difference,created_by)
    values(p_organization_id,source,kind,'open',v_customer_id,v_repair_id,v_sale_id,v_item_id,v_product_id,units,btrim(p_input->>'reason'),nullif(btrim(p_input->>'notes'),''),refund,replacement_id,
      case when replacement_id is not null then coalesce((p_input->>'replacement_quantity')::integer,1) end,(p_input->>'price_difference')::numeric,p_actor_user_id)
    returning * into c;
  return jsonb_build_object('data',to_jsonb(c));
end $$;
revoke all on function public.server_create_after_sales_case_atomic(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.server_create_after_sales_case_atomic(uuid,uuid,jsonb) to service_role;

-- The inverse operation must respect returns too, under the same sale-row lock.
create or replace function public.guard_void_sale_after_sales() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if old.status in ('completed','completada') and coalesce(new.status,'') not in ('completed','completada') and exists(
    select 1 from public.after_sales_cases a where a.sale_id=old.id and a.organization_id=old.organization_id
      and a.status in ('completed','completado')) then
    raise exception 'SALE_HAS_COMPLETED_AFTER_SALES';
  end if;
  return new;
end $$;
revoke all on function public.guard_void_sale_after_sales() from public,anon,authenticated;
create trigger guard_void_sale_after_sales before update of status on public.sales
for each row execute function public.guard_void_sale_after_sales();
-- Only the checked server operations may create or resolve cases.
revoke all on public.after_sales_cases from public,anon,authenticated;
grant select on public.after_sales_cases to authenticated;
grant all on public.after_sales_cases to service_role;
-- Browser clients must not bypass the checked server ledger operations.
revoke all on public.cash_movements from public,anon,authenticated;
grant select on public.cash_movements to authenticated;
grant all on public.cash_movements to service_role;
drop policy if exists "tenant members can read cash movements" on public.cash_movements;
drop policy if exists cash_movements_financial_visibility_guard on public.cash_movements;
create policy cash_movements_financial_visibility_guard on public.cash_movements as restrictive for select to authenticated
  using ((finance_payment_id is null and payroll_payment_id is null) or public.has_org_permission(organization_id,'finances.read'));
-- Existing restrictive branch policy is intentionally retained.
commit;
