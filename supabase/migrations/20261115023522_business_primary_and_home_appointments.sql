begin;
alter table public.organizations add column primary_activity text not null default 'auto' check(primary_activity in ('auto','pos','agenda','repairs'));
alter table public.appointments
 add column attention_mode text not null default 'local' check(attention_mode in ('local','home')),
 add column service_address text,
 add column arrival_instructions text,
 add column travel_before_minutes integer not null default 0 check(travel_before_minutes between 0 and 180),
 add column travel_after_minutes integer not null default 0 check(travel_after_minutes between 0 and 180),
 add column occupied_from timestamptz;
alter table public.appointments add constraint appointment_home_details check(
 (attention_mode='home' and length(btrim(coalesce(service_address,''))) between 3 and 500)
 or (attention_mode='local' and service_address is null and travel_before_minutes=0 and travel_after_minutes=0));
alter table public.appointments add constraint appointment_arrival_instructions check(length(coalesce(arrival_instructions,''))<=1000);
update public.appointments set occupied_from=starts_at;
alter table public.appointments alter column occupied_from set not null;
alter table public.appointments drop constraint appointments_occupied_interval;
alter table public.appointments add constraint appointments_occupied_interval check(occupied_from=starts_at-make_interval(mins=>travel_before_minutes) and occupied_until=ends_at+make_interval(mins=>buffer_minutes+travel_after_minutes));
-- The service start follows slot increments; departure itself need not do so.
do $$ declare definition text; begin
 select pg_get_functiondef('public.agenda_time_is_open(uuid,uuid,timestamptz,integer,integer)'::regprocedure) into definition;
 definition:=replace(definition,'public.agenda_time_is_open(','public.agenda_home_time_is_open(');
 if position('and mod(extract(epoch from local_start-lo)::integer,s.slot_minutes*60)=0' in definition)=0 then raise exception 'Unexpected agenda opening-hours definition'; end if;
 definition:=replace(definition,'and mod(extract(epoch from local_start-lo)::integer,s.slot_minutes*60)=0','');
 execute definition;
end $$;
revoke all on function public.agenda_home_time_is_open(uuid,uuid,timestamptz,integer,integer) from public,anon,authenticated;
create or replace function public.set_appointment_occupied_until() returns trigger language plpgsql security definer set search_path='' as $$
begin
 new.occupied_from:=new.starts_at-make_interval(mins=>new.travel_before_minutes);
 new.occupied_until:=new.ends_at+make_interval(mins=>new.buffer_minutes+new.travel_after_minutes);
 if tg_op='UPDATE' and old.sale_id is not null and (new.attention_mode is distinct from old.attention_mode or new.service_address is distinct from old.service_address or new.arrival_instructions is distinct from old.arrival_instructions or new.travel_before_minutes<>old.travel_before_minutes or new.travel_after_minutes<>old.travel_after_minutes) then raise exception 'APPOINTMENT_ALREADY_PAID'; end if;
 if new.attention_mode='home' and new.status in ('pending','confirmed') and not public.agenda_home_time_is_open(new.organization_id,new.professional_id,new.occupied_from,(extract(epoch from new.ends_at-new.starts_at)/60)::integer+new.travel_before_minutes,new.buffer_minutes+new.travel_after_minutes) then raise exception 'HOME_TRAVEL_OUTSIDE_HOURS'; end if;
 return new;
end $$;
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
    and a.occupied_from<new.occupied_until and new.occupied_from<a.occupied_until) then raise exception 'APPOINTMENT_OVERLAP'; end if;
  if exists(select 1 from public.agenda_time_off b where b.organization_id=new.organization_id
    and (b.professional_id is null or new.professional_id is null or b.professional_id=new.professional_id)
    and b.starts_at<new.occupied_until and new.occupied_from<b.ends_at) then raise exception 'TIME_OFF_CONFLICT'; end if;
  return new;
end $$;

create or replace function public.agenda_time_off_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
  org := case when tg_op='DELETE' then old.organization_id else new.organization_id end;
  perform public.agenda_lock(org);
  if tg_op='DELETE' then return old; end if;
  if tg_op='UPDATE' and old.organization_id is distinct from new.organization_id then raise exception 'AGENDA_TENANT_IMMUTABLE'; end if;
  if exists(select 1 from public.appointments a where a.organization_id=org and a.status in ('pending','confirmed')
    and (new.professional_id is null or a.professional_id is null or a.professional_id=new.professional_id)
    and a.occupied_from<new.ends_at and new.starts_at<a.occupied_until) then raise exception 'TIME_OFF_CONFLICT'; end if;
  return new;
end $$;

-- Preserve the latest quote logic, changing only the beginning of occupied intervals.
do $$ declare definition text; begin
 select pg_get_functiondef('public.create_agenda_quote(uuid,uuid,uuid,timestamptz)'::regprocedure) into definition;
 if position('a.starts_at<' in definition)=0 then raise exception 'Unexpected agenda quote definition'; end if;
 execute replace(definition,'a.starts_at<','a.occupied_from<');
end $$;
-- Derive from the installed atomic writer to retain accepted-terms and POS fixes.
-- Persist the full visit in the same INSERT/UPDATE, avoiding intermediate conflicts.
do $$ declare definition text; begin
 select pg_get_functiondef('public.save_agenda_appointment_base_v1(uuid,uuid,jsonb,uuid)'::regprocedure) into definition;
 if position('insert into public.appointments(organization_id,professional_id' in definition)=0 or position('values(p_org,prof,' in definition)=0 or position('set professional_id=prof,' in definition)=0 then raise exception 'Unexpected agenda save definition'; end if;
 definition:=replace(definition,'public.save_agenda_appointment_base_v1(','public.save_agenda_home_appointment_base(');
 definition:=replace(definition,'insert into public.appointments(organization_id,professional_id','insert into public.appointments(attention_mode,service_address,arrival_instructions,travel_before_minutes,travel_after_minutes,organization_id,professional_id');
 definition:=replace(definition,'values(p_org,prof,', $insert$values(coalesce(p_input->>'attention_mode','local'),case when p_input->>'attention_mode'='home' then nullif(btrim(p_input->>'service_address'),'') end,case when p_input->>'attention_mode'='home' then nullif(btrim(p_input->>'arrival_instructions'),'') end,case when p_input->>'attention_mode'='home' then coalesce((p_input->>'travel_before_minutes')::integer,0) else 0 end,case when p_input->>'attention_mode'='home' then coalesce((p_input->>'travel_after_minutes')::integer,0) else 0 end,p_org,prof,$insert$);
 definition:=replace(definition,'set professional_id=prof,', $update$set attention_mode=coalesce(p_input->>'attention_mode',attention_mode),service_address=case when p_input->>'attention_mode'='local' then null when p_input ? 'service_address' then nullif(btrim(p_input->>'service_address'),'') else service_address end,arrival_instructions=case when p_input->>'attention_mode'='local' then null when p_input ? 'arrival_instructions' then nullif(btrim(p_input->>'arrival_instructions'),'') else arrival_instructions end,travel_before_minutes=case when p_input->>'attention_mode'='local' then 0 else coalesce((p_input->>'travel_before_minutes')::integer,travel_before_minutes) end,travel_after_minutes=case when p_input->>'attention_mode'='local' then 0 else coalesce((p_input->>'travel_after_minutes')::integer,travel_after_minutes) end,professional_id=prof,$update$);
 execute definition;
 select pg_get_functiondef('public.save_agenda_appointment(uuid,uuid,jsonb,uuid)'::regprocedure) into definition;
 if position('public.save_agenda_appointment_base_v1(' in definition)=0 then raise exception 'Unexpected accepted-terms wrapper'; end if;
 definition:=replace(definition,'public.save_agenda_appointment(','public.save_agenda_home_appointment(');
 definition:=replace(definition,'public.save_agenda_appointment_base_v1(','public.save_agenda_home_appointment_base(');
 execute definition;
end $$;
revoke all on function public.save_agenda_home_appointment_base(uuid,uuid,jsonb,uuid) from public,anon,authenticated,service_role;
revoke all on function public.save_agenda_home_appointment(uuid,uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.save_agenda_home_appointment(uuid,uuid,jsonb,uuid) to service_role;
create or replace function public.agenda_booking_version() returns integer language sql stable set search_path='' as $$select 4$$;
commit;
