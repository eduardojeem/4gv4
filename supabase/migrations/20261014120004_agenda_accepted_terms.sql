begin;

-- Preserve applied booking logic; only the service-role wrapper is externally callable.
alter function public.save_agenda_appointment(uuid,uuid,jsonb,uuid) rename to save_agenda_appointment_base_v1;
revoke all on function public.save_agenda_appointment_base_v1(uuid,uuid,jsonb,uuid) from public,anon,authenticated,service_role;

create function public.save_agenda_appointment(p_org uuid,p_id uuid,p_input jsonb,p_actor uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare old public.appointments; result jsonb; accepted jsonb; changed boolean := false;
begin
  perform public.agenda_lock(p_org);
  perform public.agenda_assert_actor(p_org,p_actor,false);
  if p_id is not null then
    select * into old from public.appointments where organization_id=p_org and id=p_id for update;
    if not found then raise exception 'APPOINTMENT_NOT_CHANGEABLE'; end if;
    changed := old.professional_id is distinct from (p_input->>'professional_id')::uuid
      or old.service_product_id is distinct from (p_input->>'service_product_id')::uuid;
    if changed then
      accepted := p_input->'accepted_terms';
      if not coalesce((p_input->>'accept_new_terms')::boolean,false)
        or accepted is null or jsonb_typeof(accepted) <> 'object'
        or not (accepted ?& array['price','duration_minutes','buffer_minutes'])
        or accepted->>'price' is null or accepted->>'duration_minutes' is null or accepted->>'buffer_minutes' is null
      then raise exception 'NEW_TERMS_ACCEPTANCE_REQUIRED'; end if;
    end if;
  end if;
  result := public.save_agenda_appointment_base_v1(p_org,p_id,p_input,p_actor);
  -- Same transaction and organization lock: stale acceptance rolls back ALL writes/events.
  if changed and (
    (accepted->>'price')::numeric is distinct from (result->>'price')::numeric
    or (accepted->>'duration_minutes')::integer is distinct from
      (extract(epoch from (result->>'ends_at')::timestamptz-(result->>'starts_at')::timestamptz)::integer / 60)
    or (accepted->>'buffer_minutes')::integer is distinct from (result->>'buffer_minutes')::integer
  ) then raise exception 'ACCEPTED_TERMS_CHANGED'; end if;
  return result;
end $$;
revoke all on function public.save_agenda_appointment(uuid,uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.save_agenda_appointment(uuid,uuid,jsonb,uuid) to service_role;
create or replace function public.agenda_booking_version() returns integer language sql stable set search_path='' as $$ select 3 $$;
commit;
