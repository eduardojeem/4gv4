begin;
alter table public.organizations add column erased_at timestamptz;
alter table public.organization_nonrenewal_cycles add column erasure_approved_at timestamptz;
alter table public.organization_nonrenewal_cycles add column erasure_approved_by uuid;
alter table public.organization_nonrenewal_cycles add column erased_at timestamptz;
alter table public.organization_nonrenewal_cycles add column storage_reviewed_at timestamptz;
create table public.organization_erasure_files(
 organization_id uuid not null references public.organizations(id) on delete restrict,
 bucket_id text not null, object_path text not null, removed_at timestamptz, ready_at timestamptz,
 disposition text not null check(disposition in ('delete','retain')),
 legal_basis text,retain_until timestamptz,
 check(disposition='delete' or (length(trim(legal_basis))>=10 and retain_until is not null)),
 primary key(organization_id,bucket_id,object_path),
 check(organization_id::text=any(string_to_array(object_path,'/'))),
 check(object_path not like '%..%' and object_path not like '/%')
);
alter table public.organization_erasure_files enable row level security;
revoke all on public.organization_erasure_files from public,anon,authenticated;
grant select,insert,update,delete on public.organization_erasure_files to service_role;
create table public.organization_retained_identity(
 organization_id uuid primary key references public.organizations(id) on delete restrict,
 identity jsonb not null, retain_until timestamptz not null, legal_basis text not null
);
alter table public.organization_retained_identity enable row level security;
revoke all on public.organization_retained_identity from public,anon,authenticated;
grant select,insert,update on public.organization_retained_identity to service_role;

-- Server-only classification. No permissive default and no automatically approved plans.
create table public.organization_erasure_rules (
 organization_id uuid not null references public.organizations(id) on delete restrict,
 table_name text not null,
 disposition text not null check(disposition in ('delete','retain')),
 legal_basis text,
 retain_until timestamptz,
 primary key(organization_id,table_name),
 check(disposition='delete' or (length(trim(legal_basis))>=10 and retain_until is not null))
);
alter table public.organization_erasure_rules enable row level security;
revoke all on public.organization_erasure_rules from public,anon,authenticated;
grant select,insert,update,delete on public.organization_erasure_rules to service_role;

-- This inventory includes indirectly related children: silently cascading into an
-- unclassified table (for example payments or invoices) is expressly forbidden.
create function public.organization_erasure_inventory()
returns table(table_name text,has_organization_id boolean) language sql stable security invoker set search_path=public as $$
 with recursive scoped(oid) as (
  select c.oid from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p') and exists(select 1 from pg_catalog.pg_attribute a where a.attrelid=c.oid and a.attname='organization_id' and not a.attisdropped)
   and c.relname not in ('organization_nonrenewal_cycles','organization_erasure_rules','organization_erasure_files','organization_retained_identity')
  union
  select f.conrelid from pg_catalog.pg_constraint f join scoped s on s.oid=f.confrelid
  join pg_catalog.pg_class c on c.oid=f.conrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where f.contype='f' and n.nspname='public'
 ) select c.relname::text,exists(select 1 from pg_catalog.pg_attribute a where a.attrelid=c.oid and a.attname='organization_id' and not a.attisdropped)
 from scoped s join pg_catalog.pg_class c on c.oid=s.oid;
$$;

create function public.complete_nonrenewal_erasure(p_organization_id uuid)
returns boolean language plpgsql security invoker set search_path=public as $$
declare s public.subscriptions%rowtype; c public.organization_nonrenewal_cycles%rowtype; r record; e timestamptz; pending integer; progressed boolean; failure text; unlisted boolean; identity_row jsonb;
begin
 select * into s from public.subscriptions where organization_id=p_organization_id for update;
 if not found then raise exception 'Suscripción no encontrada'; end if;
 select * into c from public.organization_nonrenewal_cycles where organization_id=p_organization_id for update;
 if not found then raise exception 'Ciclo no encontrado'; end if;
 if c.erased_at is not null then return false; end if;
 e:=case when s.status='trialing' then s.trial_ends_at else coalesce(s.current_period_ends_at,s.trial_ends_at) end;
 if c.resolved_at is not null or c.archived_at is null or e is distinct from c.expired_at or e>now()
 or (s.status='active' and (s.current_period_ends_at>now() or (s.current_period_ends_at is null and s.payment_status='paid')))
 or c.deletion_due_at>now() then raise exception 'La organización no es elegible para baja'; end if;
 if c.deletion_warning_sent_at is null or c.deletion_warning_sent_at>now()-interval '7 days' then raise exception 'Falta el aviso final con siete días completos'; end if;
 if c.storage_reviewed_at is null then raise exception 'Falta revisar los archivos y sus obligaciones de conservación'; end if;
 if c.erasure_approved_at is null or c.erasure_approved_by is null then raise exception 'Falta revisar la conservación legal'; end if;
 if not exists(select 1 from public.profiles where id=c.erasure_approved_by and role='super_admin' and status='active')
 or exists(select 1 from public.user_roles where user_id=c.erasure_approved_by and (not is_active or role<>'super_admin')) then raise exception 'El revisor de la baja no tiene autorización activa'; end if;
 if exists(select 1 from public.organization_erasure_inventory() i left join public.organization_erasure_rules p on p.organization_id=p_organization_id and p.table_name=i.table_name where p.table_name is null) then raise exception 'Hay tablas sin clasificar'; end if;
 if exists(select 1 from public.organization_erasure_rules where organization_id=p_organization_id and disposition='retain' and (retain_until<=now() or legal_basis is null)) then raise exception 'La conservación legal requiere fundamento y plazo vigente'; end if;
 if not exists(select 1 from public.organization_erasure_rules where organization_id=p_organization_id and table_name='organization_members' and disposition='delete') then raise exception 'La baja debe revocar todas las membresías de la empresa'; end if;
 if not exists(select 1 from public.organization_erasure_rules where organization_id=p_organization_id and table_name='subscriptions' and disposition='retain') then raise exception 'La suscripción se conserva para trazabilidad'; end if;
 -- No deletion may cascade to a retained record, even across several relations.
 if exists(
  with recursive effects(oid) as (
   select pc.oid from public.organization_erasure_rules p join pg_catalog.pg_class pc on pc.relname=p.table_name join pg_catalog.pg_namespace ns on ns.oid=pc.relnamespace and ns.nspname='public' where p.organization_id=p_organization_id and p.disposition='delete'
   union select f.conrelid from pg_catalog.pg_constraint f join effects x on x.oid=f.confrelid where f.contype='f' and f.confdeltype in ('c','n','d')
  ) select 1 from effects x join pg_catalog.pg_class pc on pc.oid=x.oid join public.organization_erasure_rules p on p.table_name=pc.relname and p.organization_id=p_organization_id where p.disposition='retain'
 ) then raise exception 'Una cascada afectaría registros legales'; end if;
 -- Non-tenant children can only be removed by a classified cascade. More complex
 -- relationships need a specific migration; do not guess ownership from IDs.
 if exists(select 1 from public.organization_erasure_inventory() i join public.organization_erasure_rules p on p.table_name=i.table_name and p.organization_id=p_organization_id where not i.has_organization_id and p.disposition='delete') then raise exception 'Hay relaciones indirectas que requieren un tratamiento específico'; end if;
 if to_regclass('public.subscription_payments') is not null then
  execute 'select exists(select 1 from public.subscription_payments where organization_id=$1 and status in (''pending'',''processing''))' into unlisted using p_organization_id;
  if unlisted then raise exception 'Hay pagos pendientes de conciliación'; end if;
 end if;
 -- Every tenant-prefixed Storage object must be explicitly reviewed before cutover.
 if to_regclass('storage.objects') is not null then
  execute 'select exists(select 1 from storage.objects o where $1::text=any(string_to_array(o.name,''/'')) and not exists(select 1 from public.organization_erasure_files f where f.organization_id=$1 and f.bucket_id=o.bucket_id and f.object_path=o.name))' into unlisted using p_organization_id;
  if unlisted then raise exception 'Hay archivos sin clasificar'; end if;
  execute 'select exists(select 1 from public.organization_erasure_files f join storage.buckets b on b.id=f.bucket_id where f.organization_id=$1 and f.disposition=''retain'' and (b.public or f.retain_until<=now()))' into unlisted using p_organization_id;
  if unlisted then raise exception 'Un archivo legal debe conservarse en un bucket privado con plazo vigente'; end if;
 end if;
 select to_jsonb(o) into identity_row from public.organizations o where id=p_organization_id for update;
 insert into public.organization_retained_identity(organization_id,identity,retain_until,legal_basis)
 select p_organization_id,jsonb_strip_nulls(jsonb_build_object('name',identity_row->'name','ruc',identity_row->'ruc','tax_id',identity_row->'tax_id','address',identity_row->'address')),max(retain_until),'Identidad del emisor de los registros contables retenidos; Ley 1034/83 art.85 y obligaciones tributarias aplicables'
 from public.organization_erasure_rules where organization_id=p_organization_id and disposition='retain';
 -- Retry restrictive FK dependencies. Any unresolved dependency rolls everything back.
 create temporary table erasure_pending(table_name text primary key) on commit drop;
 insert into erasure_pending select i.table_name from public.organization_erasure_inventory() i join public.organization_erasure_rules p on p.table_name=i.table_name and p.organization_id=p_organization_id where i.has_organization_id and p.disposition='delete';
 loop
  progressed:=false;
  for r in select table_name from erasure_pending loop
   begin
    execute format('delete from public.%I where organization_id=$1',r.table_name) using p_organization_id;
    delete from erasure_pending where table_name=r.table_name; progressed:=true;
   exception when foreign_key_violation then failure:=r.table_name;
   end;
  end loop;
  select count(*) into pending from erasure_pending;
  exit when pending=0;
  if not progressed then raise exception 'Dependencia sin resolver: %',failure; end if;
 end loop;
 update public.organizations set name='Empresa dada de baja',slug='baja-'||id::text,logo_url=null,owner_id=null,storefront_public=false,marketplace_public=false,erased_at=now() where id=p_organization_id;
 for r in select column_name from information_schema.columns where table_schema='public' and table_name='organizations' and is_nullable='YES' and column_name in ('email','phone','address','city','description','website','ruc','tax_id','contact_name','contact_email','contact_phone') loop
  execute format('update public.organizations set %I=null where id=$1',r.column_name) using p_organization_id;
 end loop;
 update public.organization_erasure_files set ready_at=now() where organization_id=p_organization_id and disposition='delete';
 update public.organization_nonrenewal_cycles set erased_at=now() where organization_id=p_organization_id;
 return true;
end $$;

create function public.prevent_erased_organization_renewal() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from public.organizations where id=new.organization_id and erased_at is not null) then raise exception 'La empresa fue dada de baja definitivamente; no se puede renovar'; end if;
 return new;
end $$;
create trigger prevent_erased_organization_renewal before insert or update on public.subscriptions for each row execute function public.prevent_erased_organization_renewal();
revoke all on function public.organization_erasure_inventory() from public,anon,authenticated;
revoke all on function public.complete_nonrenewal_erasure(uuid) from public,anon,authenticated;
revoke all on function public.prevent_erased_organization_renewal() from public,anon,authenticated;
grant execute on function public.organization_erasure_inventory() to service_role;
grant execute on function public.complete_nonrenewal_erasure(uuid) to service_role;
create function public.invalidate_erasure_review() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='DELETE' then
  update public.organization_nonrenewal_cycles set erasure_approved_at=null,erasure_approved_by=null where organization_id=old.organization_id and erased_at is null;
 else
  update public.organization_nonrenewal_cycles set erasure_approved_at=null,erasure_approved_by=null where organization_id=new.organization_id and erased_at is null;
 end if;
 return null;
end $$;
create trigger invalidate_erasure_rule_review after insert or update or delete on public.organization_erasure_rules for each row execute function public.invalidate_erasure_review();
create trigger invalidate_erasure_file_review after insert or delete or update of disposition,object_path,bucket_id,legal_basis,retain_until on public.organization_erasure_files for each row execute function public.invalidate_erasure_review();
revoke all on function public.invalidate_erasure_review() from public,anon,authenticated;
commit;