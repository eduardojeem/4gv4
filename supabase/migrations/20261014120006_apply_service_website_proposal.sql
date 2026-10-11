begin;

-- Read a single deterministic snapshot. Only server code may call these helpers.
create or replace function public.service_website_proposal_snapshot(p_organization_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'organization', (select to_jsonb(o) from public.organizations o where o.id=p_organization_id),
    'settings', coalesce((select jsonb_object_agg(w.key,w.value order by w.key) from public.website_settings w where w.organization_id=p_organization_id),'{}'::jsonb),
    'settingsRevision', coalesce((select jsonb_agg(jsonb_build_array(w.key,w.updated_at) order by w.key) from public.website_settings w where w.organization_id=p_organization_id),'[]'::jsonb),
    'plans', coalesce((select jsonb_agg(to_jsonb(p) order by to_jsonb(p)::text) from public.plans p),'[]'::jsonb),
    'subscriptions', coalesce((select jsonb_agg(to_jsonb(s) order by to_jsonb(s)::text) from public.subscriptions s where s.organization_id=p_organization_id),'[]'::jsonb),
    'trials', coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.organization_module_trials t where t.organization_id=p_organization_id),'[]'::jsonb)
  );
$$;

create or replace function public.service_website_proposal_revision(p_organization_id uuid)
returns text language sql stable security invoker set search_path = '' as $$
  select md5(public.service_website_proposal_snapshot(p_organization_id)::text);
$$;

create or replace function public.apply_service_website_proposal(
  p_organization_id uuid, p_actor_user_id uuid, p_expected_revision text, p_values jsonb
) returns void language plpgsql security invoker set search_path = '' as $$
declare v_revision text; v_key text; v_value jsonb;
begin
  if p_actor_user_id is null or p_organization_id is null then raise exception 'INVALID_ACTOR'; end if;
  -- Covers INSERT of previously absent keys and existing editors using ordinary
  -- UPDATE/upsert (RowExclusiveLock), without changing those writers' contracts.
  -- Locks last for this short transaction only; no network work inside the RPC.
  lock table public.organizations, public.website_settings, public.plans,
    public.subscriptions, public.organization_module_trials in share row exclusive mode;
  if not exists(select 1 from public.organizations where id=p_organization_id) then raise exception 'ORGANIZATION_NOT_FOUND'; end if;
  v_revision := public.service_website_proposal_revision(p_organization_id);
  if p_expected_revision is null or v_revision <> p_expected_revision then raise exception 'PROPOSAL_STALE'; end if;
  if p_values is null or jsonb_typeof(p_values) <> 'object' or p_values = '{}'::jsonb then raise exception 'INVALID_PROPOSAL_KEYS'; end if;
  if exists(select 1 from jsonb_object_keys(p_values) k where k <> all(array['company_info','hero_content','trust_bar','process_flows','booking_section'])) then raise exception 'INVALID_PROPOSAL_KEYS'; end if;
  for v_key,v_value in select key,value from jsonb_each(p_values) loop
    insert into public.website_settings(organization_id,key,value,updated_by,updated_at)
    values(p_organization_id,v_key,v_value,p_actor_user_id,clock_timestamp())
    on conflict(organization_id,key) do update set value=excluded.value,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
  end loop;
  insert into public.tenant_audit_log(organization_id,user_id,action,resource,resource_id,metadata)
  values(p_organization_id,p_actor_user_id,'website.service_proposal.applied','website_settings',p_organization_id,
    jsonb_build_object('previousRevision',v_revision,'keys',(select jsonb_agg(k) from jsonb_object_keys(p_values) k)));
end;
$$;

revoke all on function public.service_website_proposal_snapshot(uuid) from public,anon,authenticated;
revoke all on function public.service_website_proposal_revision(uuid) from public,anon,authenticated;
revoke all on function public.apply_service_website_proposal(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.service_website_proposal_snapshot(uuid) to service_role;
grant execute on function public.service_website_proposal_revision(uuid) to service_role;
grant execute on function public.apply_service_website_proposal(uuid,uuid,text,jsonb) to service_role;

commit;
