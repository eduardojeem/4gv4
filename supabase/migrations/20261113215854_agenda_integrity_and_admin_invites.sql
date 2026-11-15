begin;

-- Privileged operations are server-only and retain the authenticated operator.
create or replace function public.assert_agenda_admin(p_org uuid, p_actor uuid)
returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  perform public.assert_service_cash_actor(p_actor);
  if not exists(select 1 from public.organization_members where organization_id=p_org and user_id=p_actor and status='active' and role in ('admin','owner')) then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;
end $$;

create or replace function public.agenda_invite_target(p_org uuid,p_prof uuid,p_email text,p_actor uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare prof public.agenda_professionals%rowtype; target uuid;
begin
  perform public.assert_agenda_admin(p_org,p_actor);
  select * into prof from public.agenda_professionals where id=p_prof and organization_id=p_org;
  if not found then return null; end if;
  select id into target from auth.users where lower(email)=lower(trim(p_email));
  return jsonb_build_object('name',prof.name,'linked_user_id',prof.user_id,'user_id',target,'needs_activation',exists(select 1 from auth.users where id=target and email_confirmed_at is null),'is_member',exists(select 1 from public.organization_members where organization_id=p_org and user_id=target and status='active' and role<>'customer'));
end $$;

create or replace function public.link_agenda_employee_checked(p_org uuid,p_prof uuid,p_user uuid,p_email text,p_actor uuid,p_new boolean)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare prof public.agenda_professionals%rowtype;
begin
  perform public.assert_agenda_admin(p_org,p_actor);
  select * into prof from public.agenda_professionals where id=p_prof and organization_id=p_org for update;
  if not found or (prof.user_id is not null and prof.user_id<>p_user) then raise exception 'PROFESSIONAL_LINK_CONFLICT'; end if;
  if not exists(select 1 from auth.users where id=p_user and lower(email)=lower(trim(p_email))) then raise exception 'ACCOUNT_MISMATCH'; end if;
  if p_new then
    -- A new invite must still be unconfirmed; existing accounts keep their roles and profiles.
    if not exists(select 1 from auth.users where id=p_user and email_confirmed_at is null and created_at>now()-interval '5 minutes') then raise exception 'ACCOUNT_NOT_NEW'; end if;
    insert into public.organization_members(organization_id,user_id,role,status) values(p_org,p_user,'seller','active') on conflict(organization_id,user_id) do nothing;
  end if;
  if not exists(select 1 from public.organization_members where organization_id=p_org and user_id=p_user and status='active' and role<>'customer') then raise exception 'ACCOUNT_NOT_TEAM_MEMBER'; end if;
  update public.agenda_professionals set user_id=p_user where id=p_prof and organization_id=p_org;
end $$;

alter table public.agenda_professional_settlements add column if not exists request_payload jsonb;
alter table public.agenda_professional_settlements add column if not exists reversal_cash_movement_id uuid references public.cash_movements(id);
-- Cash and settlement records must only change through the checked transaction.
revoke insert, update, delete on public.agenda_professional_settlements from authenticated;
drop policy if exists "tenant members can read agenda settlements" on public.agenda_professional_settlements;
drop policy if exists "admins and owners can manage agenda settlements" on public.agenda_professional_settlements;
create policy "active admins can read agenda settlements" on public.agenda_professional_settlements for select to authenticated using (exists(select 1 from public.organization_members m where m.organization_id=agenda_professional_settlements.organization_id and m.user_id=(select auth.uid()) and m.status='active' and m.role in ('admin','owner')));

create or replace function public.save_agenda_settlement_checked(p_org uuid,p_actor uuid,p_input jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
  prof public.agenda_professionals%rowtype;
  saved public.agenda_professional_settlements%rowtype;
  first_day date := (p_input->>'periodFrom')::date;
  last_day date := (p_input->>'periodTo')::date;
  tz text; total numeric; count_apts integer; count_paid integer; rate numeric; gross numeric; deduction numeric; covered numeric;
  tips numeric := coalesce((p_input->>'tipsAmount')::numeric,0);
  vales numeric := coalesce((p_input->>'advancesValesAmount')::numeric,0);
  net numeric; movement jsonb; movement_id uuid; session_id uuid; branch uuid; session_count integer;
begin
  perform public.assert_agenda_admin(p_org,p_actor);
  if first_day is null or last_day is null or last_day<first_day or last_day-first_day>30 or tips<0 or vales<0
    or p_input->>'paymentMethod' not in ('cash','transfer','qr') or nullif(p_input->>'receiptCode','') is null then raise exception 'SETTLEMENT_INVALID'; end if;
  select * into prof from public.agenda_professionals where organization_id=p_org and id=(p_input->>'professionalId')::uuid for update;
  if not found then raise exception 'PROFESSIONAL_NOT_FOUND'; end if;
  select * into saved from public.agenda_professional_settlements where organization_id=p_org and receipt_code=p_input->>'receiptCode';
  if found then
    if saved.status<>'paid' or saved.request_payload is distinct from p_input then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return to_jsonb(saved);
  end if;
  if exists(select 1 from public.agenda_professional_settlements where organization_id=p_org and professional_id=prof.id and status='paid' and period_from<=last_day and period_to>=first_day and (period_from<>first_day or period_to<>last_day)) then raise exception 'SETTLEMENT_PERIOD_OVERLAP'; end if;
  select coalesce(timezone,'America/Asuncion') into tz from public.organization_settings where organization_id=p_org;
  tz:=coalesce(tz,'America/Asuncion');
  select coalesce(sum(price),0),count(*) into total,count_apts from public.appointments
    where organization_id=p_org and professional_id=prof.id and status='completed'
    and starts_at >= first_day::timestamp at time zone tz and starts_at < (last_day+1)::timestamp at time zone tz;
  rate:=case when prof.remuneration_type='chair_rental' then 100 when prof.remuneration_type='fixed' then 0 else coalesce(prof.commission_rate_services,50) end;
  gross:=round(total*rate/100,2);
  deduction:=case when prof.remuneration_type='chair_rental' then coalesce(prof.commission_fixed_deduction,0) when prof.remuneration_type='fixed' then 0 else coalesce(prof.commission_fixed_deduction,0)*count_apts end;
  select coalesce(sum(net_amount+advances_vales_amount-tips_amount),0),coalesce(sum(appointments_count),0) into covered,count_paid from public.agenda_professional_settlements where organization_id=p_org and professional_id=prof.id and status='paid' and period_from=first_day and period_to=last_day;
  net:=round(greatest(0,gross-deduction)-covered+tips-vales,2);
  if net<=0 or abs(net-coalesce((p_input->>'netAmount')::numeric,-1))>0.01 then raise exception 'SETTLEMENT_CHANGED'; end if;
  if p_input->>'paymentMethod'='cash' then
    select count(*) into session_count from public.cash_closures c join public.cash_registers r on r.id::text=c.register_id and r.organization_id=c.organization_id and r.branch_id=c.branch_id where c.organization_id=p_org and c.date is null and r.is_active=true;
    if session_count<>1 then raise exception 'SETTLEMENT_CASH_SESSION_REQUIRED'; end if;
    select c.id,c.branch_id into session_id,branch from public.cash_closures c join public.cash_registers r on r.id::text=c.register_id and r.organization_id=c.organization_id and r.branch_id=c.branch_id where c.organization_id=p_org and c.date is null and r.is_active=true;
    movement:=public.server_record_cash_movement_atomic(p_actor,p_org,branch,session_id,'cash_out',net,'Liquidación: '||prof.name||' ('||(p_input->>'receiptCode')||')');
    movement_id:=(movement->>'id')::uuid;
    if movement_id is null then raise exception 'SETTLEMENT_CASH_FAILED'; end if;
  end if;
  insert into public.agenda_professional_settlements(organization_id,professional_id,professional_name,receipt_code,period_preset,period_from,period_to,appointments_count,total_billed,commission_rate,commission_amount,deductions_amount,advances_vales_amount,tips_amount,net_amount,remuneration_type,payment_method,payment_reference,notes,cash_movement_id,status,created_by,request_payload)
  values(p_org,prof.id,prof.name,p_input->>'receiptCode',coalesce(p_input->>'periodPreset','this_week'),first_day,last_day,greatest(0,count_apts-count_paid),total,rate,gross,deduction,vales,tips,net,coalesce(prof.remuneration_type,'commission'),p_input->>'paymentMethod',p_input->>'paymentReference',p_input->>'notes',movement_id,'paid',p_actor,p_input) returning * into saved;
  return to_jsonb(saved);
end $$;

create or replace function public.cancel_agenda_settlement_checked(p_org uuid,p_actor uuid,p_id uuid)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare saved public.agenda_professional_settlements%rowtype; movement public.cash_movements%rowtype; reversal jsonb;
begin
  perform public.assert_agenda_admin(p_org,p_actor);
  -- Same lock order as payment, to serialize cancellation against new payments.
  perform 1 from public.agenda_professionals where organization_id=p_org and id=(select professional_id from public.agenda_professional_settlements where id=p_id and organization_id=p_org) for update;
  select * into saved from public.agenda_professional_settlements where id=p_id and organization_id=p_org for update;
  if not found then raise exception 'SETTLEMENT_NOT_FOUND'; end if;
  if saved.status='cancelled' then return to_jsonb(saved); end if;
  if saved.cash_movement_id is not null then
    select * into movement from public.cash_movements where id=saved.cash_movement_id and organization_id=p_org;
    if not found then raise exception 'SETTLEMENT_CASH_FAILED'; end if;
    reversal:=public.server_record_cash_movement_atomic(p_actor,p_org,movement.branch_id,movement.session_id,'cash_in',saved.net_amount,'Anulación liquidación '||saved.receipt_code);
    if reversal->>'id' is null then raise exception 'SETTLEMENT_CASH_FAILED'; end if;
  end if;
  update public.agenda_professional_settlements set status='cancelled',reversal_cash_movement_id=(reversal->>'id')::uuid where id=p_id returning * into saved;
  return to_jsonb(saved);
end $$;

revoke all on function public.assert_agenda_admin(uuid,uuid),public.agenda_invite_target(uuid,uuid,text,uuid),public.link_agenda_employee_checked(uuid,uuid,uuid,text,uuid,boolean),public.save_agenda_settlement_checked(uuid,uuid,jsonb),public.cancel_agenda_settlement_checked(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.assert_agenda_admin(uuid,uuid),public.agenda_invite_target(uuid,uuid,text,uuid),public.link_agenda_employee_checked(uuid,uuid,uuid,text,uuid,boolean),public.save_agenda_settlement_checked(uuid,uuid,jsonb),public.cancel_agenda_settlement_checked(uuid,uuid,uuid) to service_role;

commit;
