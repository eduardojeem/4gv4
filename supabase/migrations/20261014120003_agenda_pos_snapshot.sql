begin;
-- Do not rewrite the existing POS functions or catalog prices. Clone their
-- current implementation for the server-only appointment path, fail closed if
-- the expected pricing/stock contract has changed, and preserve the old path.
alter table public.appointments add column pos_request_hash text,add column pos_idempotency_key text;
create unique index appointments_atomic_sale_link on public.appointments(sale_id) where pos_request_hash is not null;

create function public.agenda_pos_product_id(p_org uuid) returns uuid language sql stable security definer set search_path='' as $$
  select service_product_id from public.appointments where organization_id=p_org and id=nullif(current_setting('app.agenda_appointment_id',true),'')::uuid
$$;
create function public.agenda_pos_unit_price(p_org uuid,p_product uuid,p_default numeric) returns numeric language sql stable security definer set search_path='' as $$
  select coalesce((select price from public.appointments where organization_id=p_org and service_product_id=p_product
    and id=nullif(current_setting('app.agenda_appointment_id',true),'')::uuid),p_default)
$$;
create function public.agenda_pos_free_checkout(p_org uuid,p_items jsonb,p_payments jsonb,p_repairs jsonb,p_credit jsonb)
returns boolean language sql stable security definer set search_path='' as $$
  select jsonb_array_length(p_items)=1 and jsonb_array_length(p_payments)=0 and jsonb_array_length(p_repairs)=0 and p_credit is null
    and coalesce((p_items->0->>'discount_amount')::numeric,0)=0 and exists(select 1 from public.appointments
      where organization_id=p_org and price=0 and service_product_id=(p_items->0->>'product_id')::uuid
        and id=nullif(current_setting('app.agenda_appointment_id',true),'')::uuid)
$$;
revoke all on function public.agenda_pos_product_id(uuid),public.agenda_pos_unit_price(uuid,uuid,numeric),public.agenda_pos_free_checkout(uuid,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;

do $migration$
declare version integer; source text; original text; identity text; oid oid; stock_start text; stock_end text;
begin
  for version in 2..5 loop
    select p.oid,pg_get_functiondef(p.oid),pg_get_function_identity_arguments(p.oid) into oid,source,identity
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='process_pos_sale_atomic_v'||version;
    if source is null then raise exception 'AGENDA_POS_BASE_FUNCTION_MISSING|%',version; end if;
    source:=replace(source,'process_pos_sale_atomic_v'||version,'process_agenda_pos_base_v'||version);
    if version>2 then source:=replace(source,'process_pos_sale_atomic_v'||(version-1),'process_agenda_pos_base_v'||(version-1)); end if;
    if version=2 then
      if position('else selected_product.sale_price' in source)=0 or position('else product.sale_price' in source)=0 then raise exception 'AGENDA_POS_PRICE_CONTRACT_CHANGED'; end if;
      source:=regexp_replace(source,'\mselected_product\.sale_price\M','public.agenda_pos_unit_price(p_organization_id,selected_product.id,selected_product.sale_price)','g');
      source:=regexp_replace(source,'\mproduct\.sale_price\M','public.agenda_pos_unit_price(p_organization_id,product.id,product.sale_price)','g');
      stock_start:='    select inventory.stock_quantity into branch_stock';
      stock_end:='    unit_price := case';
      if position(stock_start in source)=0 or position(stock_end in source)=0 then raise exception 'AGENDA_POS_STOCK_CONTRACT_CHANGED'; end if;
      source:=replace(source,stock_start,'    if item.product_id <> public.agenda_pos_product_id(p_organization_id) then'||E'\n'||stock_start);
      source:=replace(source,stock_end,'    end if;'||E'\n'||stock_end);
      stock_start:='    update public.products'||E'\n'||'    set stock_quantity = stock_quantity - item.quantity, updated_at = now()';
      stock_end:='    where branch_id = p_branch_id and product_id = item.product_id;';
      if position(stock_start in source)=0 or position(stock_end in source)=0 then raise exception 'AGENDA_POS_STOCK_UPDATE_CONTRACT_CHANGED'; end if;
      source:=replace(source,stock_start,'    if item.product_id <> public.agenda_pos_product_id(p_organization_id) then'||E'\n'||stock_start);
      source:=replace(source,stock_end,stock_end||E'\n'||'    end if;');
      original:='or jsonb_array_length(coalesce(p_payments, ''[]''::jsonb)) = 0 then';
      if position(original in source)=0 then raise exception 'AGENDA_POS_PAYMENT_CONTRACT_CHANGED'; end if;
      source:=replace(source,original,'or (jsonb_array_length(coalesce(p_payments, ''[]''::jsonb)) = 0 and not public.agenda_pos_free_checkout(p_organization_id,p_items,p_payments,p_repair_ids,p_credit)) then');
      original:='if net_subtotal <= 0 then';
      if position(original in source)=0 then raise exception 'AGENDA_POS_TOTAL_CONTRACT_CHANGED'; end if;
      source:=replace(source,original,'if net_subtotal <= 0 and not (net_subtotal=0 and public.agenda_pos_free_checkout(p_organization_id,p_items,p_payments,p_repair_ids,p_credit)) then');
      original:='when payment_count > 1 then ''mixed''';
      if position(original in source)=0 then raise exception 'AGENDA_POS_PAYMENT_SUMMARY_CONTRACT_CHANGED'; end if;
      source:=replace(source,original,'when payment_count = 0 then ''efectivo'' '||original);
    end if;
    execute source;
    execute format('revoke all on function public.process_agenda_pos_base_v%s(%s) from public, anon, authenticated, service_role',version,identity);
  end loop;
end $migration$;

create function public.process_agenda_pos_sale(p_org uuid,p_branch uuid,p_actor uuid,p_session uuid,p_appointment uuid,p_key text,p_items jsonb,p_payments jsonb,p_options jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.appointments; result jsonb; request_hash text; item_count integer; old_context text; sale uuid;
begin
  perform public.agenda_lock(p_org); perform public.agenda_assert_actor(p_org,p_actor,false);
  select * into a from public.appointments where organization_id=p_org and id=p_appointment for update;
  if not found then raise exception 'APPOINTMENT_NOT_IN_ORGANIZATION'; end if;
  if nullif(trim(p_key),'') is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_typeof(p_payments)<>'array' or jsonb_typeof(p_options)<>'object' then raise exception 'INVALID_POS_ITEMS'; end if;
  request_hash:=md5(jsonb_build_object('actor',p_actor,'branch',p_branch,'session',p_session,'items',p_items,'payments',p_payments,'options',p_options-'code')::text);
  if a.sale_id is not null then
    if a.pos_idempotency_key is distinct from p_key then raise exception 'APPOINTMENT_ALREADY_PAID'; end if;
    if a.pos_request_hash is distinct from request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    select id into sale from public.sales where id=a.sale_id and organization_id=p_org;
    if sale is null then raise exception 'INVALID_ATOMIC_SALE_RESPONSE'; end if;
    return jsonb_build_object('sale_id',sale,'total',(select total_amount from public.sales where id=sale),'idempotent',true);
  end if;
  if a.status not in ('pending','confirmed','completed') then raise exception 'APPOINTMENT_NOT_CHANGEABLE'; end if;
  if a.service_product_id is null or not exists(select 1 from public.products where id=a.service_product_id and organization_id=p_org and unit_measure='servicio' and is_active) then raise exception 'SERVICE_UNAVAILABLE'; end if;
  if coalesce(p_options->>'price_mode','retail')<>'retail' then raise exception 'APPOINTMENT_REQUIRES_RETAIL'; end if;
  if a.customer_id is not null and a.customer_id is distinct from (p_options->>'customer_id')::uuid then raise exception 'APPOINTMENT_CUSTOMER_MISMATCH'; end if;
  select count(*) into item_count from jsonb_array_elements(p_items) where (value->>'product_id')::uuid=a.service_product_id;
  if item_count<>1 or exists(select 1 from jsonb_array_elements(p_items) where (value->>'product_id')::uuid=a.service_product_id
    and ((value->>'quantity')::integer<>1 or nullif(value->>'variant_id','') is not null)) then raise exception 'APPOINTMENT_SERVICE_QUANTITY_MISMATCH'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_org::text||':pos:'||trim(p_key),0));
  if exists(select 1 from public.sales where organization_id=p_org and idempotency_key=trim(p_key)) then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  old_context:=current_setting('app.agenda_appointment_id',true);
  perform set_config('app.agenda_appointment_id',a.id::text,true);
  result:=public.process_agenda_pos_base_v5(p_org,p_branch,p_actor,p_session,trim(p_key),coalesce(p_options->>'code','POS-'||a.number::text),
    (p_options->>'customer_id')::uuid,p_items,p_payments,'retail',coalesce((p_options->>'order_discount_rate')::numeric,0),p_options->>'notes',
    coalesce((p_options->>'tax_rate')::numeric,0),coalesce((p_options->>'prices_include_tax')::boolean,true),p_options->'credit',coalesce(p_options->'repair_ids','[]'::jsonb),
    coalesce((p_options->>'mark_repairs_delivered')::boolean,false),p_options->>'delivery_outcome',coalesce((p_options->>'store_credit_amount')::numeric,0));
  perform set_config('app.agenda_appointment_id',coalesce(old_context,''),true);
  sale:=(result->>'sale_id')::uuid;
  if sale is null or not exists(select 1 from public.sales where id=sale and organization_id=p_org) then raise exception 'INVALID_ATOMIC_SALE_RESPONSE'; end if;
  update public.appointments set sale_id=sale,status='completed',pos_idempotency_key=p_key,pos_request_hash=request_hash where id=a.id;
  return result;
end $$;
revoke all on function public.process_agenda_pos_sale(uuid,uuid,uuid,uuid,uuid,text,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.process_agenda_pos_sale(uuid,uuid,uuid,uuid,uuid,text,jsonb,jsonb,jsonb) to service_role;

-- Browser clients cannot forge prices/snapshots or attach arbitrary sales.
revoke insert,update on public.appointments from authenticated;
grant update(status,cancel_reason,confirmed_at,reminder_sent_at) on public.appointments to authenticated;
create or replace function public.agenda_booking_version() returns integer language sql immutable as $$select 2$$;
commit;
