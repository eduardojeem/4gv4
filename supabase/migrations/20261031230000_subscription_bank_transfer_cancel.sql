-- Una organización solo puede tener una solicitud de transferencia abierta.
-- Si se eligió mal el plan, quedaba trabada hasta que el superadmin la
-- rechazara. Ahora el dueño o un admin pueden cancelarla mientras todavía
-- espera el comprobante; con el comprobante enviado ya la revisa el superadmin.
-- Mismo modelo que el resto: solo service_role, actor verificado en la base.

alter table public.subscription_bank_transfer_requests
  drop constraint subscription_bank_transfer_requests_status_check;
alter table public.subscription_bank_transfer_requests
  add constraint subscription_bank_transfer_requests_status_check
  check (status in ('awaiting_receipt','pending_review','approved','rejected','cancelled'));
alter table public.subscription_bank_transfer_requests
  add column cancelled_at timestamptz;

create function public.cancel_subscription_bank_transfer(p_organization_id uuid,p_actor_id uuid,p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_request public.subscription_bank_transfer_requests%rowtype;
begin
 perform public.subscription_transfer_assert_actor(p_actor_id,p_organization_id,false);
 select * into v_request from public.subscription_bank_transfer_requests where id=p_request_id and organization_id=p_organization_id for update;
 if not found then raise exception 'TRANSFER_NOT_FOUND';end if;
 if v_request.status='cancelled' then return to_jsonb(v_request);end if;
 if v_request.status<>'awaiting_receipt' then raise exception 'TRANSFER_INVALID_STATE';end if;
 update public.subscription_bank_transfer_requests set status='cancelled',cancelled_at=now(),updated_at=now() where id=p_request_id returning * into v_request;
 insert into public.tenant_audit_log(organization_id,user_id,action,resource,resource_id,metadata) values(p_organization_id,p_actor_id,'subscription.bank_transfer.cancelled','subscription_bank_transfer_requests',p_request_id::text,jsonb_build_object('plan',v_request.plan_code,'amount',v_request.amount));
 return to_jsonb(v_request);
end;$$;

revoke all on function public.cancel_subscription_bank_transfer(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.cancel_subscription_bank_transfer(uuid,uuid,uuid) to service_role;
