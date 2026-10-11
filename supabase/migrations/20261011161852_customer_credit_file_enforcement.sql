begin;

-- Invoked by generic customer updates as well as the privileged decision RPC.
-- An approval event in THIS transaction is required; a stale approval is not a bypass.
create function public.guard_customer_credit_limit_decision()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if new.credit_limit is not distinct from old.credit_limit then return new; end if;
 if exists(select 1 from public.organization_credit_file_policies where organization_id=new.organization_id and mode='required')
   and not exists(select 1 from public.customer_credit_file_events e join public.customer_credit_files f on f.id=e.file_id
    where e.organization_id=new.organization_id and e.customer_id=new.id and e.action='approved' and e.transaction_id=txid_current()
      and e.file_version=f.version and f.status='approved' and e.authorized_limit=new.credit_limit) then
   raise exception using errcode='42501',message='CREDIT_LIMIT_REQUIRES_DECISION';
 end if;
 return new;
end $$;
revoke all on function public.guard_customer_credit_limit_decision() from public,anon,authenticated;
create trigger customer_credit_limit_requires_decision before update of credit_limit on public.customers
for each row execute function public.guard_customer_credit_limit_decision();

create function public.customer_credit_outstanding(p_organization_id uuid,p_customer_id uuid)
returns numeric language sql stable security invoker set search_path=pg_catalog as $$
 select
  coalesce((select sum(greatest(0,greatest(0,coalesce(i.amount,0))-greatest(0,coalesce(i.amount_paid,0))))
    from public.customer_credits c join public.credit_installments i on i.credit_id=c.id
    where c.organization_id=p_organization_id and c.customer_id=p_customer_id and lower(i.status) in ('pending','late')),0)
  +coalesce((select sum(greatest(0,greatest(0,coalesce(r.final_cost,r.estimated_cost,0))-greatest(0,coalesce(r.paid_amount,0))))
    from public.repairs r where r.organization_id=p_organization_id and r.customer_id=p_customer_id
    and lower(coalesce(r.payment_status,'')) not in ('pagado','paid')),0);
$$;
revoke all on function public.customer_credit_outstanding(uuid,uuid) from public,anon,authenticated;
grant execute on function public.customer_credit_outstanding(uuid,uuid) to service_role;

-- All creation paths (including legacy/direct insert) serialize on the customer.
-- Checklist is reevaluated using the current policy, not a cached approved flag.
create function public.lock_customer_credit_concession()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare missing text[];
begin
 if tg_op='UPDATE' and new.customer_id is not distinct from old.customer_id and new.organization_id is not distinct from old.organization_id
   and new.principal<=old.principal and not(old.status in ('cancelled','completed') and new.status in ('active','defaulted')) then return new; end if;
 if tg_op='UPDATE' and (new.customer_id is distinct from old.customer_id or new.organization_id is distinct from old.organization_id) then
   raise exception using errcode='23514',message='CREDIT_CUSTOMER_IMMUTABLE';
 end if;
 perform 1 from public.customers where id=new.customer_id and organization_id=new.organization_id for update;
 if not found then raise exception using errcode='23514',message='CREDIT_CUSTOMER_ORGANIZATION_MISMATCH'; end if;
 if exists(select 1 from public.organization_credit_file_policies where organization_id=new.organization_id and mode='required') then
   missing:=public.customer_credit_file_missing(new.organization_id,new.customer_id);
   if cardinality(missing)>0 then raise exception using errcode='23514',message='CREDIT_FILE_REQUIRED'; end if;
 end if;
 return new;
end $$;
revoke all on function public.lock_customer_credit_concession() from public,anon,authenticated;
create trigger customer_credit_concession_lock before insert or update of principal,status,customer_id,organization_id on public.customer_credits
for each row execute function public.lock_customer_credit_concession();

-- Validate AFTER installments, first payments and repair settlement are complete.
-- An immediate header check would double-count a repair being converted to credit.
create function public.check_customer_credit_concession_limit()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare credit public.customer_credits%rowtype; available_limit numeric; debt numeric;
begin
 if tg_op='UPDATE' and new.principal<=old.principal and not(old.status in ('cancelled','completed') and new.status in ('active','defaulted')) then return null; end if;
 select * into credit from public.customer_credits where id=new.id;
 if credit.id is null or credit.status='cancelled' then return null; end if;
 select coalesce(credit_limit,0) into available_limit from public.customers where id=credit.customer_id and organization_id=credit.organization_id for update;
 if not exists(select 1 from public.credit_installments where credit_id=credit.id) then
   raise exception using errcode='23514',message='CREDIT_INSTALLMENTS_REQUIRED';
 end if;
 debt:=public.customer_credit_outstanding(credit.organization_id,credit.customer_id);
 if debt>available_limit then raise exception using errcode='23514',message='CREDIT_LIMIT_EXCEEDED'; end if;
 return null;
end $$;
revoke all on function public.check_customer_credit_concession_limit() from public,anon,authenticated;
create constraint trigger customer_credit_concession_limit after insert or update on public.customer_credits
deferrable initially deferred for each row execute function public.check_customer_credit_concession_limit();

create function public.create_customer_credit_account_atomic(p_organization_id uuid,p_customer_id uuid,p_actor_id uuid,p_header jsonb,p_installments jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare credit_id uuid; sale_id uuid; total numeric; principal_total numeric; interest_total numeric; plan_count integer;
begin
 perform public.assert_customer_credit_file_actor(p_organization_id,p_actor_id,false);
 perform 1 from public.customers where id=p_customer_id and organization_id=p_organization_id for update;
 if not found then raise exception using errcode='P0002',message='CUSTOMER_NOT_FOUND'; end if;
 if jsonb_typeof(p_header) is distinct from 'object' or (p_header-array['sale_id','principal','interest_rate','term_months','credit_type','origin_type','label','metadata'])<>'{}'::jsonb
   or jsonb_typeof(p_installments) is distinct from 'array' then raise exception using errcode='22023',message='INVALID_CREDIT_ACCOUNT_PAYLOAD'; end if;
 plan_count:=jsonb_array_length(p_installments);
 if plan_count not between 1 and 60 or plan_count is distinct from (p_header->>'term_months')::integer then raise exception using errcode='23514',message='INVALID_CREDIT_INSTALLMENT_COUNT'; end if;
 if coalesce((p_header->>'principal')::numeric,0)<=0 or (p_header->>'principal')::numeric>1000000000000
   or coalesce((p_header->>'interest_rate')::numeric,-1) not between 0 and 100 then raise exception using errcode='23514',message='INVALID_CREDIT_AMOUNTS'; end if;
 if exists(select 1 from jsonb_array_elements(p_installments) i where jsonb_typeof(i) is distinct from 'object'
   or (i-array['installment_number','due_date','amount','principal_component','interest_component'])<>'{}'::jsonb
   or coalesce((i->>'amount')::numeric,-1)<0 or coalesce((i->>'principal_component')::numeric,-1)<0 or coalesce((i->>'interest_component')::numeric,-1)<0
   or (i->>'amount')::numeric is distinct from ((i->>'principal_component')::numeric+(i->>'interest_component')::numeric)
   or (i->>'due_date') is null) then raise exception using errcode='23514',message='INVALID_CREDIT_INSTALLMENT'; end if;
 if (select count(distinct (i->>'installment_number')::integer)=plan_count
   and min((i->>'installment_number')::integer)=1 and max((i->>'installment_number')::integer)=plan_count from jsonb_array_elements(p_installments) i) is not true then
   raise exception using errcode='23514',message='INVALID_CREDIT_INSTALLMENT_SEQUENCE';
 end if;
 select sum((i->>'amount')::numeric),sum((i->>'principal_component')::numeric),sum((i->>'interest_component')::numeric)
 into total,principal_total,interest_total from jsonb_array_elements(p_installments) i;
 if total is distinct from (p_header->>'principal')::numeric or principal_total<=0 or total>1000000000000 then raise exception using errcode='23514',message='CREDIT_PLAN_TOTAL_MISMATCH'; end if;
 sale_id:=(p_header->>'sale_id')::uuid;
 if sale_id is not null then
   perform 1 from public.sales where id=sale_id and organization_id=p_organization_id and (customer_id is null or customer_id=p_customer_id) for update;
   if not found then raise exception using errcode='23514',message='CREDIT_SALE_CUSTOMER_MISMATCH'; end if;
 end if;
 insert into public.customer_credits(customer_id,organization_id,sale_id,principal,interest_rate,term_months,start_date,status,credit_code,credit_type,origin_type,label,metadata)
 values(p_customer_id,p_organization_id,sale_id,total,(p_header->>'interest_rate')::numeric,plan_count,clock_timestamp(),'active',
   'CR-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),p_header->>'credit_type',p_header->>'origin_type',left(p_header->>'label',200),coalesce(p_header->'metadata','{}'::jsonb)||jsonb_build_object('created_by',p_actor_id)) returning id into credit_id;
 insert into public.credit_installments(credit_id,sale_id,installment_number,due_date,amount,principal_component,interest_component,status)
 select credit_id,sale_id,(i->>'installment_number')::integer,(i->>'due_date')::timestamptz,(i->>'amount')::numeric,(i->>'principal_component')::numeric,(i->>'interest_component')::numeric,'pending' from jsonb_array_elements(p_installments) i;
 return jsonb_build_object('creditId',credit_id,'financedTotal',total,'interestAmount',interest_total,'installmentCount',plan_count);
end $$;
revoke all on function public.create_customer_credit_account_atomic(uuid,uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.create_customer_credit_account_atomic(uuid,uuid,uuid,jsonb,jsonb) to service_role;

commit;
