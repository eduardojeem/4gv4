begin;
create function public.reserve_customer_credit_document(p_organization_id uuid,p_customer_id uuid,p_actor_id uuid,p_expected_version integer,p_type text,p_filename text,p_mime_type text,p_byte_size integer,p_extension text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare f public.customer_credit_files; d uuid:=gen_random_uuid(); path text;
begin
 perform public.assert_customer_credit_file_actor(p_organization_id,p_actor_id,true);
 perform 1 from public.customers where organization_id=p_organization_id and id=p_customer_id for update;
 select * into f from public.customer_credit_files where organization_id=p_organization_id and customer_id=p_customer_id for update;
 if f.id is null then raise exception using errcode='P0002',message='CREDIT_FILE_NOT_FOUND'; end if;
 if p_expected_version is null or f.version<>p_expected_version then raise exception using errcode='40001',message='CREDIT_FILE_VERSION_CONFLICT'; end if;
 if p_type is null or p_type not in('identity','address','income','other') or p_filename is null or length(p_filename) not between 1 and 200
  or p_byte_size is null or p_byte_size not between 1 and 4194304
  or p_mime_type is null or p_extension is null or not ((p_mime_type='image/jpeg' and p_extension='jpg') or (p_mime_type='image/png' and p_extension='png') or (p_mime_type='image/webp' and p_extension='webp')) then
  raise exception using errcode='22023',message='INVALID_CREDIT_DOCUMENT';
 end if;
 if (select count(*) from public.customer_credit_documents where file_id=f.id and lifecycle<>'deleted')>=10 then raise exception using errcode='23514',message='CREDIT_DOCUMENT_LIMIT'; end if;
 path:=p_organization_id::text||'/'||p_customer_id::text||'/'||d::text||'.'||p_extension;
 insert into public.customer_credit_documents(id,file_id,organization_id,customer_id,type,filename,object_path,mime_type,byte_size,created_by)
 values(d,f.id,p_organization_id,p_customer_id,p_type,p_filename,path,p_mime_type,p_byte_size,p_actor_id);
 update public.customer_credit_files set version=version+1,status=case when status='approved' then 'pending' else status end,updated_at=now(),updated_by=p_actor_id where id=f.id;
 insert into public.customer_credit_file_events(file_id,organization_id,customer_id,actor_id,action,file_version) values(f.id,p_organization_id,p_customer_id,p_actor_id,'document_reserved',f.version+1);
 return jsonb_build_object('id',d,'objectPath',path);
end $$;
create function public.change_customer_credit_document(p_organization_id uuid,p_customer_id uuid,p_actor_id uuid,p_document_id uuid,p_expected_version integer,p_action text,p_review_status text,p_comment text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare f public.customer_credit_files; d public.customer_credit_documents; event_action text;
begin
 perform public.assert_customer_credit_file_actor(p_organization_id,p_actor_id,true);
 perform 1 from public.customers where organization_id=p_organization_id and id=p_customer_id for update;
 select * into f from public.customer_credit_files where organization_id=p_organization_id and customer_id=p_customer_id for update;
 select * into d from public.customer_credit_documents where id=p_document_id and file_id=f.id and organization_id=p_organization_id and customer_id=p_customer_id for update;
 if f.id is null or d.id is null then raise exception using errcode='P0002',message='CREDIT_DOCUMENT_NOT_FOUND'; end if;
 if p_action is null or p_action not in('ready','review','delete','cleaned') then raise exception using errcode='22023',message='INVALID_CREDIT_DOCUMENT_ACTION'; end if;
 if p_action='cleaned' then
  if d.lifecycle<>'deleted' then raise exception using errcode='23514',message='CREDIT_DOCUMENT_NOT_DELETED'; end if;
  update public.customer_credit_documents set cleanup_pending=false where id=d.id;
  return public.customer_credit_file_dto(p_organization_id,p_customer_id);
 end if;
 if p_action='delete' and d.lifecycle='deleted' then return public.customer_credit_file_dto(p_organization_id,p_customer_id); end if;
 if p_action in('review','delete') and (p_expected_version is null or p_expected_version<>f.version) then raise exception using errcode='40001',message='CREDIT_FILE_VERSION_CONFLICT'; end if;
 if p_action='ready' then
  if d.lifecycle<>'pending' then raise exception using errcode='23514',message='CREDIT_DOCUMENT_NOT_PENDING'; end if;
  update public.customer_credit_documents set lifecycle='ready' where id=d.id; event_action:='document_ready';
 elsif p_action='review' then
  if d.lifecycle<>'ready' then raise exception using errcode='23514',message='CREDIT_DOCUMENT_NOT_READY'; end if;
  if p_review_status is null or p_review_status not in('pending','verified','rejected') or p_comment is null or length(p_comment)>1000 then raise exception using errcode='22023',message='INVALID_CREDIT_DOCUMENT_REVIEW'; end if;
  update public.customer_credit_documents set review_status=p_review_status,reviewed_at=case when p_review_status<>'pending' then now() end,reviewed_by=case when p_review_status<>'pending' then p_actor_id end,comment=p_comment where id=d.id;
  event_action:='document_reviewed';
 else
  update public.customer_credit_documents set lifecycle='deleted',review_status='pending',reviewed_at=null,reviewed_by=null,comment='',deleted_at=now(),cleanup_pending=true where id=d.id;
  event_action:='document_deleted';
 end if;
 update public.customer_credit_files set version=version+1,status=case when status='approved' then 'pending' else status end,updated_at=now(),updated_by=p_actor_id where id=f.id;
 insert into public.customer_credit_file_events(file_id,organization_id,customer_id,actor_id,action,file_version) values(f.id,p_organization_id,p_customer_id,p_actor_id,event_action,f.version+1);
 return public.customer_credit_file_dto(p_organization_id,p_customer_id);
end $$;
revoke all on function public.reserve_customer_credit_document(uuid,uuid,uuid,integer,text,text,text,integer,text),public.change_customer_credit_document(uuid,uuid,uuid,uuid,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.reserve_customer_credit_document(uuid,uuid,uuid,integer,text,text,text,integer,text),public.change_customer_credit_document(uuid,uuid,uuid,uuid,integer,text,text,text) to service_role;
commit;
