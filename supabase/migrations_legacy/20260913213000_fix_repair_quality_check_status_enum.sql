-- Corrige el estado calculado por la verificacion tecnica para que use el
-- mismo enum que repairs.status y repair_status_history.

begin;

create or replace function public.record_repair_quality_check(
  p_repair_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_actor_id uuid,
  p_result text,
  p_checklist jsonb,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_repair public.repairs%rowtype;
  created_check public.repair_quality_checks%rowtype;
  operation_time timestamptz := now();
  next_status public.repair_status;
begin
  if p_result not in ('passed', 'failed', 'unrepairable', 'withdrawn') then
    raise exception 'REPAIR_QUALITY_INVALID_RESULT';
  end if;
  if jsonb_typeof(coalesce(p_checklist, '{}'::jsonb)) <> 'object' then
    raise exception 'REPAIR_QUALITY_INVALID_CHECKLIST';
  end if;
  if p_result = 'passed' and not (
    coalesce((p_checklist->>'powersOn')::boolean, false)
    and coalesce((p_checklist->>'reportedIssueResolved')::boolean, false)
    and coalesce((p_checklist->>'basicFunctions')::boolean, false)
    and coalesce((p_checklist->>'physicalCondition')::boolean, false)
    and coalesce((p_checklist->>'accessoriesVerified')::boolean, false)
  ) then
    raise exception 'REPAIR_QUALITY_CHECKLIST_INCOMPLETE';
  end if;
  if p_result <> 'passed' and char_length(trim(coalesce(p_note, ''))) < 5 then
    raise exception 'REPAIR_QUALITY_NOTE_REQUIRED';
  end if;

  select * into target_repair
  from public.repairs
  where id = p_repair_id
    and organization_id = p_organization_id
    and branch_id = p_branch_id
  for update;

  if not found then raise exception 'REPAIR_NOT_FOUND'; end if;
  if target_repair.status in ('entregado', 'cancelado') then
    raise exception 'REPAIR_QUALITY_INVALID_STATE';
  end if;
  if target_repair.technician_id is null then
    raise exception 'REPAIR_TECHNICIAN_REQUIRED';
  end if;

  next_status := case when p_result = 'failed' then 'reparacion' else 'listo' end;

  insert into public.repair_quality_checks (
    organization_id, branch_id, repair_id, result, checklist, note, created_by, created_at
  ) values (
    p_organization_id, p_branch_id, p_repair_id, p_result, coalesce(p_checklist, '{}'::jsonb),
    nullif(trim(coalesce(p_note, '')), ''), p_actor_id, operation_time
  ) returning * into created_check;

  update public.repairs
  set current_quality_check_id = created_check.id,
      status = next_status,
      completed_at = case when next_status = 'listo' then coalesce(completed_at, operation_time) else null end,
      updated_at = operation_time
  where id = p_repair_id;

  if target_repair.status is distinct from next_status then
    insert into public.repair_status_history (
      repair_id, organization_id, old_status, new_status, changed_by, notes
    ) values (
      p_repair_id, p_organization_id, target_repair.status, next_status, p_actor_id,
      case when p_result = 'failed'
        then 'Fallo la prueba funcional: ' || trim(coalesce(p_note, ''))
        else 'Verificacion tecnica: ' || p_result
      end
    );
  end if;

  return jsonb_build_object(
    'repair_id', p_repair_id,
    'quality_check_id', created_check.id,
    'result', created_check.result,
    'status', next_status,
    'checked_at', created_check.created_at
  );
end;
$$;

revoke all on function public.record_repair_quality_check(uuid,uuid,uuid,uuid,text,jsonb,text)
  from public, anon, authenticated;
grant execute on function public.record_repair_quality_check(uuid,uuid,uuid,uuid,text,jsonb,text)
  to service_role;

commit;
