-- Verificación técnica previa a la entrega. Conserva un historial inmutable y
-- deja en repairs solamente la referencia al control vigente.

begin;

-- Mantiene alineados los permisos RLS con la separación entre editar una
-- reparación y entregarla. Caja puede consultar y entregar, pero no alterar
-- el trabajo técnico ni registrar la verificación.
create or replace function public.has_org_permission(target_organization_id uuid, permission_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  member_role public.organization_role;
begin
  member_role := public.get_org_role(target_organization_id);

  if member_role is null then return false; end if;
  if member_role = 'owner' then return true; end if;
  if member_role = 'admin' then return permission_name <> 'billing.manage'; end if;

  if member_role = 'manager' then
    return permission_name = any(array[
      'inventory.products.read', 'inventory.products.create', 'inventory.products.update',
      'inventory.stock.manage', 'pos.sales.read', 'pos.sales.create', 'pos.cash.manage',
      'repairs.orders.read', 'repairs.orders.create', 'repairs.orders.update',
      'repairs.orders.assign', 'repairs.orders.deliver', 'crm.customers.read',
      'crm.customers.manage', 'promotions.read', 'promotions.create',
      'promotions.update', 'analytics.read'
    ]);
  end if;

  if member_role = 'cashier' then
    return permission_name = any(array[
      'inventory.products.read', 'pos.sales.read', 'pos.sales.create',
      'pos.cash.manage', 'crm.customers.read', 'repairs.orders.read',
      'repairs.orders.deliver'
    ]);
  end if;

  if member_role = 'technician' then
    return permission_name = any(array[
      'inventory.products.read', 'inventory.stock.manage', 'repairs.orders.read',
      'repairs.orders.update', 'repairs.orders.deliver'
    ]);
  end if;

  if member_role = 'seller' then
    return permission_name = any(array[
      'inventory.products.read', 'pos.sales.read', 'pos.sales.create',
      'crm.customers.read', 'crm.customers.manage', 'promotions.read',
      'promotions.create', 'promotions.update'
    ]);
  end if;

  return member_role = 'customer' and permission_name = 'repairs.orders.read';
end;
$$;

create table if not exists public.repair_quality_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  repair_id uuid not null references public.repairs(id) on delete restrict,
  result text not null check (result in ('passed', 'failed', 'unrepairable', 'withdrawn')),
  checklist jsonb not null default '{}'::jsonb check (jsonb_typeof(checklist) = 'object'),
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists repair_quality_checks_repair_created_idx
  on public.repair_quality_checks (repair_id, created_at desc);
create index if not exists repair_quality_checks_scope_created_idx
  on public.repair_quality_checks (organization_id, branch_id, created_at desc);

alter table public.repairs
  add column if not exists current_quality_check_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'repairs_current_quality_check_fk'
  ) then
    alter table public.repairs
      add constraint repairs_current_quality_check_fk
      foreign key (current_quality_check_id)
      references public.repair_quality_checks(id)
      on delete set null;
  end if;
end $$;

alter table public.repair_quality_checks enable row level security;
revoke all on table public.repair_quality_checks from public, anon;
revoke insert, update, delete on table public.repair_quality_checks from authenticated;
grant select on table public.repair_quality_checks to authenticated;
grant all on table public.repair_quality_checks to service_role;

drop policy if exists "tenant staff can read repair quality checks" on public.repair_quality_checks;
create policy "tenant staff can read repair quality checks"
on public.repair_quality_checks for select to authenticated
using (
  public.has_org_permission(organization_id, 'repairs.orders.read')
  or public.has_org_permission(organization_id, 'repairs.orders.update')
  or public.has_org_permission(organization_id, 'repairs.orders.deliver')
);

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
  next_status text;
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
        then 'Falló la prueba funcional: ' || trim(coalesce(p_note, ''))
        else 'Verificación técnica: ' || p_result
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

revoke all on function public.record_repair_quality_check(uuid,uuid,uuid,uuid,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.record_repair_quality_check(uuid,uuid,uuid,uuid,text,jsonb,text) to service_role;

comment on table public.repair_quality_checks is
  'Historial inmutable de verificaciones funcionales realizadas antes de entregar una reparación.';

commit;
