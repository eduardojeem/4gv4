-- Local Docker only. Metadata fixtures, not real Storage uploads; all writes roll back.
begin;
set local session_replication_role=replica;
insert into auth.users(id) values('cf030000-0000-4000-8000-000000000001');
insert into public.organizations(id,name,slug) values('cf130000-0000-4000-8000-000000000001','Document limit fixture','credit-document-limit-fixture');
insert into public.customers(id,organization_id,name,status) values('cf230000-0000-4000-8000-000000000001','cf130000-0000-4000-8000-000000000001','Document fixture','activo');
insert into public.customer_credit_files(id,organization_id,customer_id) values('cf330000-0000-4000-8000-000000000001','cf130000-0000-4000-8000-000000000001','cf230000-0000-4000-8000-000000000001');
-- Simulate a document that existed before lowering the limit.
insert into public.customer_credit_documents(id,file_id,organization_id,customer_id,type,filename,object_path,mime_type,byte_size,created_by)
values('cf430000-0000-4000-8000-000000000002','cf330000-0000-4000-8000-000000000001','cf130000-0000-4000-8000-000000000001','cf230000-0000-4000-8000-000000000001','identity','old-fixture.jpg','cf130000-0000-4000-8000-000000000001/cf230000-0000-4000-8000-000000000001/cf430000-0000-4000-8000-000000000002.jpg','image/jpeg',5242880,'cf030000-0000-4000-8000-000000000001');
set local session_replication_role=origin;
do $$
declare rejected boolean:=false;
begin
 assert (select file_size_limit=4194304 and not public from storage.buckets where id='customer-credit-documents'),'bucket must enforce 4 MiB';
 insert into public.customer_credit_documents(id,file_id,organization_id,customer_id,type,filename,object_path,mime_type,byte_size,created_by)
 values('cf430000-0000-4000-8000-000000000001','cf330000-0000-4000-8000-000000000001','cf130000-0000-4000-8000-000000000001','cf230000-0000-4000-8000-000000000001','identity','fixture.jpg','cf130000-0000-4000-8000-000000000001/cf230000-0000-4000-8000-000000000001/cf430000-0000-4000-8000-000000000001.jpg','image/jpeg',4194304,'cf030000-0000-4000-8000-000000000001');
 begin
  update public.customer_credit_documents set byte_size=4194305 where id='cf430000-0000-4000-8000-000000000001';
 exception when check_violation then rejected:=true; end;
 assert rejected,'4 MiB + 1 must be rejected';
 update public.customer_credit_documents set comment='Existing document retained' where id='cf430000-0000-4000-8000-000000000002';
 assert (select byte_size=5242880 from public.customer_credit_documents where id='cf430000-0000-4000-8000-000000000002'),'existing document metadata retained';
end $$;
-- Even a broad existing permissive policy must not expose credit documents.
create policy credit_fixture_permissive on storage.objects for all to anon,authenticated using(true) with check(true);
insert into storage.objects(bucket_id,name) values('customer-credit-documents','fixture-private.jpg');
set local role authenticated;
do $$ begin
 assert not exists(select 1 from storage.objects where bucket_id='customer-credit-documents'),'authenticated direct access must be denied';
end $$;
set local role anon;
do $$ begin
 assert not exists(select 1 from storage.objects where bucket_id='customer-credit-documents'),'anonymous direct access must be denied';
end $$;
reset role;
rollback;
