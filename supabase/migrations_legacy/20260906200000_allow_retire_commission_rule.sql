-- Permite que una regla aprobada pueda ser retirada (cambiar status a 'retired' y/o cerrar su fecha de vigencia)
create or replace function public.protect_approved_commission_rule()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor_fk_nulling_only boolean := false;
  safe_effective_close boolean := false;
  safe_retire boolean := false;
  organization_today date;
begin
  if tg_op = 'DELETE' and old.status = 'approved' then
    raise exception 'PAYROLL_APPROVED_COMMISSION_RULE_IS_IMMUTABLE';
  end if;
  if tg_op <> 'UPDATE' or old.status <> 'approved' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  organization_today := public.payroll_organization_date(old.organization_id, now());

  actor_fk_nulling_only :=
    to_jsonb(new) - 'approved_by' - 'created_by' - 'updated_at'
      = to_jsonb(old) - 'approved_by' - 'created_by' - 'updated_at'
    and (
      (
        old.approved_by is not null and new.approved_by is null
        and not exists (select 1 from auth.users actor where actor.id = old.approved_by)
      )
      or (
        old.created_by is not null and new.created_by is null
        and not exists (select 1 from auth.users actor where actor.id = old.created_by)
      )
    )
    and (
      new.approved_by is not distinct from old.approved_by
      or (
        old.approved_by is not null and new.approved_by is null
        and not exists (select 1 from auth.users actor where actor.id = old.approved_by)
      )
    )
    and (
      new.created_by is not distinct from old.created_by
      or (
        old.created_by is not null and new.created_by is null
        and not exists (select 1 from auth.users actor where actor.id = old.created_by)
      )
    );

  if actor_fk_nulling_only then
    return new;
  end if;

  -- Caso 1: Cierre de vigencia manteniendo approved
  safe_effective_close :=
    to_jsonb(new) - 'effective_to' - 'updated_at'
      = to_jsonb(old) - 'effective_to' - 'updated_at'
    and new.effective_to is not null
    and new.effective_to >= old.effective_from
    and new.effective_to >= organization_today
    and (old.effective_to is null or new.effective_to <= old.effective_to)
    and not exists (
      select 1
      from public.earned_commissions commission
      where commission.organization_id = old.organization_id
        and commission.commission_rule_id = old.id
        and commission.occurred_on > new.effective_to
    );

  if safe_effective_close then
    return new;
  end if;

  -- Caso 2: Retiro formal de la regla (status = 'retired')
  safe_retire :=
    to_jsonb(new) - 'status' - 'effective_to' - 'updated_at'
      = to_jsonb(old) - 'status' - 'effective_to' - 'updated_at'
    and new.status = 'retired'
    and (
      new.effective_to is null
      or (
        new.effective_to >= old.effective_from
        and not exists (
          select 1
          from public.earned_commissions commission
          where commission.organization_id = old.organization_id
            and commission.commission_rule_id = old.id
            and commission.occurred_on > new.effective_to
        )
      )
    );

  if safe_retire then
    return new;
  end if;

  raise exception 'PAYROLL_APPROVED_COMMISSION_RULE_IS_IMMUTABLE';
end;
$$;
