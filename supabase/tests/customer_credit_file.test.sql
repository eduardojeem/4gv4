-- Local-only fictitious data. psql -v ON_ERROR_STOP=1; every write rolls back.
begin;
insert into auth.users(id) values ('cf000000-0000-4000-8000-000000000001'),('cf000000-0000-4000-8000-000000000002');
insert into public.organizations(id,name,slug) values
 ('cf100000-0000-4000-8000-000000000001','Credit fixture','credit-file-fixture-one'),
 ('cf100000-0000-4000-8000-000000000002','Other fixture','credit-file-fixture-two');
insert into public.organization_members(organization_id,user_id,role) values
 ('cf100000-0000-4000-8000-000000000001','cf000000-0000-4000-8000-000000000001','owner'),
 ('cf100000-0000-4000-8000-000000000001','cf000000-0000-4000-8000-000000000002','seller');
insert into public.customers(id,organization_id,name,status,credit_limit) values
 ('cf200000-0000-4000-8000-000000000001','cf100000-0000-4000-8000-000000000001','Credit fixture customer','activo',500),
 ('cf200000-0000-4000-8000-000000000002','cf100000-0000-4000-8000-000000000002','Other customer','activo',500);
set local role service_role;
do $test$
declare
 org_id uuid := 'cf100000-0000-4000-8000-000000000001';
 cust_id uuid := 'cf200000-0000-4000-8000-000000000001';
 actor_id uuid := 'cf000000-0000-4000-8000-000000000001';
 payload jsonb := '{"identity":{"type":"ci","number":"fixture-id"},"informedCustomer":true,"references":[],"declaredMonthlyIncome":null}';
 result jsonb; rejected boolean;
begin
 assert not has_table_privilege('anon','public.customer_credit_files','SELECT'),'anonymous file read denied';
 assert not has_table_privilege('authenticated','public.customer_credit_files','SELECT'),'authenticated file read denied';
 assert not has_function_privilege('authenticated','public.save_customer_credit_file(uuid,uuid,uuid,integer,jsonb)','EXECUTE'),'direct RPC denied';
 assert not exists(select 1 from storage.buckets where id='customer-credit-documents' and public),'private bucket';
 rejected := false;
 begin
   insert into public.customer_credit_files(organization_id,customer_id)
   values(org_id,'cf200000-0000-4000-8000-000000000002');
 exception when foreign_key_violation then rejected := true;
 end;
 assert rejected,'cross-tenant customer rejected';
 rejected := false;
 begin
   perform public.save_customer_credit_file(org_id,cust_id,'cf000000-0000-4000-8000-000000000002',0,payload);
 exception when insufficient_privilege then rejected := true;
 end;
 assert rejected,'seller cannot edit';
 result := public.save_customer_credit_file(org_id,cust_id,actor_id,0,payload);
 assert result->>'version'='1' and result->>'status'='draft','save does not approve';
 rejected := false;
 begin perform public.save_customer_credit_file(org_id,cust_id,actor_id,0,payload);
 exception when sqlstate '40001' then rejected := true; end;
 assert rejected,'stale version conflict';
 result := public.decide_customer_credit_file(org_id,cust_id,actor_id,1,'approved',300,'Reviewed fixture');
 assert result->>'status'='approved' and result->>'version'='2','manual approval';
 assert (select credit_limit=300 from public.customers where id=cust_id),'single operative limit';
 assert (select count(*)=1 from public.customer_credit_file_events where customer_id=cust_id and action='approved'),'decision audited';
 -- A failed transaction must undo the decision and operative limit together.
 begin
   perform public.decide_customer_credit_file(org_id,cust_id,actor_id,2,'approved',200,'Rollback fixture');
   raise exception using errcode='ZX001',message='fixture rollback';
 exception when sqlstate 'ZX001' then null; end;
 assert (select version=2 from public.customer_credit_files where customer_id=cust_id),'decision rolled back';
 assert (select credit_limit=300 from public.customers where id=cust_id),'limit rolled back';
 result := public.save_customer_credit_file(org_id,cust_id,actor_id,2,jsonb_set(payload,'{identity,number}','"new-fixture-id"'));
 assert result->>'status'='pending','identity change invalidates approval';
 insert into public.organization_credit_file_policies(organization_id,mode,require_identity,min_verified_references)
 values(org_id,'required',true,1);
 rejected := false;
 begin perform public.decide_customer_credit_file(org_id,cust_id,actor_id,3,'approved',400,'Incomplete fixture');
 exception when check_violation then rejected := true; end;
 assert rejected,'approval requires current checklist';
 assert (select credit_limit=300 from public.customers where id=cust_id),'failed approval leaves limit untouched';
 rejected := false;
 begin update public.customers set credit_limit=900 where id=cust_id;
 exception when insufficient_privilege then rejected := true; end;
 assert rejected,'generic update cannot bypass required decision';
 payload := jsonb_set(payload,'{references}','[{"name":"Fixture reference","relationship":"Family","phone":"0000","verificationStatus":"verified","comment":"Manually verified"}]');
 result := public.save_customer_credit_file(org_id,cust_id,actor_id,3,payload);
 assert result#>>'{references,0,verifiedBy}'=actor_id::text,'verified actor server-owned';
 result := public.decide_customer_credit_file(org_id,cust_id,actor_id,4,'approved',100,'Lower limit fixture');
 assert result->>'status'='approved','complete checklist approves';
 assert (select credit_limit=100 from public.customers where id=cust_id),'lower limit applied';
 -- Existing debt remains when the authorized limit is reduced.
 insert into public.customer_credits(id,organization_id,customer_id,principal,interest_rate,term_months,status)
 values('cf300000-0000-4000-8000-000000000001',org_id,cust_id,80,0,1,'active');
 insert into public.credit_installments(credit_id,installment_number,due_date,amount,principal_component,interest_component,status)
 values('cf300000-0000-4000-8000-000000000001',1,now()+interval '1 month',80,80,0,'pending');
 set constraints customer_credit_concession_limit immediate;
 set constraints customer_credit_concession_limit deferred;
 result := public.decide_customer_credit_file(org_id,cust_id,actor_id,5,'approved',50,'Debt preserved fixture');
 assert public.customer_credit_outstanding(org_id,cust_id)=80,'reducing limit never erases debt';
 rejected:=false;
 begin
   insert into public.customer_credits(id,organization_id,customer_id,principal,interest_rate,term_months,status)
   values('cf300000-0000-4000-8000-000000000002',org_id,cust_id,10,0,1,'active');
   insert into public.credit_installments(credit_id,installment_number,due_date,amount,principal_component,interest_component,status)
   values('cf300000-0000-4000-8000-000000000002',1,now()+interval '1 month',10,10,0,'pending');
   set constraints customer_credit_concession_limit immediate;
 exception when check_violation then rejected:=true; end;
 assert rejected,'new credit cannot exceed reduced limit';
 assert not exists(select 1 from public.customer_credits where id='cf300000-0000-4000-8000-000000000002'),'header and installments rollback together';
 -- A new required document invalidates eligibility even for an approved file.
 update public.organization_credit_file_policies set required_documents=array['address'] where organization_id=org_id;
 rejected:=false;
 begin
   insert into public.customer_credits(organization_id,customer_id,principal,interest_rate,term_months,status)
   values(org_id,cust_id,1,0,1,'active');
 exception when check_violation then rejected:=true; end;
 assert rejected,'concession reevaluates changed requirements';
 -- Payments are not new concessions and continue to work under required mode.
 update public.credit_installments set amount_paid=20 where credit_id='cf300000-0000-4000-8000-000000000001';
 assert public.customer_credit_outstanding(org_id,cust_id)=60,'payment works with incomplete file and lowered limit';
 update public.organization_credit_file_policies set mode='informational' where organization_id=org_id;
 update public.customers set credit_limit=500 where id=cust_id;
 result:=public.create_customer_credit_account_atomic(org_id,cust_id,actor_id,
   '{"principal":30,"interest_rate":0,"term_months":1,"credit_type":"manual","origin_type":"manual","label":"Fixture","metadata":{"frequency":"monthly","first_installment_timing":"at_start"}}',
   '[{"installment_number":1,"due_date":"2030-01-01T00:00:00Z","amount":30,"principal_component":30,"interest_component":0}]');
 assert result->>'creditId' is not null,'atomic credit creates header and plan';
 rejected:=false;
 begin
   perform public.create_customer_credit_account_atomic(org_id,cust_id,actor_id,
    '{"principal":40,"interest_rate":0,"term_months":1,"credit_type":"manual","origin_type":"manual","label":"Invalid fixture","metadata":{}}',
    '[{"installment_number":1,"due_date":"2030-01-01T00:00:00Z","amount":39,"principal_component":39,"interest_component":0}]');
 exception when check_violation then rejected:=true; end;
 assert rejected,'inconsistent plan rejected atomically';
 -- Editing an already verified phone must not manufacture a new verification.
 select public.customer_credit_file_dto(org_id,cust_id) into result;
 payload:=jsonb_set(payload,'{references,0,id}',result#>'{references,0,id}');
 payload:=jsonb_set(payload,'{references,0,phone}','"1111"');
 result:=public.save_customer_credit_file(org_id,cust_id,actor_id,6,payload);
 assert result#>>'{references,0,verificationStatus}'='pending','changed verified contact needs fresh verification';
 assert result#>>'{references,0,verifiedBy}' is null,'no forged re-verification actor';
end $test$;
rollback;
