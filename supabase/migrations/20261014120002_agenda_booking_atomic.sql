begin;

-- One common organization lock deliberately serializes all agenda mutations.
-- Correctness first: reservations, configuration and blocks use the SAME key.
create function public.agenda_lock(p_org uuid) returns void language sql
set search_path = '' as $$ select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_org::text || ':agenda-v2',0)) $$;
revoke all on function public.agenda_lock(uuid) from public, anon, authenticated;

create function public.agenda_booking_version() returns integer language sql immutable as $$ select 1 $$;
revoke all on function public.agenda_booking_version() from public, anon;
grant execute on function public.agenda_booking_version() to authenticated, service_role;

alter table public.agenda_booking_quotes add constraint agenda_quotes_tenant_identity unique(organization_id,id);
alter table public.appointments add column booking_quote_id uuid,
  add constraint appointments_quote_tenant_fk foreign key(organization_id,booking_quote_id)
    references public.agenda_booking_quotes(organization_id,id);

create function public.agenda_revision_changed() returns trigger language plpgsql security definer
set search_path = '' as $$
declare org uuid;
begin
  org := case when tg_op='DELETE' then old.organization_id else new.organization_id end;
  if tg_op='UPDATE' and old.organization_id is distinct from new.organization_id then
    raise exception 'AGENDA_TENANT_IMMUTABLE';
  end if;
  perform public.agenda_lock(org);
  if tg_table_name='agenda_settings' then
    if tg_op='UPDATE' then new.booking_revision := old.booking_revision+1; end if;
  else
    update public.agenda_settings set booking_revision=booking_revision+1 where organization_id=org;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function public.agenda_revision_changed() from public, anon, authenticated;
create trigger agenda_settings_revision before insert or update or delete on public.agenda_settings
for each row execute function public.agenda_revision_changed();
create trigger agenda_professionals_revision before insert or update or delete on public.agenda_professionals
for each row execute function public.agenda_revision_changed();
create trigger agenda_services_revision before insert or update or delete on public.agenda_services
for each row execute function public.agenda_revision_changed();
create trigger agenda_rates_revision before insert or update or delete on public.agenda_professional_service_rates
for each row execute function public.agenda_revision_changed();
create trigger agenda_eligibility_revision before insert or update or delete on public.agenda_professional_services
for each row execute function public.agenda_revision_changed();
create trigger agenda_timezone_revision before update of timezone on public.organization_settings
for each row execute function public.agenda_revision_changed();
create trigger agenda_product_revision before update of name,sale_price,hide_price,is_active,visibility,unit_measure on public.products
for each row when (old.unit_measure='servicio' or new.unit_measure='servicio') execute function public.agenda_revision_changed();

-- Server and direct database writes both enforce tenant references and occupied time.
create or replace function public.check_appointment_overlap() returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  if tg_op='UPDATE' and old.organization_id is distinct from new.organization_id then raise exception 'AGENDA_TENANT_IMMUTABLE'; end if;
  perform public.agenda_lock(new.organization_id);
  if new.professional_id is not null and not exists(select 1 from public.agenda_professionals where id=new.professional_id and organization_id=new.organization_id) then raise exception 'PROFESSIONAL_NOT_IN_ORGANIZATION'; end if;
  if new.service_product_id is not null and not exists(select 1 from public.products where id=new.service_product_id and organization_id=new.organization_id) then raise exception 'PRODUCT_NOT_IN_ORGANIZATION'; end if;
  if new.customer_id is not null and not exists(select 1 from public.customers where id=new.customer_id and organization_id=new.organization_id) then raise exception 'CUSTOMER_NOT_IN_ORGANIZATION'; end if;
  if tg_op='UPDATE' and old.sale_id is not null and (new.price is distinct from old.price or new.service_product_id is distinct from old.service_product_id or new.professional_id is distinct from old.professional_id or new.ends_at-new.starts_at is distinct from old.ends_at-old.starts_at or new.buffer_minutes is distinct from old.buffer_minutes) then raise exception 'APPOINTMENT_ALREADY_PAID'; end if;
  if new.status not in ('pending','confirmed') then return new; end if;
  if exists(select 1 from public.appointments a where a.organization_id=new.organization_id and a.id<>new.id
    and a.status in ('pending','confirmed') and (a.professional_id is null or new.professional_id is null or a.professional_id=new.professional_id)
    and a.starts_at<new.occupied_until and new.starts_at<a.occupied_until) then raise exception 'APPOINTMENT_OVERLAP'; end if;
  if exists(select 1 from public.agenda_time_off b where b.organization_id=new.organization_id
    and (b.professional_id is null or new.professional_id is null or b.professional_id=new.professional_id)
    and b.starts_at<new.occupied_until and new.starts_at<b.ends_at) then raise exception 'TIME_OFF_CONFLICT'; end if;
  return new;
end $$;
revoke all on function public.check_appointment_overlap() from public, anon, authenticated;
-- Replace the old trigger regardless of its original name; avoid competing lock protocols.
do $$ declare t record; begin
  for t in select tgname from pg_trigger where tgrelid='public.appointments'::regclass and tgfoid='public.check_appointment_overlap()'::regprocedure loop
    execute format('drop trigger %I on public.appointments',t.tgname);
  end loop;
end $$;
create trigger appointments_10_overlap before insert or update on public.appointments
for each row execute function public.check_appointment_overlap();

create function public.agenda_time_off_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
  org := case when tg_op='DELETE' then old.organization_id else new.organization_id end;
  perform public.agenda_lock(org);
  if tg_op='DELETE' then return old; end if;
  if tg_op='UPDATE' and old.organization_id is distinct from new.organization_id then raise exception 'AGENDA_TENANT_IMMUTABLE'; end if;
  if exists(select 1 from public.appointments a where a.organization_id=org and a.status in ('pending','confirmed')
    and (new.professional_id is null or a.professional_id is null or a.professional_id=new.professional_id)
    and a.starts_at<new.ends_at and new.starts_at<a.occupied_until) then raise exception 'TIME_OFF_CONFLICT'; end if;
  return new;
end $$;
revoke all on function public.agenda_time_off_guard() from public,anon,authenticated;
create trigger agenda_time_off_guard before insert or update or delete on public.agenda_time_off
for each row execute function public.agenda_time_off_guard();

create function public.agenda_time_is_open(p_org uuid,p_prof uuid,p_start timestamptz,p_duration integer,p_buffer integer)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare s public.agenda_settings; tz text; local_start timestamp; day integer; b jsonb; r jsonb; ph jsonb; lo timestamp; hi timestamp;
begin
  select * into s from public.agenda_settings where organization_id=p_org;
  select coalesce(timezone,'America/Asuncion') into tz from public.organization_settings where organization_id=p_org;
  tz := coalesce(tz,'America/Asuncion'); local_start := p_start at time zone tz; day := extract(dow from local_start)::integer;
  if p_prof is not null then select opening_hours into ph from public.agenda_professionals where id=p_prof and organization_id=p_org; end if;
  for b in select value from jsonb_array_elements(coalesce(s.opening_hours->day::text,'[]')) loop
    for r in select value from jsonb_array_elements(coalesce(ph->day::text,case when ph is null then s.opening_hours->day::text else '[]'::jsonb end,'[]')) loop
      lo := date_trunc('day',local_start)+greatest((b->>0)::time,(r->>0)::time);
      hi := date_trunc('day',local_start)+least((b->>1)::time,(r->>1)::time);
      if local_start>=lo and p_start+make_interval(mins=>p_duration+p_buffer)<=hi at time zone tz
        and mod(extract(epoch from local_start-lo)::integer,s.slot_minutes*60)=0 then return true; end if;
    end loop;
  end loop;
  return false;
end $$;
revoke all on function public.agenda_time_is_open(uuid,uuid,timestamptz,integer,integer) from public,anon,authenticated;

create function public.create_agenda_quote(p_org uuid,p_product uuid,p_prof uuid,p_start timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.agenda_settings; product public.products; service public.agenda_services; pro record; rate public.agenda_professional_service_rates; q public.agenda_booking_quotes;
  chosen uuid; duration integer; buffer integer; price numeric; tz text; today date; local_date date; eligible boolean:=false;
begin
  perform public.agenda_lock(p_org);
  select * into s from public.agenda_settings where organization_id=p_org;
  if not found or not s.online_booking then raise exception 'ONLINE_BOOKING_DISABLED'; end if;
  if s.professional_selection='required' and p_prof is null then raise exception 'PROFESSIONAL_REQUIRED'; end if;
  if s.professional_selection='disabled' and p_prof is not null then raise exception 'PROFESSIONAL_SELECTION_DISABLED'; end if;
  select * into product from public.products where id=p_product and organization_id=p_org and unit_measure='servicio' and is_active and coalesce(visibility,'public')='public';
  if not found then raise exception 'SERVICE_UNAVAILABLE'; end if;
  select * into service from public.agenda_services where product_id=p_product and organization_id=p_org;
  if service.online is false then raise exception 'SERVICE_UNAVAILABLE'; end if;
  select coalesce(timezone,'America/Asuncion') into tz from public.organization_settings where organization_id=p_org;
  tz:=coalesce(tz,'America/Asuncion'); today:=(now() at time zone tz)::date; local_date:=(p_start at time zone tz)::date;
  if p_start<now()+make_interval(mins=>s.min_notice_minutes) or local_date<today or local_date>today+s.max_days_ahead then raise exception 'SLOT_UNAVAILABLE'; end if;
  for pro in
    select id,sort_order from public.agenda_professionals p where organization_id=p_org and is_active and online_visible and (p_prof is null or id=p_prof)
      and (not exists(select 1 from public.agenda_professional_services x where x.organization_id=p_org and x.professional_id=p.id)
        or exists(select 1 from public.agenda_professional_services x where x.organization_id=p_org and x.professional_id=p.id and x.product_id=p_product))
    union all select null::uuid,0 where p_prof is null and s.professional_selection<>'required' and not exists(select 1 from public.agenda_professionals where organization_id=p_org)
    order by sort_order,id
  loop
    eligible:=true;
    select * into rate from public.agenda_professional_service_rates where organization_id=p_org and professional_id=pro.id and product_id=p_product;
    duration:=coalesce(rate.duration_minutes,service.duration_minutes,s.slot_minutes); buffer:=coalesce(rate.buffer_minutes,service.buffer_minutes,0); price:=coalesce(rate.price,product.sale_price);
    if public.agenda_time_is_open(p_org,pro.id,p_start,duration,buffer)
      and not exists(select 1 from public.appointments a where organization_id=p_org and status in ('pending','confirmed') and (a.professional_id is null or pro.id is null or a.professional_id=pro.id) and a.starts_at<p_start+make_interval(mins=>duration+buffer) and p_start<a.occupied_until)
      and not exists(select 1 from public.agenda_time_off b where organization_id=p_org and (b.professional_id is null or pro.id is null or b.professional_id=pro.id) and b.starts_at<p_start+make_interval(mins=>duration+buffer) and p_start<b.ends_at)
    then
      insert into public.agenda_booking_quotes(organization_id,professional_id,product_id,service_name,price,hide_price,duration_minutes,buffer_minutes,starts_at,ends_at,occupied_until,revision)
      values(p_org,pro.id,p_product,product.name,price,coalesce(product.hide_price,false),duration,buffer,p_start,p_start+make_interval(mins=>duration),p_start+make_interval(mins=>duration+buffer),s.booking_revision) returning * into q;
      return to_jsonb(q);
    end if;
  end loop;
  if not eligible then raise exception 'NO_ELIGIBLE_PROFESSIONAL'; end if;
  raise exception 'APPOINTMENT_OVERLAP';
end $$;
revoke all on function public.create_agenda_quote(uuid,uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.create_agenda_quote(uuid,uuid,uuid,timestamptz) to service_role;

create function public.reserve_agenda_quote(p_quote_id uuid,p_idempotency_key uuid,p_customer jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.agenda_booking_quotes; s public.agenda_settings; a public.appointments; customer_id uuid; v_request_hash text; previous public.agenda_booking_quotes;
begin
  select * into q from public.agenda_booking_quotes where id=p_quote_id;
  if not found then raise exception 'QUOTE_UNAVAILABLE'; end if;
  perform public.agenda_lock(q.organization_id);
  select * into q from public.agenda_booking_quotes where id=p_quote_id for update;
  if p_idempotency_key is null or jsonb_typeof(p_customer)<>'object' or char_length(trim(coalesce(p_customer->>'name','')))<2 or char_length(p_customer->>'name')>120 or char_length(coalesce(p_customer->>'phone','')) not between 6 and 40 or char_length(coalesce(p_customer->>'notes',''))>500 then raise exception 'INVALID_BOOKING_CUSTOMER'; end if;
  v_request_hash:=md5(jsonb_build_object('name',trim(p_customer->>'name'),'phone',trim(p_customer->>'phone'),'notes',nullif(trim(p_customer->>'notes'),''))::text);
  select * into previous from public.agenda_booking_quotes where organization_id=q.organization_id and idempotency_key=p_idempotency_key;
  if found then
    if previous.id<>q.id or previous.request_hash<>v_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    select * into a from public.appointments where id=previous.appointment_id and organization_id=q.organization_id;
    return jsonb_build_object('id',a.id,'public_token',a.public_token,'status',a.status,'starts_at',a.starts_at,'idempotent',true);
  end if;
  if q.appointment_id is not null then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  if q.expires_at<=now() then raise exception 'QUOTE_EXPIRED'; end if;
  select * into s from public.agenda_settings where organization_id=q.organization_id;
  if s.booking_revision<>q.revision or not s.online_booking then raise exception 'QUOTE_CHANGED'; end if;
  if q.starts_at<now()+make_interval(mins=>s.min_notice_minutes) or not public.agenda_time_is_open(q.organization_id,q.professional_id,q.starts_at,q.duration_minutes,q.buffer_minutes) then raise exception 'QUOTE_CHANGED'; end if;
  select id into customer_id from public.customers where organization_id=q.organization_id and phone_digits=regexp_replace(p_customer->>'phone','\D','','g') limit 1;
  insert into public.appointments(organization_id,professional_id,customer_id,customer_name,customer_phone,service_product_id,service_name,price,starts_at,ends_at,buffer_minutes,status,confirmed_at,source,notes,booking_quote_id)
  values(q.organization_id,q.professional_id,customer_id,trim(p_customer->>'name'),trim(p_customer->>'phone'),q.product_id,q.service_name,q.price,q.starts_at,q.ends_at,q.buffer_minutes,
    case when s.require_confirmation then 'pending' else 'confirmed' end,case when s.require_confirmation then null else now() end,'online',nullif(trim(p_customer->>'notes'),''),q.id) returning * into a;
  update public.agenda_booking_quotes set idempotency_key=p_idempotency_key,request_hash=v_request_hash,appointment_id=a.id where id=q.id;
  return jsonb_build_object('id',a.id,'public_token',a.public_token,'status',a.status,'starts_at',a.starts_at,'idempotent',false);
end $$;
revoke all on function public.reserve_agenda_quote(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.reserve_agenda_quote(uuid,uuid,jsonb) to service_role;

create function public.reschedule_agenda_appointment(p_org uuid,p_id uuid,p_start timestamptz,p_public_token uuid default null,p_actor uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.appointments; s public.agenda_settings; duration integer; tz text; local_date date;
begin
  perform public.agenda_lock(p_org);
  if p_public_token is null then perform public.agenda_assert_actor(p_org,p_actor,false); end if;
  select * into a from public.appointments where id=p_id and organization_id=p_org for update;
  if not found or a.status not in ('pending','confirmed') or a.sale_id is not null then raise exception 'APPOINTMENT_NOT_CHANGEABLE'; end if;
  select * into s from public.agenda_settings where organization_id=p_org;
  if p_public_token is not null then
    if a.public_token<>p_public_token or a.starts_at<=now() or not s.online_booking then raise exception 'APPOINTMENT_NOT_CHANGEABLE'; end if;
    if a.service_product_id is null or not exists(select 1 from public.products p join public.agenda_services x on x.organization_id=p.organization_id and x.product_id=p.id
      where p.organization_id=p_org and p.id=a.service_product_id and p.is_active and coalesce(p.visibility,'public')='public' and x.online) then raise exception 'APPOINTMENT_NOT_CHANGEABLE'; end if;
    if a.professional_id is not null and (not exists(select 1 from public.agenda_professionals p where p.organization_id=p_org and p.id=a.professional_id and p.is_active and p.online_visible)
      or (exists(select 1 from public.agenda_professional_services x where x.organization_id=p_org and x.professional_id=a.professional_id)
        and not exists(select 1 from public.agenda_professional_services x where x.organization_id=p_org and x.professional_id=a.professional_id and x.product_id=a.service_product_id))) then raise exception 'APPOINTMENT_NOT_CHANGEABLE'; end if;
    select coalesce(timezone,'America/Asuncion') into tz from public.organization_settings where organization_id=p_org;
    tz:=coalesce(tz,'America/Asuncion'); local_date:=(p_start at time zone tz)::date;
    if p_start<now()+make_interval(mins=>s.min_notice_minutes) or local_date>(now() at time zone tz)::date+s.max_days_ahead then raise exception 'SLOT_UNAVAILABLE'; end if;
  end if;
  duration:=extract(epoch from a.ends_at-a.starts_at)::integer/60;
  if not public.agenda_time_is_open(p_org,a.professional_id,p_start,duration,a.buffer_minutes) then raise exception 'SLOT_UNAVAILABLE'; end if;
  update public.appointments set starts_at=p_start,ends_at=p_start+make_interval(mins=>duration),reminder_sent_at=null,
    status=case when p_public_token is not null and s.require_confirmation then 'pending' else a.status end
  where id=a.id returning * into a;
  return to_jsonb(a);
end $$;
revoke all on function public.reschedule_agenda_appointment(uuid,uuid,timestamptz,uuid,uuid) from public,anon,authenticated;
grant execute on function public.reschedule_agenda_appointment(uuid,uuid,timestamptz,uuid,uuid) to service_role;

-- Server auth supplies tenant + actor; time-off trigger still protects direct writes.
create function public.save_agenda_time_off(p_org uuid,p_prof uuid,p_start timestamptz,p_end timestamptz,p_reason text,p_actor uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.agenda_time_off;
begin
  perform public.agenda_lock(p_org);
  perform public.agenda_assert_actor(p_org,p_actor,true);
  insert into public.agenda_time_off(organization_id,professional_id,starts_at,ends_at,reason,created_by)
    values(p_org,p_prof,p_start,p_end,p_reason,p_actor) returning * into b;
  return to_jsonb(b);
end $$;
revoke all on function public.save_agenda_time_off(uuid,uuid,timestamptz,timestamptz,text,uuid) from public,anon,authenticated;
grant execute on function public.save_agenda_time_off(uuid,uuid,timestamptz,timestamptz,text,uuid) to service_role;
-- These wrappers receive the authenticated actor from the guarded server route.
create function public.agenda_assert_actor(p_org uuid,p_actor uuid,p_manage boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_actor is null or not exists(select 1 from public.organization_members where organization_id=p_org and user_id=p_actor and status='active'
    and (not p_manage or role::text in ('owner','admin'))) then raise exception 'ACTOR_NOT_AUTHORIZED'; end if;
end $$;
revoke all on function public.agenda_assert_actor(uuid,uuid,boolean) from public,anon,authenticated;

create function public.replace_agenda_professional_services(p_org uuid,p_prof uuid,p_services jsonb,p_actor uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare product_id uuid;
begin
  perform public.agenda_lock(p_org); perform public.agenda_assert_actor(p_org,p_actor,true);
  if jsonb_typeof(p_services)<>'array' or jsonb_array_length(p_services)>500 then raise exception 'INVALID_SERVICES'; end if;
  if not exists(select 1 from public.agenda_professionals where organization_id=p_org and id=p_prof) then raise exception 'PROFESSIONAL_NOT_IN_ORGANIZATION'; end if;
  for product_id in select distinct value::uuid from jsonb_array_elements_text(p_services) loop
    if not exists(select 1 from public.products where id=product_id and organization_id=p_org and unit_measure='servicio' and is_active) then raise exception 'SERVICE_UNAVAILABLE'; end if;
  end loop;
  delete from public.agenda_professional_services where organization_id=p_org and professional_id=p_prof;
  insert into public.agenda_professional_services(organization_id,professional_id,product_id)
    select p_org,p_prof,value::uuid from (select distinct value from jsonb_array_elements_text(p_services)) x;
  return jsonb_build_object('id',p_prof,'service_ids',p_services);
end $$;
revoke all on function public.replace_agenda_professional_services(uuid,uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.replace_agenda_professional_services(uuid,uuid,jsonb,uuid) to service_role;

create function public.replace_agenda_professional_rates(p_org uuid,p_prof uuid,p_rates jsonb,p_actor uuid)
returns void language plpgsql security definer set search_path='' as $$
declare row jsonb;
begin
  perform public.agenda_lock(p_org); perform public.agenda_assert_actor(p_org,p_actor,true);
  if jsonb_typeof(p_rates)<>'array' or jsonb_array_length(p_rates)>500 then raise exception 'INVALID_RATES'; end if;
  if not exists(select 1 from public.agenda_professionals where organization_id=p_org and id=p_prof) then raise exception 'PROFESSIONAL_NOT_IN_ORGANIZATION'; end if;
  for row in select value from jsonb_array_elements(p_rates) loop
    if not exists(select 1 from public.products where organization_id=p_org and id=(row->>'product_id')::uuid and unit_measure='servicio' and is_active) then raise exception 'SERVICE_UNAVAILABLE'; end if;
  end loop;
  delete from public.agenda_professional_service_rates where organization_id=p_org and professional_id=p_prof;
  insert into public.agenda_professional_service_rates(organization_id,professional_id,product_id,price,duration_minutes,buffer_minutes)
    select p_org,p_prof,(value->>'product_id')::uuid,(value->>'price')::numeric,(value->>'duration_minutes')::integer,(value->>'buffer_minutes')::integer from jsonb_array_elements(p_rates);
end $$;
revoke all on function public.replace_agenda_professional_rates(uuid,uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.replace_agenda_professional_rates(uuid,uuid,jsonb,uuid) to service_role;

create function public.save_agenda_settings(p_org uuid,p_settings jsonb,p_services jsonb,p_actor uuid)
returns void language plpgsql security definer set search_path='' as $$
declare item jsonb;
begin
  perform public.agenda_lock(p_org); perform public.agenda_assert_actor(p_org,p_actor,true);
  if jsonb_typeof(p_settings)<>'object' or jsonb_typeof(p_services)<>'array' or jsonb_array_length(p_services)>500 then raise exception 'INVALID_SETTINGS'; end if;
  for item in select value from jsonb_array_elements(p_services) loop
    if not exists(select 1 from public.products where organization_id=p_org and id=(item->>'product_id')::uuid and unit_measure='servicio' and is_active) then raise exception 'SERVICE_UNAVAILABLE'; end if;
  end loop;
  insert into public.agenda_settings(organization_id,slot_minutes,opening_hours,online_booking,require_confirmation,min_notice_minutes,max_days_ahead,booking_message,notify_email,professional_selection)
    values(p_org,(p_settings->>'slot_minutes')::integer,p_settings->'opening_hours',(p_settings->>'online_booking')::boolean,(p_settings->>'require_confirmation')::boolean,
      (p_settings->>'min_notice_minutes')::integer,(p_settings->>'max_days_ahead')::integer,nullif(p_settings->>'booking_message',''),coalesce((p_settings->>'notify_email')::boolean,true),coalesce(p_settings->>'professional_selection','optional'))
    on conflict(organization_id) do update set slot_minutes=excluded.slot_minutes,opening_hours=excluded.opening_hours,online_booking=excluded.online_booking,
      require_confirmation=excluded.require_confirmation,min_notice_minutes=excluded.min_notice_minutes,max_days_ahead=excluded.max_days_ahead,
      booking_message=excluded.booking_message,notify_email=excluded.notify_email,professional_selection=excluded.professional_selection,updated_at=now();
  insert into public.agenda_services(organization_id,product_id,duration_minutes,buffer_minutes,online)
    select p_org,(value->>'product_id')::uuid,(value->>'duration_minutes')::integer,coalesce((value->>'buffer_minutes')::integer,0),(value->>'online')::boolean from jsonb_array_elements(p_services)
    on conflict(organization_id,product_id) do update set duration_minutes=excluded.duration_minutes,buffer_minutes=excluded.buffer_minutes,online=excluded.online;
end $$;
revoke all on function public.save_agenda_settings(uuid,jsonb,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.save_agenda_settings(uuid,jsonb,jsonb,uuid) to service_role;

create function public.save_agenda_appointment(p_org uuid,p_id uuid,p_input jsonb,p_actor uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.appointments; product public.products; service public.agenda_services; rate public.agenda_professional_service_rates;
  prof uuid; v_product_id uuid; duration integer; buffer integer; v_price numeric; v_service_name text; start_time timestamptz; v_status text; same_terms boolean;
begin
  perform public.agenda_lock(p_org); perform public.agenda_assert_actor(p_org,p_actor,false);
  if p_id is not null then
    select * into a from public.appointments where organization_id=p_org and id=p_id for update;
    if not found or a.status not in ('pending','confirmed') or a.sale_id is not null then raise exception 'APPOINTMENT_NOT_CHANGEABLE'; end if;
  end if;
  prof:=(p_input->>'professional_id')::uuid; v_product_id:=(p_input->>'service_product_id')::uuid; start_time:=(p_input->>'starts_at')::timestamptz;
  if prof is not null and not exists(select 1 from public.agenda_professionals where organization_id=p_org and id=prof and is_active) then raise exception 'PROFESSIONAL_NOT_IN_ORGANIZATION'; end if;
  if prof is not null and v_product_id is not null and exists(select 1 from public.agenda_professional_services x where x.organization_id=p_org and x.professional_id=prof)
    and not exists(select 1 from public.agenda_professional_services x where x.organization_id=p_org and x.professional_id=prof and x.product_id=v_product_id) then raise exception 'NO_ELIGIBLE_PROFESSIONAL'; end if;
  same_terms:=p_id is not null and a.professional_id is not distinct from prof and a.service_product_id is not distinct from v_product_id;
  if same_terms then
    duration:=extract(epoch from a.ends_at-a.starts_at)::integer/60; buffer:=a.buffer_minutes; v_price:=a.price; v_service_name:=a.service_name;
  else
    if p_id is not null and not coalesce((p_input->>'accept_new_terms')::boolean,false) then raise exception 'NEW_TERMS_ACCEPTANCE_REQUIRED'; end if;
    if v_product_id is not null then
      select * into product from public.products where organization_id=p_org and id=v_product_id and unit_measure='servicio' and is_active;
      if not found then raise exception 'SERVICE_UNAVAILABLE'; end if;
      select * into service from public.agenda_services where organization_id=p_org and product_id=product.id;
      select * into rate from public.agenda_professional_service_rates where organization_id=p_org and professional_id=prof and product_id=product.id;
      duration:=coalesce(rate.duration_minutes,service.duration_minutes,(select slot_minutes from public.agenda_settings where organization_id=p_org),30);
      buffer:=coalesce(rate.buffer_minutes,service.buffer_minutes,0); v_price:=coalesce(rate.price,product.sale_price); v_service_name:=product.name;
    else
      duration:=(p_input->>'duration_minutes')::integer; buffer:=0; v_price:=(p_input->>'price')::numeric; v_service_name:=p_input->>'service_name';
      if duration not between 5 and 720 then raise exception 'INVALID_SERVICE_TERMS'; end if;
    end if;
  end if;
  if not public.agenda_time_is_open(p_org,prof,start_time,duration,buffer) then
    if not coalesce((p_input->>'allow_outside_hours')::boolean,false) then raise exception 'SLOT_UNAVAILABLE'; end if;
    perform public.agenda_assert_actor(p_org,p_actor,true);
  end if;
  if p_id is null then
    v_status:=coalesce(p_input->>'status','confirmed');
    insert into public.appointments(organization_id,professional_id,customer_id,customer_name,customer_phone,service_product_id,service_name,price,starts_at,ends_at,buffer_minutes,status,confirmed_at,source,notes,created_by)
      values(p_org,prof,(p_input->>'customer_id')::uuid,p_input->>'customer_name',nullif(p_input->>'customer_phone',''),v_product_id,v_service_name,v_price,start_time,start_time+make_interval(mins=>duration),buffer,v_status,
        case when v_status='confirmed' then now() end,'dashboard',nullif(p_input->>'notes',''),p_actor) returning * into a;
  else
    update public.appointments set professional_id=prof,customer_id=(p_input->>'customer_id')::uuid,customer_name=p_input->>'customer_name',customer_phone=nullif(p_input->>'customer_phone',''),
      service_product_id=v_product_id,service_name=v_service_name,price=v_price,starts_at=start_time,ends_at=start_time+make_interval(mins=>duration),buffer_minutes=buffer,
      notes=nullif(p_input->>'notes',''),reminder_sent_at=case when starts_at is distinct from start_time then null else reminder_sent_at end
      where id=p_id and organization_id=p_org returning * into a;
  end if;
  return to_jsonb(a);
end $$;
revoke all on function public.save_agenda_appointment(uuid,uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.save_agenda_appointment(uuid,uuid,jsonb,uuid) to service_role;
commit;
