begin;
-- Serialize administrative access checks with membership revocation.
create or replace function public.assert_agenda_admin(p_org uuid, p_actor uuid)
returns void language plpgsql security invoker set search_path = pg_catalog, public as $body$
begin
  perform public.assert_service_cash_actor(p_actor);
  perform 1 from public.organization_members where organization_id=p_org and user_id=p_actor and status='active' and role in ('admin','owner') for share;
  if not found then raise exception 'ACTOR_NOT_AUTHORIZED'; end if;
end $body$;
alter table public.agenda_professional_settlements add column if not exists cancelled_by uuid references auth.users(id);
alter table public.agenda_professional_settlements add column if not exists cancelled_at timestamptz;
alter table public.agenda_professional_settlements add column if not exists cancellation_reason text;
drop function public.cancel_agenda_settlement_checked(uuid,uuid,uuid);
create or replace function public.cancel_agenda_settlement_checked(p_org uuid,p_actor uuid,p_id uuid,p_reason text)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare saved public.agenda_professional_settlements%rowtype; movement public.cash_movements%rowtype; reversal jsonb;
begin
  perform public.assert_agenda_admin(p_org,p_actor);
  if length(trim(coalesce(p_reason,'')))<5 or length(p_reason)>300 then raise exception 'SETTLEMENT_REASON_REQUIRED'; end if;
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
  update public.agenda_professional_settlements set status='cancelled',cancelled_by=p_actor,cancelled_at=now(),cancellation_reason=trim(p_reason),reversal_cash_movement_id=(reversal->>'id')::uuid where id=p_id returning * into saved;
  return to_jsonb(saved);
end $$;

revoke all on function public.cancel_agenda_settlement_checked(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.cancel_agenda_settlement_checked(uuid,uuid,uuid,text) to service_role;
commit;
