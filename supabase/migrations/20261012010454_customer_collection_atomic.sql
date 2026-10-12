-- Additive: existing financial functions remain available to their consumers.
create table public.customer_collection_requests (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 customer_id uuid not null references public.customers(id),
 actor_id uuid not null references auth.users(id),
 branch_id uuid not null references public.branches(id),
 idempotency_key text not null check(length(idempotency_key) between 8 and 120),
 request jsonb not null,
 result jsonb,
 created_at timestamptz not null default now(),
 unique(organization_id,idempotency_key)
);
alter table public.customer_collection_requests enable row level security;
revoke all on public.customer_collection_requests from public,anon,authenticated;
grant select,insert,update on public.customer_collection_requests to service_role;

create function public.collect_customer_payment_atomic(
 p_organization_id uuid,p_customer_id uuid,p_actor_id uuid,p_branch_id uuid,p_request jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 stored public.customer_collection_requests%rowtype;
 request_identity jsonb;
 key text:=trim(p_request->>'idempotencyKey');
 method text:=p_request->>'paymentMethod';
 amount numeric;
 remaining numeric;
 allocated numeric;
 pending numeric;
 paid numeric;
 total numeric;
 parts_total numeric;
 session_id uuid;
 receipt_id uuid;
 payment_id uuid;
 candidate record;
 installment public.credit_installments%rowtype;
 repair public.repairs%rowtype;
 repair_result jsonb;
 allocations jsonb:='[]';
 candidates jsonb:='[]';
 explicit jsonb;
 saved_result jsonb;
 credit_balances jsonb;
 count_explicit integer;
begin
 if not exists(select 1 from public.organization_members where organization_id=p_organization_id
   and user_id=p_actor_id and status='active' and role::text in ('owner','admin','manager','seller'))
   or not exists(select 1 from public.branches where id=p_branch_id and organization_id=p_organization_id and is_active)
   or not public.user_has_branch_access(p_branch_id,p_actor_id) then
   raise exception 'COLLECTION_FORBIDDEN';
 end if;
 if key is null or length(key) not between 8 and 120 or method not in ('cash','card','transfer')
   or jsonb_typeof(p_request->'amount') is distinct from 'number' then
   raise exception 'COLLECTION_INVALID_REQUEST';
 end if;
 amount:=(p_request->>'amount')::numeric;
 if amount<=0 or amount>1000000000 or amount<>trunc(amount)
   or coalesce(p_request->>'mode','auto') not in ('auto','manual')
   or (method='transfer' and nullif(trim(p_request->>'referenceNumber'),'') is null)
   or (method='card' and nullif(trim(p_request->>'voucherNumber'),'') is null) then
   raise exception 'COLLECTION_INVALID_REQUEST';
 end if;
 request_identity:=jsonb_build_object('customer',p_customer_id,'branch',p_branch_id,'actor',p_actor_id,'payload',p_request);
 -- Serialize identical keys even when the customer differs; a retry returns exact persisted result.
 perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||':'||key,0));
 select * into stored from public.customer_collection_requests where organization_id=p_organization_id and idempotency_key=key;
 if found then
   if stored.request is distinct from request_identity then raise exception 'COLLECTION_IDEMPOTENCY_CONFLICT'; end if;
   if stored.result is null then raise exception 'COLLECTION_BALANCE_CHANGED'; end if;
   return stored.result;
 end if;
 perform 1 from public.customers where id=p_customer_id and organization_id=p_organization_id for update;
 if not found then raise exception 'COLLECTION_CUSTOMER_NOT_FOUND'; end if;
 -- Stable row order across this transaction's debts. Other financial writers retain their own checks.
 perform 1 from public.repairs where organization_id=p_organization_id and customer_id=p_customer_id and branch_id=p_branch_id order by id for update;
 perform 1 from public.credit_installments i join public.customer_credits c on c.id=i.credit_id
   where c.organization_id=p_organization_id and c.customer_id=p_customer_id order by i.id for update of i;
 select id into session_id from public.cash_closures where organization_id=p_organization_id and branch_id=p_branch_id and date is null
   order by case when lower(register_id)='principal' then 0 else 1 end,created_at desc limit 1 for update;
 if method='cash' and session_id is null then raise exception 'COLLECTION_CASH_CLOSED'; end if;
 if coalesce(p_request->>'mode','auto')='manual' then
   candidates:=coalesce(p_request->'allocations','[]');
   if jsonb_typeof(candidates)<>'array' or jsonb_array_length(candidates)>200 then raise exception 'COLLECTION_INVALID_REQUEST'; end if;
   select count(*),count(distinct (x->>'type')||':'||(x->>'id')) into count_explicit,total from jsonb_array_elements(candidates) x;
   if count_explicit<>total then raise exception 'COLLECTION_INVALID_REQUEST'; end if;
 else
   select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'type',d.kind) order by d.due,d.id),'[]') into candidates from (
     select i.id,'installment' as kind,i.due_date as due from public.credit_installments i
       join public.customer_credits c on c.id=i.credit_id where c.organization_id=p_organization_id and c.customer_id=p_customer_id
       and c.status in ('active','defaulted') and i.status in ('pending','late')
       and (nullif(p_request#>>'{scope,creditId}','') is null or c.id=(p_request#>>'{scope,creditId}')::uuid)
       and (nullif(p_request#>>'{scope,installmentId}','') is null or i.id=(p_request#>>'{scope,installmentId}')::uuid)
     union all
     select r.id,'repair',coalesce(r.delivered_at,r.created_at) from public.repairs r
       where r.organization_id=p_organization_id and r.customer_id=p_customer_id and r.branch_id=p_branch_id
       and r.deleted_at is null and r.status<>'cancelado'
       and coalesce(p_request->'scope','{}')='{}'
   ) d;
 end if;
 insert into public.customer_collection_requests(organization_id,customer_id,actor_id,branch_id,idempotency_key,request)
   values(p_organization_id,p_customer_id,p_actor_id,p_branch_id,key,request_identity) returning id into receipt_id;
 remaining:=amount;
 for candidate in select value as item from jsonb_array_elements(candidates) loop
   if remaining<=0 and coalesce(p_request->>'mode','auto')='auto' then exit; end if;
   explicit:=candidate.item;
   if p_request->>'mode'='manual' and coalesce((explicit->>'amount')::numeric,0)=0 then continue; end if;
   if explicit->>'type'='installment' then
     select i.* into installment from public.credit_installments i
       join public.customer_credits c on c.id=i.credit_id where i.id=(explicit->>'id')::uuid
       and c.organization_id=p_organization_id and c.customer_id=p_customer_id and c.status in ('active','defaulted');
     if not found then raise exception 'COLLECTION_BALANCE_CHANGED'; end if;
     select coalesce(sum(p.amount),0) into paid from public.credit_payments p where p.installment_id=installment.id;
     pending:=greatest(0,installment.amount-paid);
   elsif explicit->>'type'='repair' then
     select * into repair from public.repairs where id=(explicit->>'id')::uuid and organization_id=p_organization_id
       and customer_id=p_customer_id and branch_id=p_branch_id and deleted_at is null and status<>'cancelado';
     if not found then raise exception 'COLLECTION_BALANCE_CHANGED'; end if;
     select coalesce(sum(coalesce(unit_price,unit_cost,0)*greatest(quantity,0)),0) into parts_total from public.repair_parts where repair_id=repair.id;
     if coalesce(repair.pricing_mode,'automatic')='automatic' then
       total:=greatest(0,coalesce(repair.labor_cost,0)+parts_total-coalesce(repair.discount_amount,0));
       -- Preserve legacy collection pricing when no breakdown was saved.
       if total=0 and coalesce(repair.labor_cost,0)=0 and parts_total=0
         and coalesce(repair.final_cost,repair.estimated_cost,0)>coalesce(repair.paid_amount,0) then
         update public.repairs set pricing_mode='budget',final_cost=coalesce(final_cost,estimated_cost) where id=repair.id;
         total:=coalesce(repair.final_cost,repair.estimated_cost,0);
       end if;
     else total:=greatest(0,coalesce(repair.final_cost,0)); end if;
     pending:=greatest(0,total-coalesce(repair.paid_amount,0));
   else raise exception 'COLLECTION_INVALID_REQUEST'; end if;
   if p_request->>'mode'='manual' then
     allocated:=(explicit->>'amount')::numeric;
     if allocated<=0 or allocated>pending or allocated>remaining then raise exception 'COLLECTION_BALANCE_CHANGED'; end if;
   else allocated:=least(pending,remaining); end if;
   if allocated<=0 then continue; end if;
   if explicit->>'type'='installment' then
     insert into public.credit_payments(credit_id,installment_id,amount,payment_method,notes)
       values(installment.credit_id,installment.id,allocated,method,coalesce(p_request->>'notes','')||
         case when method='transfer' then ' Ref: '||coalesce(p_request->>'referenceNumber','') when method='card' then ' Cupón: '||coalesce(p_request->>'voucherNumber','') else '' end)
       returning id into payment_id;
     if method='cash' then
       insert into public.cash_movements(session_id,type,amount,reason,payment_method,created_by,organization_id,branch_id)
         values(session_id,'cash_in',allocated,'Cobro crédito · '||receipt_id,method,p_actor_id,p_organization_id,p_branch_id);
     end if;
   else
     if session_id is null then raise exception 'COLLECTION_CASH_CLOSED'; end if;
     repair_result:=public.close_repair_and_register_payment_v2(
       p_repair_id=>repair.id,p_organization_id=>p_organization_id,p_branch_id=>p_branch_id,p_actor_id=>p_actor_id,
       p_payment_method=>method,p_payment_amount=>allocated,
       p_payment_reference=>case when method='transfer' then p_request->>'referenceNumber' else p_request->>'voucherNumber' end,
       p_payment_note=>p_request->>'notes',p_idempotency_key=>receipt_id::text||':'||repair.id::text,
       p_cash_session_id=>session_id,p_source=>'repairs');
     payment_id:=(repair_result->>'payment_id')::uuid;
   end if;
   allocations:=allocations||jsonb_build_array(jsonb_build_object('debtId',explicit->>'id','type',explicit->>'type',
     'paymentId',payment_id,'appliedAmount',allocated,'remainingBalance',pending-allocated,
     'totalAmount',case when explicit->>'type'='repair' then total else installment.amount end));
   remaining:=remaining-allocated;
 end loop;
 if remaining>0 then
   if not coalesce((p_request->>'creditExcessToStoreCredit')::boolean,false) then raise exception 'COLLECTION_EXCESS_CONFIRMATION'; end if;
   insert into public.customer_store_credits(organization_id,customer_id,amount,reason,source_type,source_id,created_by)
     values(p_organization_id,p_customer_id,remaining,'Excedente de cobro · '||receipt_id,'manual',receipt_id,p_actor_id);
   if method='cash' then
     insert into public.cash_movements(session_id,type,amount,reason,payment_method,created_by,organization_id,branch_id)
       values(session_id,'cash_in',remaining,'Saldo a favor · '||receipt_id,method,p_actor_id,p_organization_id,p_branch_id);
   end if;
 end if;
 select coalesce(jsonb_object_agg(q.id,jsonb_build_object('remainingBalance',q.balance,'paidInstallments',q.paid_count,
   'pendingInstallments',q.pending_count,'nextDueDate',q.next_due,'nextDueAmount',q.next_amount)),'{}') into credit_balances from (
   select c.id,coalesce(sum(greatest(0,i.amount-coalesce(i.amount_paid,0))),0) as balance,
     count(i.id) filter(where i.amount<=coalesce(i.amount_paid,0)) as paid_count,
     count(i.id) filter(where i.amount>coalesce(i.amount_paid,0)) as pending_count,
     (select j.due_date from public.credit_installments j where j.credit_id=c.id and j.amount>coalesce(j.amount_paid,0) order by j.due_date,j.id limit 1) as next_due,
     (select greatest(0,j.amount-coalesce(j.amount_paid,0)) from public.credit_installments j where j.credit_id=c.id and j.amount>coalesce(j.amount_paid,0) order by j.due_date,j.id limit 1) as next_amount
   from public.customer_credits c left join public.credit_installments i on i.credit_id=c.id
   where c.organization_id=p_organization_id and c.customer_id=p_customer_id and c.status<>'cancelled' group by c.id
 ) q;
 saved_result:=jsonb_build_object('receiptId',receipt_id,'receiptNumber','COL-'||upper(replace(receipt_id::text,'-','')),'creditBalances',credit_balances,
   'appliedAmount',amount-remaining,'excessToStoreCredit',remaining,'allocations',allocations,'recordedAt',now(),
   'paymentMethod',method,'reference',case when method='transfer' then p_request->>'referenceNumber' when method='card' then p_request->>'voucherNumber' else null end,
   'notes',p_request->>'notes');
 update public.customer_collection_requests set result=saved_result where id=receipt_id;
 return saved_result;
end $$;
revoke all on function public.collect_customer_payment_atomic(uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.collect_customer_payment_atomic(uuid,uuid,uuid,uuid,jsonb) to service_role;
