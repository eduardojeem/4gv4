-- All writes are server-only. An explicit database-verified actor is mandatory.
create table public.subscription_bank_transfer_settings (
 id boolean primary key default true check(id), enabled boolean not null default false,
 bank_name text not null default '',account_holder text not null default '',account_number text not null default '',account_alias text not null default '',
 currency text not null default 'PYG' check(currency='PYG'),instructions text not null default '',updated_by uuid,updated_at timestamptz not null default now(),
 check(not enabled or (length(trim(bank_name))>0 and length(trim(account_holder))>0 and (length(trim(account_number))>0 or length(trim(account_alias))>0)))
);
insert into public.subscription_bank_transfer_settings(id) values(true);
create table public.subscription_bank_transfer_requests (
 id uuid primary key default gen_random_uuid(),reference uuid not null unique default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),plan_code text not null check(plan_code in ('BASIC','PRO','ENTERPRISE')),
 plan_name text not null,amount numeric not null check(amount>0 and amount=trunc(amount)),currency text not null default 'PYG' check(currency='PYG'),
 period_months integer not null default 1 check(period_months=1),bank_snapshot jsonb not null,
 status text not null default 'awaiting_receipt' check(status in ('awaiting_receipt','pending_review','approved','rejected')),
 receipt_path text,receipt_mime_type text,receipt_size bigint,operation_reference text,bank_operation_reference text,bank_account_key text not null,
 rejection_reason text,created_by uuid not null,reviewed_by uuid,payment_id uuid unique references public.subscription_payments(id),
 period_starts_at timestamptz,period_ends_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),submitted_at timestamptz,reviewed_at timestamptz,
 check(status<>'pending_review' or (receipt_path is not null and receipt_mime_type is not null and receipt_size>0)),
 check(status<>'approved' or (payment_id is not null and bank_operation_reference is not null and period_ends_at>period_starts_at)),
 check(status<>'rejected' or length(trim(rejection_reason))>0)
);
create unique index subscription_transfer_one_open on public.subscription_bank_transfer_requests(organization_id) where status in ('awaiting_receipt','pending_review');
create unique index subscription_transfer_operation_once on public.subscription_bank_transfer_requests(lower(regexp_replace(bank_operation_reference,'[[:space:]]+','','g'))) where status='approved';
create index subscription_transfer_review_queue on public.subscription_bank_transfer_requests(status,created_at desc,id);
create index subscription_transfer_org_history on public.subscription_bank_transfer_requests(organization_id,created_at desc,id);
create unique index subscription_transfer_payment_once on public.subscription_payments(external_reference) where provider='bank_transfer';
alter table public.subscription_bank_transfer_settings enable row level security;
alter table public.subscription_bank_transfer_requests enable row level security;
revoke all on public.subscription_bank_transfer_settings,public.subscription_bank_transfer_requests from public,anon,authenticated;
grant all on public.subscription_bank_transfer_settings,public.subscription_bank_transfer_requests to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('subscription-transfer-receipts','subscription-transfer-receipts',false,3145728,array['image/jpeg','image/png','application/pdf'])
 on conflict(id) do update set public=false,file_size_limit=3145728,allowed_mime_types=excluded.allowed_mime_types;

create policy subscription_transfer_receipts_server_only on storage.objects
as restrictive for all to anon,authenticated
using(bucket_id<>'subscription-transfer-receipts')
with check(bucket_id<>'subscription-transfer-receipts');

create function public.subscription_transfer_assert_actor(p_actor_id uuid,p_organization_id uuid,p_superadmin boolean default false)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_profile_role text;v_status text;v_role text;v_active boolean;
begin
 if current_user<>'service_role' then raise exception 'TRANSFER_FORBIDDEN' using errcode='42501';end if;
 select role::text,status::text into v_profile_role,v_status from public.profiles where id=p_actor_id for share;
 if not found or coalesce(v_status,'active')<>'active' then raise exception 'TRANSFER_FORBIDDEN' using errcode='42501';end if;
 select role::text,is_active into v_role,v_active from public.user_roles where user_id=p_actor_id for share;
 if v_active is false then raise exception 'TRANSFER_FORBIDDEN' using errcode='42501';end if;
 if p_superadmin then
  if coalesce(v_role,'')<>'super_admin' then raise exception 'TRANSFER_SUPERADMIN_REQUIRED' using errcode='42501';end if;
 elsif not exists(select 1 from public.organization_members where organization_id=p_organization_id and user_id=p_actor_id and status::text='active' and role::text in ('owner','admin')) then
  raise exception 'TRANSFER_FORBIDDEN' using errcode='42501';
 end if;
end;$$;

create function public.get_subscription_bank_transfer_plans(p_organization_id uuid,p_actor_id uuid)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_sub public.subscriptions%rowtype;v_current text;v_role text;
begin
 perform public.subscription_transfer_assert_actor(p_actor_id,p_organization_id,false);
 select plan into v_current from public.organizations where id=p_organization_id;
 if not found then raise exception 'TRANSFER_NOT_FOUND';end if;
 select * into v_sub from public.subscriptions where organization_id=p_organization_id;
 v_current:=coalesce(v_sub.plan,v_current,'FREE');
 select role::text into v_role from public.organization_members where organization_id=p_organization_id and user_id=p_actor_id and status::text='active';
 return (select coalesce(jsonb_agg(jsonb_build_object('code',p.code,'name',c.name,'price',c.price,'currency','PYG') order by c.price),'[]'::jsonb)
  from public.plans p join public.subscription_plans c on upper(c.tier)=p.code
  where p.is_active and c.is_active and p.code in ('BASIC','PRO','ENTERPRISE') and c.price>0 and c.price=trunc(c.price)
   and (p.code=v_current or (v_role='owner' and v_current='FREE')));
end;$$;

create function public.update_subscription_bank_transfer_settings(p_actor_id uuid,p_settings jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 perform public.subscription_transfer_assert_actor(p_actor_id,null,true);
 if jsonb_typeof(p_settings->'enabled') is distinct from 'boolean' or p_settings->>'currency' is distinct from 'PYG'
  or length(coalesce(p_settings->>'bankName',''))>160 or length(coalesce(p_settings->>'accountHolder',''))>200
  or length(coalesce(p_settings->>'accountNumber',''))>120 or length(coalesce(p_settings->>'accountAlias',''))>120
  or length(coalesce(p_settings->>'instructions',''))>3000 then raise exception 'TRANSFER_SETTINGS_INVALID';end if;
 update public.subscription_bank_transfer_settings set enabled=(p_settings->>'enabled')::boolean,bank_name=trim(coalesce(p_settings->>'bankName','')),
  account_holder=trim(coalesce(p_settings->>'accountHolder','')),account_number=trim(coalesce(p_settings->>'accountNumber','')),
  account_alias=trim(coalesce(p_settings->>'accountAlias','')),instructions=trim(coalesce(p_settings->>'instructions','')),updated_by=p_actor_id,updated_at=now() where id;
 insert into public.tenant_audit_log(user_id,action,resource,resource_id,metadata) values(p_actor_id,'subscription.bank_transfer.settings_updated','subscription_bank_transfer_settings','true',jsonb_build_object('enabled',p_settings->'enabled'));
 return (select to_jsonb(s) from public.subscription_bank_transfer_settings s where id);
end;$$;

create function public.create_subscription_bank_transfer(p_organization_id uuid,p_actor_id uuid,p_plan_code text)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_request public.subscription_bank_transfer_requests%rowtype;v_settings public.subscription_bank_transfer_settings%rowtype;v_sub public.subscriptions%rowtype;
 v_current text;v_role text;v_plan jsonb;v_bank jsonb;v_account text;
begin
 perform public.subscription_transfer_assert_actor(p_actor_id,p_organization_id,false);
 perform 1 from public.organizations where id=p_organization_id for update;
 if not found then raise exception 'TRANSFER_NOT_FOUND';end if;
 select * into v_sub from public.subscriptions where organization_id=p_organization_id for update;
 select * into v_request from public.subscription_bank_transfer_requests where organization_id=p_organization_id and status in ('awaiting_receipt','pending_review') for update;
 if found then
  if v_request.plan_code<>p_plan_code then raise exception 'TRANSFER_OPEN_EXISTS';end if;
  return to_jsonb(v_request);
 end if;
 select plan into v_current from public.organizations where id=p_organization_id;
 v_current:=coalesce(v_sub.plan,v_current,'FREE');
 select role::text into v_role from public.organization_members where organization_id=p_organization_id and user_id=p_actor_id and status::text='active';
 if p_plan_code<>v_current and v_role<>'owner' then raise exception 'TRANSFER_OWNER_REQUIRED' using errcode='42501';end if;
 perform 1 from public.plans p join public.subscription_plans c on upper(c.tier)=p.code where p.code=p_plan_code for share of p,c;
 select value into v_plan from jsonb_array_elements(public.get_subscription_bank_transfer_plans(p_organization_id,p_actor_id)) where value->>'code'=p_plan_code;
 if v_plan is null then raise exception 'TRANSFER_PLAN_NOT_ELIGIBLE';end if;
 select * into v_settings from public.subscription_bank_transfer_settings where id for share;
 if not v_settings.enabled then raise exception 'TRANSFER_DISABLED';end if;
 v_bank:=jsonb_build_object('enabled',true,'bankName',v_settings.bank_name,'accountHolder',v_settings.account_holder,'accountNumber',v_settings.account_number,'accountAlias',v_settings.account_alias,'currency','PYG','instructions',v_settings.instructions);
 v_account:=lower(regexp_replace(v_settings.bank_name,'[[:space:]]+','','g'))||':'||lower(regexp_replace(coalesce(nullif(v_settings.account_number,''),v_settings.account_alias),'[[:space:]]+','','g'))||':PYG';
 insert into public.subscription_bank_transfer_requests(organization_id,plan_code,plan_name,amount,bank_snapshot,bank_account_key,created_by)
  values(p_organization_id,p_plan_code,v_plan->>'name',(v_plan->>'price')::numeric,v_bank,v_account,p_actor_id) returning * into v_request;
 insert into public.tenant_audit_log(organization_id,user_id,action,resource,resource_id,metadata) values(p_organization_id,p_actor_id,'subscription.bank_transfer.created','subscription_bank_transfer_requests',v_request.id::text,jsonb_build_object('plan',p_plan_code,'amount',v_request.amount));
 return to_jsonb(v_request);
end;$$;

create function public.submit_subscription_bank_transfer_receipt(p_organization_id uuid,p_actor_id uuid,p_request_id uuid,p_path text,p_mime_type text,p_size bigint,p_operation_reference text default null)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_request public.subscription_bank_transfer_requests%rowtype;v_metadata jsonb;
begin
 perform public.subscription_transfer_assert_actor(p_actor_id,p_organization_id,false);
 perform 1 from public.organizations where id=p_organization_id for update;
 select * into v_request from public.subscription_bank_transfer_requests where id=p_request_id and organization_id=p_organization_id for update;
 if not found then raise exception 'TRANSFER_NOT_FOUND';end if;
 if p_path is null or length(p_path)>500 or split_part(p_path,'/',1)<>p_organization_id::text or split_part(p_path,'/',2)<>p_request_id::text or p_path~'(^|/)\.\.(/|$)'
  or split_part(p_path,'/',3)='' or p_mime_type is null or p_mime_type not in ('image/jpeg','image/png','application/pdf') or p_size is null or p_size<=0 or p_size>3145728 or length(coalesce(p_operation_reference,''))>160 then raise exception 'TRANSFER_RECEIPT_INVALID';end if;
 select metadata into v_metadata from storage.objects where bucket_id='subscription-transfer-receipts' and name=p_path;
 if not found or v_metadata->>'mimetype' is distinct from p_mime_type or (v_metadata->>'size')::bigint is distinct from p_size then raise exception 'TRANSFER_RECEIPT_INVALID';end if;
 if v_request.status='pending_review' and v_request.receipt_path=p_path and v_request.receipt_mime_type=p_mime_type and v_request.receipt_size=p_size then return to_jsonb(v_request);end if;
 if v_request.status<>'awaiting_receipt' then raise exception 'TRANSFER_INVALID_STATE';end if;
 update public.subscription_bank_transfer_requests set status='pending_review',receipt_path=p_path,receipt_mime_type=p_mime_type,receipt_size=p_size,operation_reference=nullif(trim(p_operation_reference),''),submitted_at=now(),updated_at=now() where id=p_request_id returning * into v_request;
 insert into public.tenant_audit_log(organization_id,user_id,action,resource,resource_id,metadata) values(p_organization_id,p_actor_id,'subscription.bank_transfer.submitted','subscription_bank_transfer_requests',p_request_id::text,jsonb_build_object('receipt_path',p_path));
 return to_jsonb(v_request);
end;$$;

create function public.review_subscription_bank_transfer(p_actor_id uuid,p_request_id uuid,p_decision text,p_reason text default null,p_bank_operation_reference text default null)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_request public.subscription_bank_transfer_requests%rowtype;v_sub public.subscriptions%rowtype;v_org_id uuid;v_current text;v_start timestamptz;v_end timestamptz;v_payment_id uuid;v_ref text;
begin
 perform public.subscription_transfer_assert_actor(p_actor_id,null,true);
 select organization_id into v_org_id from public.subscription_bank_transfer_requests where id=p_request_id;
 if not found then raise exception 'TRANSFER_NOT_FOUND';end if;
 perform 1 from public.organizations where id=v_org_id for update;
 select * into v_request from public.subscription_bank_transfer_requests where id=p_request_id for update;
 select * into v_sub from public.subscriptions where organization_id=v_org_id for update;
 if p_decision not in ('approved','rejected') or p_decision is null then raise exception 'TRANSFER_INVALID_DECISION';end if;
 v_ref:=lower(regexp_replace(trim(coalesce(p_bank_operation_reference,'')),'[[:space:]]+','','g'));
 if v_request.status='approved' and p_decision='approved' and v_request.bank_operation_reference=v_ref then return jsonb_build_object('request',to_jsonb(v_request),'applied',false);end if;
 if v_request.status='rejected' and p_decision='rejected' then return jsonb_build_object('request',to_jsonb(v_request),'applied',false);end if;
 if (p_decision='approved' and v_request.status<>'pending_review') or (p_decision='rejected' and v_request.status not in ('awaiting_receipt','pending_review')) then raise exception 'TRANSFER_INVALID_STATE';end if;
 if p_decision='rejected' then
  if length(trim(coalesce(p_reason,'')))=0 or length(p_reason)>2000 then raise exception 'TRANSFER_REJECTION_REASON_REQUIRED';end if;
  update public.subscription_bank_transfer_requests set status='rejected',rejection_reason=trim(p_reason),reviewed_by=p_actor_id,reviewed_at=now(),updated_at=now() where id=p_request_id returning * into v_request;
 else
  if length(v_ref)=0 or length(v_ref)>160 then raise exception 'TRANSFER_BANK_REFERENCE_REQUIRED';end if;
  if exists(select 1 from public.subscription_bank_transfer_requests where status='approved' and bank_operation_reference=v_ref) then raise exception 'TRANSFER_DUPLICATE_OPERATION';end if;
  if not exists(select 1 from storage.objects where bucket_id='subscription-transfer-receipts' and name=v_request.receipt_path) then raise exception 'TRANSFER_RECEIPT_INVALID';end if;
  select plan into v_current from public.organizations where id=v_org_id;
  v_current:=coalesce(v_sub.plan,v_current,'FREE');
  if v_current<>'FREE' and v_current<>v_request.plan_code then raise exception 'TRANSFER_PLAN_CHANGE_UNSUPPORTED';end if;
  perform 1 from public.plans p join public.subscription_plans c on upper(c.tier)=p.code where p.code=v_request.plan_code and p.is_active and c.is_active for share of p,c;
  if not found then raise exception 'TRANSFER_PLAN_NOT_ELIGIBLE';end if;
  v_start:=now();
  if v_sub.plan=v_request.plan_code and v_sub.status::text='active' and v_sub.current_period_ends_at>v_start then v_start:=v_sub.current_period_ends_at;end if;
  if v_sub.plan=v_request.plan_code and v_sub.status::text='trialing' and v_sub.trial_ends_at>v_start then v_start:=v_sub.trial_ends_at;end if;
  -- Explicit Paraguay calendar arithmetic, independent of the database session timezone.
  v_end:=((v_start at time zone 'America/Asuncion')+interval '1 month') at time zone 'America/Asuncion';
  if v_sub.id is null then
   insert into public.subscriptions(organization_id,plan,status,provider,payment_status,last_payment_method,started_at,current_period_starts_at,current_period_ends_at,external_reference)
    values(v_org_id,v_request.plan_code,'active','bank_transfer','paid','bank_transfer',now(),v_start,v_end,v_request.reference::text) returning * into v_sub;
  else
   update public.subscriptions set plan=v_request.plan_code,status='active',provider='bank_transfer',payment_status='paid',last_payment_method='bank_transfer',started_at=coalesce(started_at,now()),trial_ends_at=null,current_period_starts_at=v_start,current_period_ends_at=v_end,cancel_at_period_end=false,external_reference=v_request.reference::text,updated_at=now() where id=v_sub.id returning * into v_sub;
  end if;
  update public.organizations set plan=v_request.plan_code,updated_at=now() where id=v_org_id;
  insert into public.subscription_payments(organization_id,subscription_id,plan_id,amount,currency,status,payment_method,provider,provider_payment_id,external_reference,paid_at)
   values(v_org_id,v_sub.id,v_request.plan_code,v_request.amount,'PYG','paid','bank_transfer','bank_transfer',v_ref,v_request.reference::text,now()) returning id into v_payment_id;
  update public.subscription_bank_transfer_requests set status='approved',bank_operation_reference=v_ref,reviewed_by=p_actor_id,reviewed_at=now(),updated_at=now(),payment_id=v_payment_id,period_starts_at=v_start,period_ends_at=v_end where id=p_request_id returning * into v_request;
 end if;
 insert into public.tenant_audit_log(organization_id,user_id,action,resource,resource_id,metadata) values(v_org_id,p_actor_id,'subscription.bank_transfer.'||p_decision,'subscription_bank_transfer_requests',p_request_id::text,jsonb_build_object('payment_id',v_request.payment_id,'plan',v_request.plan_code,'amount',v_request.amount,'period_end',v_request.period_ends_at));
 return jsonb_build_object('request',to_jsonb(v_request),'applied',true);
exception when unique_violation then raise exception 'TRANSFER_DUPLICATE_OPERATION' using errcode='23505';
end;$$;

revoke all on function public.subscription_transfer_assert_actor(uuid,uuid,boolean),public.get_subscription_bank_transfer_plans(uuid,uuid),public.update_subscription_bank_transfer_settings(uuid,jsonb),public.create_subscription_bank_transfer(uuid,uuid,text),public.submit_subscription_bank_transfer_receipt(uuid,uuid,uuid,text,text,bigint,text),public.review_subscription_bank_transfer(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.subscription_transfer_assert_actor(uuid,uuid,boolean),public.get_subscription_bank_transfer_plans(uuid,uuid),public.update_subscription_bank_transfer_settings(uuid,jsonb),public.create_subscription_bank_transfer(uuid,uuid,text),public.submit_subscription_bank_transfer_receipt(uuid,uuid,uuid,text,text,bigint,text),public.review_subscription_bank_transfer(uuid,uuid,text,text,text) to service_role;
