begin;

-- Additive adjustment: never delete or resize previously uploaded documents.
update storage.buckets
set public=false, file_size_limit=4194304,
    allowed_mime_types=array['image/jpeg','image/png','image/webp']
where id='customer-credit-documents';

-- Enforce the new limit on new uploads and size changes. Existing metadata
-- remains editable even if an older document was uploaded with the 5 MiB limit.
create function public.enforce_customer_credit_document_size()
returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
begin
 if new.byte_size not between 1 and 4194304 then
  raise exception using errcode='23514',message='CREDIT_DOCUMENT_TOO_LARGE';
 end if;
 return new;
end $$;
revoke all on function public.enforce_customer_credit_document_size() from public,anon,authenticated;
create trigger customer_credit_document_size_guard
before insert or update of byte_size on public.customer_credit_documents
for each row execute function public.enforce_customer_credit_document_size();

-- Restrictive policies AND with existing permissive policies. Protect this
-- bucket without changing access to any other bucket; service_role bypasses RLS.
create policy customer_credit_documents_server_only on storage.objects
as restrictive for all to anon,authenticated
using(bucket_id<>'customer-credit-documents')
with check(bucket_id<>'customer-credit-documents');

commit;
