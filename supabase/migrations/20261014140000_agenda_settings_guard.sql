begin;

-- Generated with the CLI; ordered after the existing agenda foundations.
-- No new public grants, no appointment changes, no automatic publication.
create or replace function public.save_agenda_settings_checked(
  p_org uuid, p_settings jsonb, p_services jsonb, p_actor uuid, p_expected_revision bigint
) returns void language plpgsql security invoker set search_path = '' as $$
declare current_revision bigint; item jsonb;
begin
  perform public.agenda_lock(p_org);
  perform public.agenda_assert_actor(p_org,p_actor,true);
  select booking_revision into current_revision from public.agenda_settings
    where organization_id=p_org for update;
  if p_expected_revision is null or p_expected_revision < 0
    or coalesce(current_revision,0) <> p_expected_revision then
    raise exception 'AGENDA_SETTINGS_CHANGED';
  end if;
  if jsonb_typeof(p_services) is distinct from 'array' or jsonb_array_length(p_services)>500 then
    raise exception 'INVALID_SETTINGS';
  end if;
  if (p_settings->>'online_booking')::boolean and p_settings->>'professional_selection'='required' then
    if not exists(select 1 from public.agenda_professionals p where p.organization_id=p_org
      and p.is_active and p.online_visible and (p.opening_hours is null or exists(
        select 1 from jsonb_each(p.opening_hours) h where jsonb_array_length(h.value)>0))) then
      raise exception 'NO_ELIGIBLE_PROFESSIONAL';
    end if;
    for item in select value from jsonb_array_elements(p_services) loop
      if (item->>'online')::boolean and exists(select 1 from public.products where organization_id=p_org
        and id=(item->>'product_id')::uuid and visibility='public' and is_active)
        and not exists(select 1 from public.agenda_professionals p where p.organization_id=p_org
          and p.is_active and p.online_visible
          and (p.opening_hours is null or exists(select 1 from jsonb_each(p.opening_hours) h where jsonb_array_length(h.value)>0))
          and (not exists(select 1 from public.agenda_professional_services a where a.organization_id=p_org and a.professional_id=p.id)
            or exists(select 1 from public.agenda_professional_services a where a.organization_id=p_org
              and a.professional_id=p.id and a.product_id=(item->>'product_id')::uuid))) then
        raise exception 'NO_ELIGIBLE_PROFESSIONAL';
      end if;
    end loop;
  end if;
  perform public.save_agenda_settings(p_org,p_settings,p_services,p_actor);
end;
$$;
revoke all on function public.save_agenda_settings_checked(uuid,jsonb,jsonb,uuid,bigint) from public,anon,authenticated;
grant execute on function public.save_agenda_settings_checked(uuid,jsonb,jsonb,uuid,bigint) to service_role;
commit;
