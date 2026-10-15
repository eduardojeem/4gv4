-- Existing receipts and sales remain immutable. Amendments change the receivable only.
begin;
-- The application grants/collects through server RPCs. Retire legacy direct browser
-- writes, otherwise a seller could bypass the editor and the mandatory audit.
revoke insert,update,delete on public.customer_credits,public.credit_installments,public.credit_payments from public,anon,authenticated;
grant select,insert,update,delete on public.customer_credits,public.credit_installments,public.credit_payments to service_role;
create table public.credit_amendments (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 credit_id uuid not null references public.customer_credits(id),
 actor_id uuid not null references auth.users(id),
 action text not null check(action in ('edit_terms','reschedule','adjust_balance','correct_payment_date')),
 reason text not null check(length(trim(reason)) between 5 and 500),
 debt_delta numeric not null default 0,
 before_state jsonb not null,
 after_state jsonb not null,
 created_at timestamptz not null default clock_timestamp()
);
create index credit_amendments_credit_history on public.credit_amendments(organization_id,credit_id,created_at desc);
alter table public.credit_amendments enable row level security;
revoke all on public.credit_amendments from public,anon,authenticated,service_role;
grant select,insert on public.credit_amendments to service_role;

create function public.get_credit_amendment_state(p_organization_id uuid,p_credit_id uuid,p_actor_id uuid)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare state jsonb; tz text; currency text;
begin
 if not exists(select 1 from public.organization_members where organization_id=p_organization_id and user_id=p_actor_id
   and status='active' and role::text in ('owner','admin')) then raise exception 'AMEND_FORBIDDEN'; end if;
 select jsonb_build_object('credit',to_jsonb(c),
   'installments',coalesce((select jsonb_agg(to_jsonb(i) order by i.installment_number,i.id) from public.credit_installments i where i.credit_id=c.id),'[]'),
   'payments',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at,p.id) from public.credit_payments p where p.credit_id=c.id),'[]'))
 into state from public.customer_credits c where c.id=p_credit_id and c.organization_id=p_organization_id;
 if state is null then raise exception 'AMEND_NOT_FOUND'; end if;
 select coalesce(nullif(s.timezone,''),'America/Asuncion'),coalesce(s.currency,'PYG') into tz,currency from public.organization_settings s where s.organization_id=p_organization_id;
 tz:=coalesce(tz,'America/Asuncion');
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=tz) then tz:='America/Asuncion'; end if;
 return state||jsonb_build_object('version',md5(state::text),'timeZone',tz,'fractionDigits',case when coalesce(currency,'PYG') in ('PYG','CLP') then 0 else 2 end,'history',coalesce((
   select jsonb_agg(to_jsonb(a) order by a.created_at desc,a.id) from
    (select * from public.credit_amendments where organization_id=p_organization_id and credit_id=p_credit_id order by created_at desc,id limit 100) a),'[]'));
end $$;
revoke all on function public.get_credit_amendment_state(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_credit_amendment_state(uuid,uuid,uuid) to service_role;

create function public.amend_customer_credit_atomic(p_organization_id uuid,p_credit_id uuid,p_actor_id uuid,p_request jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare
 credit public.customer_credits%rowtype;
 installment public.credit_installments%rowtype;
 payment public.credit_payments%rowtype;
 collection public.customer_collection_requests%rowtype;
 movement public.cash_movements%rowtype;
 cash_session public.cash_closures%rowtype;
 before_state jsonb; after_state jsonb; entry jsonb;
 action text:=p_request->>'action'; reason text:=trim(p_request->>'reason'); tz text;
 total numeric; paid numeric; delta numeric:=0; component numeric; rate numeric; count_plan integer;
 new_date timestamptz; previous_day date; next_day date; customer_id uuid; audit_id uuid; digits integer;
begin
 if not exists(select 1 from public.organization_members where organization_id=p_organization_id and user_id=p_actor_id
   and status='active' and role::text in ('owner','admin')) then raise exception 'AMEND_FORBIDDEN'; end if;
 if jsonb_typeof(p_request) is distinct from 'object' or reason is null or length(reason) not between 5 and 500
   or action is null or action not in ('edit_terms','reschedule','adjust_balance','correct_payment_date') then raise exception 'AMEND_INVALID'; end if;
 select c.customer_id into customer_id from public.customer_credits c where c.id=p_credit_id and c.organization_id=p_organization_id;
 if not found then raise exception 'AMEND_NOT_FOUND'; end if;
 -- Same first lock as collection and concession, then a stable order for the complete plan.
 perform 1 from public.customers c where c.id=customer_id and c.organization_id=p_organization_id for update;
 select * into credit from public.customer_credits where id=p_credit_id and organization_id=p_organization_id for update;
 perform 1 from public.credit_installments where credit_id=p_credit_id order by id for update;
 perform 1 from public.credit_payments where credit_id=p_credit_id order by id for update;
 before_state:=public.get_credit_amendment_state(p_organization_id,p_credit_id,p_actor_id);
 if p_request->>'expectedVersion' is distinct from before_state->>'version' then raise exception 'AMEND_CONFLICT'; end if;
 tz:=before_state->>'timeZone';
 digits:=(before_state->>'fractionDigits')::integer;
 if credit.status='cancelled' then raise exception 'AMEND_CLOSED_CREDIT'; end if;
 if action<>'correct_payment_date' and credit.status not in ('active','defaulted') then raise exception 'AMEND_CLOSED_CREDIT'; end if;
 if action='edit_terms' then
   if exists(select 1 from public.credit_payments where credit_id=p_credit_id)
     or exists(select 1 from public.credit_installments where credit_id=p_credit_id and (coalesce(amount_paid,0)>0 or paid_at is not null or status='paid')) then raise exception 'AMEND_HAS_PAYMENTS'; end if;
   if jsonb_typeof(p_request->'plan') is distinct from 'array' then raise exception 'AMEND_INVALID'; end if;
   count_plan:=jsonb_array_length(p_request->'plan'); rate:=(p_request->>'interestRate')::numeric;
   if count_plan not between 1 and 60 or rate is null or rate not between 0 and 100
     or coalesce(p_request->>'frequency','') not in ('weekly','biweekly','monthly') then raise exception 'AMEND_INVALID'; end if;
   total:=0;
   for entry in select value from jsonb_array_elements(p_request->'plan') loop
     if (entry->>'amount')::numeric is null or (entry->>'amount')::numeric<=0 or (entry->>'amount')::numeric>1000000000
       or (entry->>'amount')::numeric<>round((entry->>'amount')::numeric,digits)
       or coalesce((entry->>'principalComponent')::numeric,-1)<0 or coalesce((entry->>'interestComponent')::numeric,-1)<0
       or (entry->>'amount')::numeric is distinct from ((entry->>'principalComponent')::numeric+(entry->>'interestComponent')::numeric)
       or (entry->>'dueDate') is null or (entry->>'dueDate') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'AMEND_INVALID'; end if;
     perform (entry->>'dueDate')::date;
     total:=total+(entry->>'amount')::numeric;
   end loop;
   if total>1000000000 then raise exception 'AMEND_INVALID'; end if;
   delta:=total-credit.principal;
   delete from public.credit_installments where credit_id=p_credit_id;
   insert into public.credit_installments(credit_id,sale_id,installment_number,due_date,amount,principal_component,interest_component,status)
     select p_credit_id,credit.sale_id,n::integer,((e->>'dueDate')::date+time '12:00') at time zone tz,
       (e->>'amount')::numeric,(e->>'principalComponent')::numeric,(e->>'interestComponent')::numeric,
       case when (e->>'dueDate')::date<(now() at time zone tz)::date then 'late' else 'pending' end
     from jsonb_array_elements(p_request->'plan') with ordinality as x(e,n);
   update public.customer_credits set principal=total,interest_rate=rate,term_months=count_plan,
     metadata=coalesce(metadata,'{}')||jsonb_build_object('frequency',p_request->>'frequency') where id=p_credit_id;
 elsif action='reschedule' then
   if jsonb_typeof(p_request->'installments') is distinct from 'array'
     or jsonb_array_length(p_request->'installments') not between 1 and 200 then raise exception 'AMEND_INVALID'; end if;
   if (select count(distinct e->>'id') from jsonb_array_elements(p_request->'installments') e)<>jsonb_array_length(p_request->'installments') then raise exception 'AMEND_INVALID'; end if;
   for entry in select value from jsonb_array_elements(p_request->'installments') loop
     select * into installment from public.credit_installments where id=(entry->>'id')::uuid and credit_id=p_credit_id;
     if not found or installment.status='paid' or coalesce(installment.amount_paid,0)>=installment.amount then raise exception 'AMEND_INSTALLMENT'; end if;
     if coalesce(entry->>'dueDate','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'AMEND_INVALID'; end if;
     new_date:=((entry->>'dueDate')::date+time '12:00') at time zone tz;
     update public.credit_installments set due_date=new_date,updated_at=clock_timestamp(),
       status=case when (new_date at time zone tz)::date<(now() at time zone tz)::date then 'late' else 'pending' end where id=installment.id;
   end loop;
 elsif action='adjust_balance' then
   select * into installment from public.credit_installments where id=(p_request->>'installmentId')::uuid and credit_id=p_credit_id;
   if not found or installment.status='paid' or coalesce(installment.amount_paid,0)>=installment.amount then raise exception 'AMEND_INSTALLMENT'; end if;
   total:=(p_request->>'amount')::numeric;
   select coalesce(sum(amount),0) into paid from public.credit_payments where installment_id=installment.id;
   paid:=greatest(paid,coalesce(installment.amount_paid,0));
   if total is null or total<=0 or total>1000000000 or total<>round(total,digits) then raise exception 'AMEND_INVALID'; end if;
   if total<paid then raise exception 'AMEND_BELOW_PAID'; end if;
   delta:=total-installment.amount;
   component:=round(total*least(1,greatest(0,installment.principal_component/nullif(installment.amount,0))),digits);
   update public.credit_installments set amount=total,principal_component=coalesce(component,total),interest_component=total-coalesce(component,total),
     status=case when total<=paid then 'paid' when (due_date at time zone tz)::date<(now() at time zone tz)::date then 'late' else 'pending' end,
     paid_at=case when total<=paid then coalesce(paid_at,(select max(created_at) from public.credit_payments where installment_id=installment.id)) else null end,
     updated_at=clock_timestamp() where id=installment.id;
   update public.customer_credits set principal=principal+delta,
     status=case when not exists(select 1 from public.credit_installments where credit_id=p_credit_id and amount>coalesce(amount_paid,0)) then 'completed' else status end where id=p_credit_id;
 else
   select * into payment from public.credit_payments where id=(p_request->>'paymentId')::uuid and credit_id=p_credit_id;
   if not found then raise exception 'AMEND_NOT_FOUND'; end if;
   new_date:=(p_request->>'paidAt')::timestamptz;
   if new_date is null or not isfinite(new_date) or new_date>clock_timestamp() or new_date<credit.start_date then raise exception 'AMEND_PAYMENT_DATE'; end if;
   -- A single payment cannot rewrite a multi-debt receipt or an excess-to-store-credit transaction.
   if (select count(*) from public.customer_collection_requests r where r.organization_id=p_organization_id
     and exists(select 1 from jsonb_array_elements(r.result->'allocations') a where a->>'paymentId'=payment.id::text and a->>'type'='installment'))<>1 then raise exception 'AMEND_PAYMENT_UNLINKED'; end if;
   select * into collection from public.customer_collection_requests r where r.organization_id=p_organization_id
     and exists(select 1 from jsonb_array_elements(r.result->'allocations') a where a->>'paymentId'=payment.id::text and a->>'type'='installment') for update;
   if not found then raise exception 'AMEND_PAYMENT_UNLINKED'; end if;
   if jsonb_array_length(collection.result->'allocations')<>1 or coalesce((collection.result->>'excessToStoreCredit')::numeric,0)<>0 then raise exception 'AMEND_CONSOLIDATED_PAYMENT'; end if;
   previous_day:=(payment.created_at at time zone tz)::date; next_day:=(new_date at time zone tz)::date;
   -- Serialize with closure, and reject both source and destination closed accounting days.
   perform 1 from public.cash_closures where organization_id=p_organization_id and branch_id=collection.branch_id order by id for update;
   if exists(select 1 from public.cash_closures c where c.organization_id=p_organization_id and c.branch_id=collection.branch_id
     and (c.date is not null or c.status in ('cerrada','closed','bloqueada','suspendida'))
     and ((c.created_at at time zone tz)::date<=previous_day and (coalesce(c.date,c.updated_at,now()) at time zone tz)::date>=previous_day
       or (c.created_at at time zone tz)::date<=next_day and (coalesce(c.date,c.updated_at,now()) at time zone tz)::date>=next_day)) then raise exception 'AMEND_CASH_CLOSED'; end if;
   if payment.payment_method='cash' then
     if (select count(*) from public.cash_movements m where m.organization_id=p_organization_id and m.branch_id=collection.branch_id
       and m.reason='Cobro crédito · '||collection.id::text and m.amount=payment.amount and m.type::text in ('cash_in','ingreso') and m.payment_method in ('cash','efectivo'))<>1 then raise exception 'AMEND_PAYMENT_UNLINKED'; end if;
     select m.* into movement from public.cash_movements m where m.organization_id=p_organization_id and m.branch_id=collection.branch_id
       and m.reason='Cobro crédito · '||collection.id::text and m.amount=payment.amount and m.type::text in ('cash_in','ingreso') and m.payment_method in ('cash','efectivo') for update;
     select * into cash_session from public.cash_closures where id=movement.session_id and organization_id=p_organization_id and branch_id=collection.branch_id;
     if not found or cash_session.date is not null or cash_session.status not in ('abierta','open')
       or new_date<cash_session.created_at then raise exception 'AMEND_CASH_CLOSED'; end if;
     before_state:=before_state||jsonb_build_object('cashMovement',to_jsonb(movement));
     update public.cash_movements set created_at=new_date,timestamp=new_date where id=movement.id;
   end if;
   update public.credit_payments set created_at=new_date where id=payment.id;
   -- The legacy payment trigger preserves paid_at. Recompute its actual completion instant explicitly.
   update public.credit_installments i set paid_at=case when coalesce(i.amount_paid,0)>=i.amount
     then (select max(created_at) from public.credit_payments where installment_id=i.id) else null end where i.id=payment.installment_id;
 end if;
 update public.customer_credits set updated_at=clock_timestamp() where id=p_credit_id;
 after_state:=public.get_credit_amendment_state(p_organization_id,p_credit_id,p_actor_id);
 if action='correct_payment_date' and movement.id is not null then
   after_state:=after_state||jsonb_build_object('cashMovement',(select to_jsonb(m) from public.cash_movements m where m.id=movement.id));
 end if;
 insert into public.credit_amendments(organization_id,credit_id,actor_id,action,reason,debt_delta,before_state,after_state)
 values(p_organization_id,p_credit_id,p_actor_id,action,reason,delta,before_state-array['history'],after_state-array['history']) returning id into audit_id;
 return jsonb_build_object('amendmentId',audit_id,'version',after_state->>'version','debtDelta',delta);
end $$;
revoke all on function public.amend_customer_credit_atomic(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.amend_customer_credit_atomic(uuid,uuid,uuid,jsonb) to service_role;
commit;
