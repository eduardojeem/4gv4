begin;

create table public.organization_credit_file_policies (
 organization_id uuid primary key references public.organizations(id) on delete restrict,
 version integer not null default 0 check(version>=0),
 mode text not null default 'informational' check(mode in ('informational','warning','required')),
 require_identity boolean not null default false,
 min_verified_references integer not null default 0 check(min_verified_references between 0 and 5),
 required_documents text[] not null default '{}' check(required_documents <@ array['identity','address','income','other']::text[]),
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id) on delete restrict
);
create table public.customer_credit_files (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 customer_id uuid not null,
 version integer not null default 0 check(version>=0),
 status text not null default 'draft' check(status in ('draft','pending','approved','rejected','suspended')),
 identity_type text not null default 'ci' check(identity_type in ('ci','ruc','other')),
 identity_number text not null default '' check(length(identity_number)<=50),
 occupation text not null default '' check(length(occupation)<=200),
 company text not null default '' check(length(company)<=200),
 position text not null default '' check(length(position)<=120),
 declared_monthly_income numeric check(declared_monthly_income between 0 and 1000000000000),
 informed_customer_at timestamptz,
 last_decision_by uuid references auth.users(id) on delete restrict,
 last_decision_at timestamptz,
 last_decision_reason text check(length(last_decision_reason) between 1 and 1000),
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id) on delete restrict,
 unique(organization_id,customer_id), unique(id,organization_id,customer_id),
 foreign key(customer_id,organization_id) references public.customers(id,organization_id) on delete restrict,
 check(status<>'approved' or (last_decision_by is not null and last_decision_at is not null and last_decision_reason is not null))
);
create table public.customer_credit_references (
 id uuid primary key default gen_random_uuid(),
 file_id uuid not null,
 organization_id uuid not null,
 customer_id uuid not null,
 name text not null check(length(btrim(name)) between 1 and 200),
 relationship text not null check(length(btrim(relationship)) between 1 and 120),
 phone text not null check(length(btrim(phone)) between 1 and 50),
 verification_status text not null default 'pending' check(verification_status in ('pending','verified','unreachable')),
 verified_at timestamptz,
 verified_by uuid references auth.users(id) on delete restrict,
 comment text not null default '' check(length(comment)<=1000),
 foreign key(file_id,organization_id,customer_id) references public.customer_credit_files(id,organization_id,customer_id) on delete restrict,
 check(verification_status<>'verified' or (verified_at is not null and verified_by is not null))
);
create index customer_credit_references_file_idx on public.customer_credit_references(file_id,organization_id,customer_id);
create table public.customer_credit_documents (
 id uuid primary key default gen_random_uuid(),
 file_id uuid not null,
 organization_id uuid not null,
 customer_id uuid not null,
 type text not null check(type in ('identity','address','income','other')),
 filename text not null check(length(filename) between 1 and 200),
 object_path text not null unique,
 mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp')),
 byte_size integer not null check(byte_size between 1 and 5242880),
 lifecycle text not null default 'pending' check(lifecycle in ('pending','ready','deleted')),
 review_status text not null default 'pending' check(review_status in ('pending','verified','rejected')),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id) on delete restrict,
 comment text not null default '' check(length(comment)<=1000),
 created_at timestamptz not null default now(),
 created_by uuid not null references auth.users(id) on delete restrict,
 deleted_at timestamptz,
 cleanup_pending boolean not null default false,
 foreign key(file_id,organization_id,customer_id) references public.customer_credit_files(id,organization_id,customer_id) on delete restrict,
 check(review_status<>'verified' or (lifecycle='ready' and reviewed_at is not null and reviewed_by is not null)),
 check(object_path like organization_id::text||'/'||customer_id::text||'/'||id::text||'.%')
);
create index customer_credit_documents_file_idx on public.customer_credit_documents(file_id,organization_id,customer_id);
create table public.customer_credit_file_events (
 id uuid primary key default gen_random_uuid(),
 file_id uuid not null,
 organization_id uuid not null,
 customer_id uuid not null,
 actor_id uuid not null references auth.users(id) on delete restrict,
 action text not null check(action in ('saved','pending','approved','rejected','suspended','document_reserved','document_ready','document_reviewed','document_deleted')),
 file_version integer not null,
 reason text check(length(reason) between 1 and 1000),
 authorized_limit numeric,
 transaction_id bigint not null default txid_current(),
 created_at timestamptz not null default now(),
 foreign key(file_id,organization_id,customer_id) references public.customer_credit_files(id,organization_id,customer_id) on delete restrict
);
create index customer_credit_file_events_file_idx on public.customer_credit_file_events(file_id,organization_id,customer_id,created_at desc);

alter table public.organization_credit_file_policies enable row level security;
alter table public.customer_credit_files enable row level security;
alter table public.customer_credit_references enable row level security;
alter table public.customer_credit_documents enable row level security;
alter table public.customer_credit_file_events enable row level security;
revoke all on public.organization_credit_file_policies,public.customer_credit_files,public.customer_credit_references,public.customer_credit_documents,public.customer_credit_file_events from public,anon,authenticated;
grant select,insert,update on public.organization_credit_file_policies,public.customer_credit_files,public.customer_credit_references,public.customer_credit_documents to service_role;
grant delete on public.customer_credit_references to service_role;
grant select,insert on public.customer_credit_file_events to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('customer-credit-documents','customer-credit-documents',false,5242880,array['image/jpeg','image/png','image/webp']);
-- No browser Storage policies for this bucket: every operation uses an authorized server route.

create function public.assert_customer_credit_file_actor(p_organization_id uuid,p_actor_id uuid,p_manage boolean default true)
returns void language plpgsql security invoker set search_path=pg_catalog as $$
begin
 if not exists(select 1 from public.organization_members where organization_id=p_organization_id and user_id=p_actor_id and status='active'
   and role::text=any(case when p_manage then array['owner','admin','manager'] else array['owner','admin','manager','seller'] end)) then
   raise exception using errcode='42501',message='CREDIT_FILE_FORBIDDEN';
 end if;
end $$;
revoke all on function public.assert_customer_credit_file_actor(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.assert_customer_credit_file_actor(uuid,uuid,boolean) to service_role;

-- Internal DTO contains no storage paths. Execute only after server authorization.
create function public.customer_credit_file_dto(p_organization_id uuid,p_customer_id uuid)
returns jsonb language sql stable security invoker set search_path=pg_catalog as $$
 select jsonb_build_object(
  'version',f.version,'status',f.status,'identity',jsonb_build_object('type',f.identity_type,'number',f.identity_number),
  'occupation',f.occupation,'company',f.company,'position',f.position,'declaredMonthlyIncome',f.declared_monthly_income,
  'informedCustomerAt',f.informed_customer_at,
  'lastDecision',case when f.last_decision_at is not null then jsonb_build_object('actorId',f.last_decision_by,'at',f.last_decision_at,'reason',f.last_decision_reason) end,
  'references',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'relationship',r.relationship,'phone',r.phone,
    'verificationStatus',r.verification_status,'verifiedAt',r.verified_at,'verifiedBy',r.verified_by,'comment',r.comment) order by r.id)
    from public.customer_credit_references r where r.file_id=f.id),'[]'::jsonb),
  'documents',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'type',d.type,'filename',d.filename,
    'lifecycle',d.lifecycle,'reviewStatus',d.review_status,'reviewedAt',d.reviewed_at,'reviewedBy',d.reviewed_by,'comment',d.comment) order by d.created_at,d.id)
    from public.customer_credit_documents d where d.file_id=f.id and d.lifecycle<>'deleted'),'[]'::jsonb))
 from public.customer_credit_files f where f.organization_id=p_organization_id and f.customer_id=p_customer_id;
$$;
revoke all on function public.customer_credit_file_dto(uuid,uuid) from public,anon,authenticated;
grant execute on function public.customer_credit_file_dto(uuid,uuid) to service_role;

create function public.customer_credit_file_missing(p_organization_id uuid,p_customer_id uuid,p_require_approval boolean default true)
returns text[] language plpgsql stable security invoker set search_path=pg_catalog as $$
declare f public.customer_credit_files%rowtype; p public.organization_credit_file_policies%rowtype; missing text[]:='{}'; doc_type text;
begin
 select * into p from public.organization_credit_file_policies where organization_id=p_organization_id;
 select * into f from public.customer_credit_files where organization_id=p_organization_id and customer_id=p_customer_id;
 if f.id is null then missing:=array_append(missing,'file'); end if;
 if p_require_approval and (f.status is distinct from 'approved' or f.last_decision_at is null) then missing:=array_append(missing,'approval'); end if;
 if coalesce(p.require_identity,false) and coalesce(btrim(f.identity_number),'')='' then missing:=array_append(missing,'identity'); end if;
 if (select count(*) from public.customer_credit_references where file_id=f.id and verification_status='verified' and verified_at is not null and verified_by is not null)<coalesce(p.min_verified_references,0) then missing:=array_append(missing,'references'); end if;
 foreach doc_type in array coalesce(p.required_documents,'{}'::text[]) loop
   if not exists(select 1 from public.customer_credit_documents where file_id=f.id and type=doc_type and lifecycle='ready' and review_status='verified' and reviewed_at is not null and reviewed_by is not null) then missing:=array_append(missing,'document:'||doc_type); end if;
 end loop;
 return missing;
end $$;
revoke all on function public.customer_credit_file_missing(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.customer_credit_file_missing(uuid,uuid,boolean) to service_role;

create or replace function public.save_customer_credit_file(p_organization_id uuid,p_customer_id uuid,p_actor_id uuid,p_expected_version integer,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare f public.customer_credit_files%rowtype; ref jsonb; ref_id uuid; ref_ids uuid[]:='{}'; changed boolean; old_ref public.customer_credit_references%rowtype; verified_status text; contact_changed boolean;
begin
 perform public.assert_customer_credit_file_actor(p_organization_id,p_actor_id);
 perform 1 from public.customers where id=p_customer_id and organization_id=p_organization_id for update;
 if not found then raise exception using errcode='P0002',message='CUSTOMER_NOT_FOUND'; end if;
 if p_expected_version is null or p_expected_version<0 then raise exception using errcode='22023',message='INVALID_CREDIT_FILE_VERSION'; end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or (p_payload - array['version','identity','occupation','company','position','declaredMonthlyIncome','informedCustomer','references'])<>'{}'::jsonb
   or jsonb_typeof(p_payload->'identity') is distinct from 'object' or ((p_payload->'identity')-array['type','number'])<>'{}'::jsonb
   or jsonb_typeof(p_payload->'informedCustomer') is distinct from 'boolean' or jsonb_typeof(p_payload->'references') is distinct from 'array' then
   raise exception using errcode='22023',message='INVALID_CREDIT_FILE_PAYLOAD';
 end if;
 if jsonb_array_length(p_payload->'references')>5 then raise exception using errcode='23514',message='CREDIT_FILE_REFERENCE_LIMIT'; end if;
 select * into f from public.customer_credit_files where organization_id=p_organization_id and customer_id=p_customer_id for update;
 if coalesce(f.version,0)<>p_expected_version then raise exception using errcode='40001',message='CREDIT_FILE_VERSION_CONFLICT'; end if;
 if f.id is null then
   insert into public.customer_credit_files(organization_id,customer_id,updated_by) values(p_organization_id,p_customer_id,p_actor_id) returning * into f;
 end if;
 changed := row(f.identity_type,f.identity_number,f.occupation,f.company,f.position,f.declared_monthly_income,f.informed_customer_at is not null)
   is distinct from row(p_payload#>>'{identity,type}',btrim(p_payload#>>'{identity,number}'),coalesce(btrim(p_payload->>'occupation'),''),coalesce(btrim(p_payload->>'company'),''),coalesce(btrim(p_payload->>'position'),''),(p_payload->>'declaredMonthlyIncome')::numeric,(p_payload->>'informedCustomer')::boolean);
 for ref in select value from jsonb_array_elements(p_payload->'references') loop
   if jsonb_typeof(ref) is distinct from 'object' or (ref-array['id','name','relationship','phone','verificationStatus','comment'])<>'{}'::jsonb then raise exception using errcode='22023',message='INVALID_CREDIT_FILE_REFERENCE'; end if;
   ref_id:=coalesce((ref->>'id')::uuid,gen_random_uuid());
   if ref_id=any(ref_ids) then raise exception using errcode='22023',message='DUPLICATE_CREDIT_FILE_REFERENCE'; end if;
   ref_ids:=array_append(ref_ids,ref_id);
   select * into old_ref from public.customer_credit_references where id=ref_id and file_id=f.id;
   if old_ref.id is null and ref ? 'id' then raise exception using errcode='22023',message='UNKNOWN_CREDIT_FILE_REFERENCE'; end if;
   contact_changed:=row(old_ref.name,old_ref.relationship,old_ref.phone) is distinct from row(btrim(ref->>'name'),btrim(ref->>'relationship'),btrim(ref->>'phone'));
   verified_status:=case when old_ref.verification_status='verified' and contact_changed and ref->>'verificationStatus'='verified' then 'pending' else ref->>'verificationStatus' end;
   if old_ref.id is null or row(old_ref.name,old_ref.relationship,old_ref.phone,old_ref.verification_status,old_ref.comment) is distinct from row(btrim(ref->>'name'),btrim(ref->>'relationship'),btrim(ref->>'phone'),ref->>'verificationStatus',coalesce(btrim(ref->>'comment'),'')) then
     changed:=true;
     insert into public.customer_credit_references(id,file_id,organization_id,customer_id,name,relationship,phone,verification_status,verified_at,verified_by,comment)
     values(ref_id,f.id,p_organization_id,p_customer_id,btrim(ref->>'name'),btrim(ref->>'relationship'),btrim(ref->>'phone'),verified_status,
       case when verified_status='verified' then case when old_ref.verification_status='verified' and not contact_changed then old_ref.verified_at else clock_timestamp() end end,
       case when verified_status='verified' then case when old_ref.verification_status='verified' and not contact_changed then old_ref.verified_by else p_actor_id end end,coalesce(btrim(ref->>'comment'),''))
     on conflict(id) do update set name=excluded.name,relationship=excluded.relationship,phone=excluded.phone,verification_status=excluded.verification_status,verified_at=excluded.verified_at,verified_by=excluded.verified_by,comment=excluded.comment;
   end if;
 end loop;
 if exists(select 1 from public.customer_credit_references where file_id=f.id and not(id=any(ref_ids))) then changed:=true; end if;
 delete from public.customer_credit_references where file_id=f.id and not(id=any(ref_ids));
 update public.customer_credit_files set
  identity_type=p_payload#>>'{identity,type}',identity_number=btrim(p_payload#>>'{identity,number}'),occupation=coalesce(btrim(p_payload->>'occupation'),''),company=coalesce(btrim(p_payload->>'company'),''),position=coalesce(btrim(p_payload->>'position'),''),declared_monthly_income=(p_payload->>'declaredMonthlyIncome')::numeric,
  informed_customer_at=case when (p_payload->>'informedCustomer')::boolean then coalesce(informed_customer_at,clock_timestamp()) end,
  status=case when status='approved' and changed then 'pending' else status end,
  version=version+1,updated_at=clock_timestamp(),updated_by=p_actor_id where id=f.id returning * into f;
 insert into public.customer_credit_file_events(file_id,organization_id,customer_id,actor_id,action,file_version) values(f.id,p_organization_id,p_customer_id,p_actor_id,'saved',f.version);
 return public.customer_credit_file_dto(p_organization_id,p_customer_id);
end $$;
revoke all on function public.save_customer_credit_file(uuid,uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.save_customer_credit_file(uuid,uuid,uuid,integer,jsonb) to service_role;

create function public.decide_customer_credit_file(p_organization_id uuid,p_customer_id uuid,p_actor_id uuid,p_expected_version integer,p_status text,p_limit numeric,p_reason text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare f public.customer_credit_files%rowtype; missing text[];
begin
 perform public.assert_customer_credit_file_actor(p_organization_id,p_actor_id);
 perform 1 from public.customers where id=p_customer_id and organization_id=p_organization_id for update;
 if not found then raise exception using errcode='P0002',message='CUSTOMER_NOT_FOUND'; end if;
 select * into f from public.customer_credit_files where organization_id=p_organization_id and customer_id=p_customer_id for update;
 if f.id is null then raise exception using errcode='P0002',message='CREDIT_FILE_NOT_FOUND'; end if;
 if p_expected_version is null or f.version<>p_expected_version then raise exception using errcode='40001',message='CREDIT_FILE_VERSION_CONFLICT'; end if;
 if p_status is null or p_status not in ('pending','approved','rejected','suspended') or coalesce(length(btrim(p_reason)),0) not between 1 and 1000 then raise exception using errcode='22023',message='INVALID_CREDIT_FILE_DECISION'; end if;
 if p_status='approved' then
   if p_limit is null or p_limit<0 or p_limit>9999999999.99 then raise exception using errcode='22023',message='INVALID_CREDIT_LIMIT'; end if;
   missing:=public.customer_credit_file_missing(p_organization_id,p_customer_id,false);
   if cardinality(missing)>0 then raise exception using errcode='23514',message='CREDIT_FILE_INCOMPLETE'; end if;
   if f.informed_customer_at is null then raise exception using errcode='23514',message='CREDIT_FILE_CUSTOMER_NOT_INFORMED'; end if;
 end if;
 update public.customer_credit_files set status=p_status,version=version+1,last_decision_by=p_actor_id,last_decision_at=clock_timestamp(),last_decision_reason=btrim(p_reason),updated_by=p_actor_id,updated_at=clock_timestamp() where id=f.id returning * into f;
 insert into public.customer_credit_file_events(file_id,organization_id,customer_id,actor_id,action,file_version,reason,authorized_limit)
 values(f.id,p_organization_id,p_customer_id,p_actor_id,p_status,f.version,btrim(p_reason),case when p_status='approved' then round(p_limit,2) end);
 if p_status='approved' then update public.customers set credit_limit=round(p_limit,2),updated_at=clock_timestamp() where id=p_customer_id and organization_id=p_organization_id; end if;
 return public.customer_credit_file_dto(p_organization_id,p_customer_id);
end $$;
revoke all on function public.decide_customer_credit_file(uuid,uuid,uuid,integer,text,numeric,text) from public,anon,authenticated;
grant execute on function public.decide_customer_credit_file(uuid,uuid,uuid,integer,text,numeric,text) to service_role;

commit;
