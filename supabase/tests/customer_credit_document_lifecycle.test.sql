begin;
set local session_replication_role=replica;
insert into auth.users(id) values('cf040000-0000-4000-8000-000000000001');
insert into public.organizations(id,name,slug) values('cf140000-0000-4000-8000-000000000001','Lifecycle fixture','credit-document-lifecycle');
insert into public.customers(id,organization_id,name,status) values('cf240000-0000-4000-8000-000000000001','cf140000-0000-4000-8000-000000000001','Lifecycle fixture','activo');
insert into public.organization_members(organization_id,user_id,role) values('cf140000-0000-4000-8000-000000000001','cf040000-0000-4000-8000-000000000001','owner');
insert into public.customer_credit_files(organization_id,customer_id) values('cf140000-0000-4000-8000-000000000001','cf240000-0000-4000-8000-000000000001');
set local session_replication_role=origin;
set local role service_role;
do $$
declare
 o uuid:='cf140000-0000-4000-8000-000000000001'; c uuid:='cf240000-0000-4000-8000-000000000001'; a uuid:='cf040000-0000-4000-8000-000000000001';
 r jsonb; f jsonb; d uuid; rejected boolean:=false; v integer;
begin
 r:=public.reserve_customer_credit_document(o,c,a,0,'identity','fixture.jpg','image/jpeg',8,'jpg'); d:=(r->>'id')::uuid;
 assert r->>'objectPath'=o::text||'/'||c::text||'/'||d::text||'.jpg','server-generated path';
 begin perform public.change_customer_credit_document(o,c,a,d,1,'review','verified','Checked');
 exception when check_violation then rejected:=true; end;
 assert rejected,'pending upload cannot be verified';
 f:=public.change_customer_credit_document(o,c,a,d,null,'ready',null,null);
 assert f#>>'{documents,0,reviewStatus}'='pending','upload does not verify';
 f:=public.change_customer_credit_document(o,c,a,d,(f->>'version')::integer,'review','verified','Checked');
 assert f#>>'{documents,0,reviewedBy}'=a::text,'server audit actor';
 f:=public.change_customer_credit_document(o,c,a,d,(f->>'version')::integer,'delete',null,null);
 assert jsonb_array_length(f->'documents')=0,'deleted document hidden';
 assert (select lifecycle='deleted' and cleanup_pending from public.customer_credit_documents where id=d),'logical deletion before cleanup';
 f:=public.change_customer_credit_document(o,c,a,d,0,'delete',null,null);
 perform public.change_customer_credit_document(o,c,a,d,null,'cleaned',null,null);
 assert not (select cleanup_pending from public.customer_credit_documents where id=d),'cleanup idempotent';
 v:=(f->>'version')::integer;
 for i in 1..10 loop
  r:=public.reserve_customer_credit_document(o,c,a,v,'other','fixture.jpg','image/jpeg',8,'jpg'); v:=v+1;
 end loop;
 rejected:=false;
 begin perform public.reserve_customer_credit_document(o,c,a,v,'other','fixture.jpg','image/jpeg',8,'jpg');
 exception when check_violation then rejected:=true; end;
 assert rejected,'pending reservations count towards ten-file limit';
 assert not has_function_privilege('authenticated','public.reserve_customer_credit_document(uuid,uuid,uuid,integer,text,text,text,integer,text)','EXECUTE'),'browser cannot reserve';
end $$;
rollback;
