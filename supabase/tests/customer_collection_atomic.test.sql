-- Local fixtures only. All rows and trigger changes roll back.
begin;
set local session_replication_role=replica;
insert into auth.users(id) values ('ca010000-0000-4000-8000-000000000001'),('ca010000-0000-4000-8000-000000000002');
insert into public.profiles(id) values ('ca010000-0000-4000-8000-000000000001'),('ca010000-0000-4000-8000-000000000002');
insert into public.organizations(id,name,slug) values ('ca110000-0000-4000-8000-000000000001','Collection fixture','collection-test');
insert into public.organization_members(organization_id,user_id,role,status) values
 ('ca110000-0000-4000-8000-000000000001','ca010000-0000-4000-8000-000000000001','owner','active'),
 ('ca110000-0000-4000-8000-000000000001','ca010000-0000-4000-8000-000000000002','technician','active');
insert into public.branches(id,organization_id,code,name,slug,is_active) values ('ca310000-0000-4000-8000-000000000001','ca110000-0000-4000-8000-000000000001','COLLECT','Fixture','collection-fixture',true);
insert into public.customers(id,organization_id,name,status,credit_limit) values ('ca210000-0000-4000-8000-000000000001','ca110000-0000-4000-8000-000000000001','Collection customer','activo',1000);
insert into public.cash_closures(id,organization_id,branch_id,register_id,type,date,status) values ('ca510000-0000-4000-8000-000000000001','ca110000-0000-4000-8000-000000000001','ca310000-0000-4000-8000-000000000001','principal','opening',null,'abierta');
insert into public.customer_credits(id,organization_id,customer_id,principal,interest_rate,term_months,status) values ('ca610000-0000-4000-8000-000000000001','ca110000-0000-4000-8000-000000000001','ca210000-0000-4000-8000-000000000001',300,0,2,'active');
insert into public.credit_installments(id,credit_id,installment_number,due_date,amount,status,amount_paid) values
 ('ca710000-0000-4000-8000-000000000001','ca610000-0000-4000-8000-000000000001',1,now()-interval '2 days',150,'pending',0),
 ('ca710000-0000-4000-8000-000000000002','ca610000-0000-4000-8000-000000000001',2,now()+interval '1 day',150,'pending',0);
set local session_replication_role=origin;
set local role service_role;
do $test$
declare
 o uuid:='ca110000-0000-4000-8000-000000000001'; c uuid:='ca210000-0000-4000-8000-000000000001';
 a uuid:='ca010000-0000-4000-8000-000000000001'; b uuid:='ca310000-0000-4000-8000-000000000001';
 p jsonb:='{"amount":100,"paymentMethod":"cash","mode":"auto","idempotencyKey":"collection-fixture-first","creditExcessToStoreCredit":false}';
 first_result jsonb; repeated_result jsonb; rejected boolean;
begin
 assert not has_function_privilege('authenticated','public.collect_customer_payment_atomic(uuid,uuid,uuid,uuid,jsonb)','EXECUTE'),'browser cannot invoke privileged collection';
 update public.credit_installments set due_date=((now() at time zone 'America/Asuncion')::date::timestamp at time zone 'America/Asuncion')
  where id='ca710000-0000-4000-8000-000000000001';
 first_result:=public.collect_customer_payment_atomic(o,c,a,b,p);
 repeated_result:=public.collect_customer_payment_atomic(o,c,a,b,p);
 assert first_result=repeated_result,'same request returns persisted receipt';
 assert (first_result->>'appliedAmount')::numeric=100,'real amount in receipt';
 assert first_result->>'paymentMethod'='cash','receipt preserves original payment method';
 assert (select status='pending' from public.credit_installments where id='ca710000-0000-4000-8000-000000000001'),'partial due today is not late';
 assert (select count(*)=1 from public.credit_payments where credit_id='ca610000-0000-4000-8000-000000000001'),'retry never creates second payment';
 rejected:=false;
 begin perform public.collect_customer_payment_atomic(o,c,a,b,p||'{"amount":101}');
 exception when others then rejected:=sqlerrm like '%COLLECTION_IDEMPOTENCY_CONFLICT%'; end;
 assert rejected,'changed content conflicts';
 rejected:=false;
 begin perform public.collect_customer_payment_atomic(o,c,'ca010000-0000-4000-8000-000000000002',b,p);
 exception when others then rejected:=sqlerrm like '%COLLECTION_FORBIDDEN%'; end;
 assert rejected,'unauthorized actor rejected';
 rejected:=false;
 begin perform public.collect_customer_payment_atomic(o,'ca210000-0000-4000-8000-000000000002',a,b,p||'{"idempotencyKey":"collection-wrong-customer"}');
 exception when others then rejected:=sqlerrm like '%COLLECTION_CUSTOMER_NOT_FOUND%'; end;
 assert rejected,'wrong customer rejected';
 rejected:=false;
 begin perform public.collect_customer_payment_atomic(o,c,a,b,p||'{"amount":100,"mode":"manual","idempotencyKey":"collection-changed-balance","allocations":[{"id":"ca710000-0000-4000-8000-000000000001","type":"installment","amount":100}]}');
 exception when others then rejected:=sqlerrm like '%COLLECTION_BALANCE_CHANGED%'; end;
 assert rejected,'manual stale allocation rejects entire request';
 assert (select count(*)=1 from public.credit_payments where credit_id='ca610000-0000-4000-8000-000000000001'),'rejected request has no payments';
end $test$;
reset role;
create function pg_temp.reject_collection_cash() returns trigger language plpgsql as $$
begin
 if new.amount=75 then raise exception 'FIXTURE_CASH_FAILURE'; end if;
 return new;
end $$;
create trigger fixture_collection_cash_failure before insert on public.cash_movements for each row execute function pg_temp.reject_collection_cash();
set local role service_role;
do $test$
declare rejected boolean:=false;
begin
 begin perform public.collect_customer_payment_atomic('ca110000-0000-4000-8000-000000000001','ca210000-0000-4000-8000-000000000001','ca010000-0000-4000-8000-000000000001','ca310000-0000-4000-8000-000000000001','{"amount":275,"paymentMethod":"cash","mode":"auto","idempotencyKey":"collection-failed-excess","creditExcessToStoreCredit":true}');
 exception when others then rejected:=sqlerrm like '%FIXTURE_CASH_FAILURE%'; end;
 assert rejected,'failure in cash excess exercised';
 assert (select count(*)=1 from public.credit_payments where credit_id='ca610000-0000-4000-8000-000000000001'),'all new installment payments rolled back';
 assert not exists(select 1 from public.customer_store_credits where customer_id='ca210000-0000-4000-8000-000000000001'),'store balance rolled back';
 assert not exists(select 1 from public.customer_collection_requests where idempotency_key='collection-failed-excess'),'failed request not persisted';
end $test$;
reset role;
drop trigger fixture_collection_cash_failure on public.cash_movements;
set local session_replication_role=replica;
insert into public.repairs(id,organization_id,branch_id,customer_id,device_brand,device_model,problem_description,status,pricing_mode,final_cost,paid_amount,payment_status)
 values('ca810000-0000-4000-8000-000000000001','ca110000-0000-4000-8000-000000000001','ca310000-0000-4000-8000-000000000001','ca210000-0000-4000-8000-000000000001','Fixture','Fixture','Fixture','listo','manual',100,0,'pendiente');
insert into public.customer_credits(id,organization_id,customer_id,principal,interest_rate,term_months,status)
 values('ca610000-0000-4000-8000-000000000002','ca110000-0000-4000-8000-000000000001','ca210000-0000-4000-8000-000000000001',100,0,1,'completed');
insert into public.credit_installments(id,credit_id,installment_number,due_date,amount,status,amount_paid)
 values('ca710000-0000-4000-8000-000000000003','ca610000-0000-4000-8000-000000000002',1,now()-interval '1 day',100,'pending',75);
set local session_replication_role=origin;
set local role service_role;
do $test$
declare r jsonb; rejected boolean:=false;
begin
 r:=public.collect_customer_payment_atomic('ca110000-0000-4000-8000-000000000001','ca210000-0000-4000-8000-000000000001','ca010000-0000-4000-8000-000000000001','ca310000-0000-4000-8000-000000000001',
 '{"amount":120,"paymentMethod":"cash","mode":"manual","idempotencyKey":"collection-mixed-success","allocations":[{"id":"ca810000-0000-4000-8000-000000000001","type":"repair","amount":100},{"id":"ca710000-0000-4000-8000-000000000002","type":"installment","amount":20}]}');
 assert jsonb_array_length(r->'allocations')=2,'mixed debt receipt records both payments';
 assert (r->>'appliedAmount')::numeric=120,'mixed debt applied amount correct';
 assert (r->'creditBalances'->'ca610000-0000-4000-8000-000000000002'->>'remainingBalance')::numeric=0,'receipt does not revive completed credit debt';
 assert (select paid_amount=100 from public.repairs where id='ca810000-0000-4000-8000-000000000001'),'repair paid through established closure';
 update public.credit_installments set amount=150.33 where id='ca710000-0000-4000-8000-000000000002';
 r:=public.collect_customer_payment_atomic('ca110000-0000-4000-8000-000000000001','ca210000-0000-4000-8000-000000000001','ca010000-0000-4000-8000-000000000001','ca310000-0000-4000-8000-000000000001',
 '{"amount":130.33,"paymentMethod":"cash","mode":"manual","idempotencyKey":"collection-fractional-balance","allocations":[{"id":"ca710000-0000-4000-8000-000000000002","type":"installment","amount":130.33}]}');
 assert (r->>'appliedAmount')::numeric=130.33,'fractional debt is recorded exactly';
 assert (select amount_paid=150.33 and status='paid' from public.credit_installments where id='ca710000-0000-4000-8000-000000000002'),'fractional installment settles without rounding';
 update public.cash_closures set date=now() where id='ca510000-0000-4000-8000-000000000001';
 begin perform public.collect_customer_payment_atomic('ca110000-0000-4000-8000-000000000001','ca210000-0000-4000-8000-000000000001','ca010000-0000-4000-8000-000000000001','ca310000-0000-4000-8000-000000000001',
 '{"amount":20,"paymentMethod":"cash","mode":"auto","idempotencyKey":"collection-closed-cash"}');
 exception when others then rejected:=sqlerrm like '%COLLECTION_CASH_CLOSED%'; end;
 assert rejected,'closed cash rejects entire collection';
end $test$;
rollback;
