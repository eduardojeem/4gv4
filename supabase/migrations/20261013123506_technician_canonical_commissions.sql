-- Keep original sales and reversal logic; choose repair events before period filtering.
-- Technician-linked rules share a canonical repair/component identity across basis changes.
begin;
CREATE OR REPLACE FUNCTION public.calculate_earned_commissions(p_organization_id uuid, p_period_from date, p_period_to date, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare
  actor_id uuid := auth.uid();
  organization_timezone text := 'America/Asuncion';
  accrual_count integer := 0;
  terminal_reversal_count integer := 0;
  refund_reversal_count integer := 0;
begin
  if p_organization_id is null then
    raise exception 'PAYROLL_ORGANIZATION_REQUIRED';
  end if;
  if p_period_from is null or p_period_to is null or p_period_to < p_period_from then
    raise exception 'PAYROLL_INVALID_PERIOD';
  end if;
  if actor_id is not null and not (
    public.has_org_permission(p_organization_id, 'finances.manage')
    or public.get_user_role(actor_id) = 'super_admin'
  ) then
    raise exception 'PAYROLL_COMMISSION_PERMISSION_DENIED';
  end if;
  if p_branch_id is not null then
    if not exists (
      select 1
      from public.branches branch
      where branch.organization_id = p_organization_id
        and branch.id = p_branch_id
        and branch.is_active = true
    ) then
      raise exception 'PAYROLL_BRANCH_NOT_IN_ORGANIZATION';
    end if;
    if actor_id is not null and not public.user_has_branch_access(p_branch_id, actor_id) then
      raise exception 'PAYROLL_BRANCH_PERMISSION_DENIED';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_organization_id::text || ':earned-commissions',
    0
  ));

  select timezone_record.name
  into organization_timezone
  from public.organization_settings settings
  join pg_timezone_names timezone_record
    on timezone_record.name = settings.timezone
  where settings.organization_id = p_organization_id
  limit 1;
  organization_timezone := coalesce(organization_timezone, 'America/Asuncion');

  with operation_candidates as (
    select
      'sale:' || attribution.source_id::text as candidate_key,
      attribution.employee_id,
      attribution.employee_role,
      attribution.branch_id,
      'sale'::text as source_type,
      null::uuid as source_reference_id,
      null::text as accrual_status,
      'sale'::text as origin_type,
      attribution.source_id as origin_id,
      attribution.source_id as parent_origin_id,
      null::numeric(14, 4) as source_quantity,
      attribution.occurred_at,
      (attribution.occurred_at at time zone organization_timezone)::date as occurred_on,
      attribution.basis_amount
    from public.commission_operation_attributions attribution
    where attribution.organization_id = p_organization_id
      and attribution.source_type = 'sale'
      and (p_branch_id is null or attribution.branch_id = p_branch_id)
      and (attribution.occurred_at at time zone organization_timezone)::date
        between p_period_from and p_period_to
      and attribution.basis_amount > 0

    union all

    select
      'product:' || item_attribution.sale_item_id::text,
      attribution.employee_id,
      attribution.employee_role,
      attribution.branch_id,
      'product'::text,
      item_attribution.product_id,
      null::text,
      'sale_item'::text,
      item_attribution.sale_item_id,
      item_attribution.sale_id,
      item_attribution.quantity,
      attribution.occurred_at,
      (attribution.occurred_at at time zone organization_timezone)::date,
      item_attribution.subtotal::numeric(14, 2)
    from public.commission_operation_attributions attribution
    join public.commission_sale_item_attributions item_attribution
      on item_attribution.organization_id = attribution.organization_id
     and item_attribution.sale_id = attribution.source_id
    where attribution.organization_id = p_organization_id
      and attribution.source_type = 'sale'
      and (p_branch_id is null or attribution.branch_id = p_branch_id)
      and (attribution.occurred_at at time zone organization_timezone)::date
        between p_period_from and p_period_to
      and item_attribution.product_id is not null
      and item_attribution.subtotal > 0

    union all

    select
      'category:' || item_attribution.sale_item_id::text,
      attribution.employee_id,
      attribution.employee_role,
      attribution.branch_id,
      'category'::text,
      item_attribution.category_id,
      null::text,
      'sale_item'::text,
      item_attribution.sale_item_id,
      item_attribution.sale_id,
      item_attribution.quantity,
      attribution.occurred_at,
      (attribution.occurred_at at time zone organization_timezone)::date,
      item_attribution.subtotal::numeric(14, 2)
    from public.commission_operation_attributions attribution
    join public.commission_sale_item_attributions item_attribution
      on item_attribution.organization_id = attribution.organization_id
     and item_attribution.sale_id = attribution.source_id
    where attribution.organization_id = p_organization_id
      and attribution.source_type = 'sale'
      and (p_branch_id is null or attribution.branch_id = p_branch_id)
      and (attribution.occurred_at at time zone organization_timezone)::date
        between p_period_from and p_period_to
      and item_attribution.category_id is not null
      and item_attribution.subtotal > 0

    union all

    select
      'repair:' || attribution.source_id::text,
      attribution.employee_id,
      attribution.employee_role,
      attribution.branch_id,
      'repair'::text,
      null::uuid,
      attribution.accrual_status,
      'repair'::text,
      attribution.source_id,
      attribution.source_id,
      null::numeric(14, 4),
      attribution.occurred_at,
      (attribution.occurred_at at time zone organization_timezone)::date,
      attribution.basis_amount
    from public.commission_operation_attributions attribution
    where attribution.organization_id = p_organization_id
      and attribution.source_type = 'repair'
      and attribution.basis_amount >= 0

    union all

    select
      'repair-labor:' || attribution.source_id::text,
      attribution.employee_id,
      attribution.employee_role,
      attribution.branch_id,
      'repair_labor'::text,
      null::uuid,
      attribution.accrual_status,
      'repair'::text,
      attribution.source_id,
      attribution.source_id,
      null::numeric(14, 4),
      attribution.occurred_at,
      (attribution.occurred_at at time zone organization_timezone)::date,
      attribution.labor_basis_amount
    from public.commission_operation_attributions attribution
    where attribution.organization_id = p_organization_id
      and attribution.source_type = 'repair'
      and attribution.labor_basis_amount >= 0
  ),
  ranked_rules as (
    select
      candidate.*,
      rule_origin.technician_rule,
      rule.id as commission_rule_id,
      rule.calculation_type,
      rule.value,
      row_number() over (
        partition by case when rule_origin.technician_rule
          then 'technician-repair:' || candidate.origin_id::text
          else candidate.candidate_key end, rule.calculation_type
        order by
          case when rule.scope_type = 'employee' then 1 else 0 end desc,
          case when rule.branch_id is not null then 1 else 0 end desc,
          candidate.occurred_at,
          rule.effective_from desc,
          rule.id
      ) as rule_rank
    from operation_candidates candidate
    join public.commission_rules rule
      on rule.organization_id = p_organization_id
     and rule.status = 'approved'
     and rule.source_type = candidate.source_type
     and (rule.branch_id is null or rule.branch_id = candidate.branch_id)
     and rule.effective_from <= candidate.occurred_on
     and (rule.effective_to is null or rule.effective_to >= candidate.occurred_on)
     and candidate.occurred_on >= coalesce(rule.legacy_cutover_on, rule.effective_from)
     and rule.source_reference_id is not distinct from candidate.source_reference_id
     and (
       candidate.source_type not in ('repair', 'repair_labor')
       or (
         rule.accrual_status = 'entregado'
         and candidate.accrual_status = 'entregado'
       )
       or (
         rule.accrual_status = 'listo'
         and candidate.accrual_status in ('listo', 'entregado')
       )
     )
     and (
       (
         rule.scope_type = 'employee'
         and rule.employee_id = candidate.employee_id
       )
       or (
         rule.scope_type = 'role'
         and rule.role = candidate.employee_role
       )
     )
    cross join lateral (
      select candidate.source_type in ('repair','repair_labor') and (
        exists(select 1 from public.technician_compensation_versions v
          where v.id=rule.legacy_source_id and v.organization_id=p_organization_id
            and v.technician_id=candidate.employee_id)
        or exists(select 1 from public.technician_compensation c
          where c.id=rule.legacy_source_id and c.organization_id=p_organization_id
            and c.technician_id=candidate.employee_id)
      ) as technician_rule
    ) rule_origin
  )
  insert into public.earned_commissions (
    organization_id,
    branch_id,
    employee_id,
    commission_rule_id,
    entry_kind,
    source_type,
    origin_type,
    origin_id,
    origin_key,
    occurred_on,
    basis_amount,
    amount,
    employee_role,
    rule_snapshot
  )
  select
    p_organization_id,
    ranked.branch_id,
    ranked.employee_id,
    ranked.commission_rule_id,
    'accrual',
    ranked.source_type,
    ranked.origin_type,
    ranked.origin_id,
    'accrual:' || case when ranked.technician_rule then 'technician_repair' else ranked.source_type end
      || ':' || ranked.origin_id::text || ':' || ranked.calculation_type,
    ranked.occurred_on,
    ranked.basis_amount,
    case ranked.calculation_type
      when 'percentage' then round(ranked.basis_amount * ranked.value / 100, 2)
      else ranked.value
    end,
    ranked.employee_role,
    jsonb_build_object(
      'calculation_type', ranked.calculation_type,
      'value', ranked.value,
      'source_type', ranked.source_type,
      'accrual_status', ranked.accrual_status,
      'parent_origin_id', ranked.parent_origin_id,
      'source_quantity', ranked.source_quantity
    )
  from ranked_rules ranked
  where ranked.rule_rank = 1
    and ranked.occurred_on between p_period_from and p_period_to
    and (p_branch_id is null or ranked.branch_id = p_branch_id)
    and (not ranked.technician_rule or not exists (
      select 1 from public.earned_commissions existing
      left join public.commission_rules existing_rule on existing_rule.id=existing.commission_rule_id
        and existing_rule.organization_id=existing.organization_id
      where existing.organization_id=p_organization_id and existing.entry_kind='accrual'
        and existing.origin_type='repair' and existing.origin_id=ranked.origin_id
        and existing.source_type in ('repair','repair_labor')
        and coalesce(existing.rule_snapshot->>'calculation_type',existing_rule.calculation_type)=ranked.calculation_type
    ))
    and case ranked.calculation_type
      when 'percentage' then round(ranked.basis_amount * ranked.value / 100, 2)
      else ranked.value
    end > 0
  on conflict (organization_id, origin_key) do nothing;

  get diagnostics accrual_count = row_count;

  with terminal_events as (
    select
      commission.id as accrual_id,
      terminal_event.source_id as terminal_origin_id,
      (terminal_event.occurred_at at time zone organization_timezone)::date as reversed_on
    from public.earned_commissions commission
    join public.commission_terminal_events terminal_event
      on commission.origin_type = 'sale'
     and terminal_event.organization_id = commission.organization_id
     and terminal_event.branch_id = commission.branch_id
     and terminal_event.source_type = 'sale'
     and terminal_event.source_id = commission.origin_id
    where commission.organization_id = p_organization_id
      and commission.entry_kind = 'accrual'
      and (p_branch_id is null or commission.branch_id = p_branch_id)
      and (terminal_event.occurred_at at time zone organization_timezone)::date
        <= p_period_to

    union all

    select
      commission.id,
      terminal_event.source_id,
      (terminal_event.occurred_at at time zone organization_timezone)::date
    from public.earned_commissions commission
    join public.commission_terminal_events terminal_event
      on terminal_event.organization_id = commission.organization_id
     and terminal_event.branch_id = commission.branch_id
     and terminal_event.source_type = 'sale'
     and terminal_event.source_id = (
       commission.rule_snapshot ->> 'parent_origin_id'
     )::uuid
    where commission.organization_id = p_organization_id
      and commission.entry_kind = 'accrual'
      and commission.origin_type = 'sale_item'
      and (p_branch_id is null or commission.branch_id = p_branch_id)
      and (terminal_event.occurred_at at time zone organization_timezone)::date
        <= p_period_to

    union all

    select
      commission.id,
      terminal_event.source_id,
      (terminal_event.occurred_at at time zone organization_timezone)::date
    from public.earned_commissions commission
    join public.commission_terminal_events terminal_event
      on commission.origin_type = 'repair'
     and terminal_event.organization_id = commission.organization_id
     and terminal_event.branch_id = commission.branch_id
     and terminal_event.source_type = 'repair'
     and terminal_event.source_id = commission.origin_id
    where commission.organization_id = p_organization_id
      and commission.entry_kind = 'accrual'
      and (p_branch_id is null or commission.branch_id = p_branch_id)
      and (terminal_event.occurred_at at time zone organization_timezone)::date
        <= p_period_to
  ),
  terminal_accruals as (
    select distinct on (event.accrual_id)
      accrual.*,
      event.terminal_origin_id,
      event.reversed_on,
      greatest(
        accrual.amount + coalesce(sum(existing_reversal.amount), 0),
        0
      )::numeric(14, 2) as remaining_amount
    from terminal_events event
    join public.earned_commissions accrual
      on accrual.organization_id = p_organization_id
     and accrual.id = event.accrual_id
    left join public.earned_commissions existing_reversal
      on existing_reversal.organization_id = accrual.organization_id
     and existing_reversal.reverses_commission_id = accrual.id
     and existing_reversal.entry_kind = 'reversal'
    group by accrual.id, event.accrual_id, event.terminal_origin_id, event.reversed_on
    order by event.accrual_id, event.reversed_on, event.terminal_origin_id
  )
  insert into public.earned_commissions (
    organization_id,
    branch_id,
    employee_id,
    commission_rule_id,
    entry_kind,
    source_type,
    origin_type,
    origin_id,
    origin_key,
    reverses_commission_id,
    occurred_on,
    basis_amount,
    amount,
    employee_role,
    rule_snapshot
  )
  select
    terminal.organization_id,
    terminal.branch_id,
    terminal.employee_id,
    terminal.commission_rule_id,
    'reversal',
    terminal.source_type,
    'terminal_status',
    terminal.terminal_origin_id,
    'terminal-status:' || terminal.terminal_origin_id::text
      || ':' || terminal.id::text,
    terminal.id,
    terminal.reversed_on,
    terminal.basis_amount,
    -terminal.remaining_amount,
    terminal.employee_role,
    terminal.rule_snapshot || jsonb_build_object('reversal_reason', 'terminal_status')
  from terminal_accruals terminal
  where terminal.remaining_amount > 0
  on conflict (organization_id, origin_key) do nothing;

  get diagnostics terminal_reversal_count = row_count;

  with refund_matches as (
    select
      accrual.*,
      refund_event.id as refund_case_id,
      (refund_event.occurred_at at time zone organization_timezone)::date as refunded_on,
      least(
        1::numeric,
        greatest(
          0::numeric,
          case
            when accrual.origin_type = 'sale_item'
                 and refund_event.sale_item_id is not null then
              coalesce(
                refund_event.refund_quantity
                  / nullif(refund_event.source_quantity, 0),
                1
              )
            when refund_event.sale_id is not null then
              coalesce(
                refund_event.refund_amount / nullif(refund_event.source_amount, 0),
                1
              )
            when refund_event.repair_id is not null then
              coalesce(
                refund_event.refund_amount / nullif(refund_event.source_amount, 0),
                1
              )
            else 1
          end
        )
      ) as refund_ratio
    from public.commission_refund_events refund_event
    join public.earned_commissions accrual
      on accrual.organization_id = refund_event.organization_id
     and accrual.entry_kind = 'accrual'
     and (
       (accrual.origin_type = 'sale' and accrual.origin_id = refund_event.sale_id)
       or (
         accrual.origin_type = 'sale_item'
         and (accrual.rule_snapshot ->> 'parent_origin_id')::uuid = refund_event.sale_id
         and (
           refund_event.sale_item_id is null
           or refund_event.sale_item_id = accrual.origin_id
         )
       )
       or (accrual.origin_type = 'repair' and accrual.origin_id = refund_event.repair_id)
     )
    where refund_event.organization_id = p_organization_id
      and (p_branch_id is null or accrual.branch_id = p_branch_id)
      and (refund_event.occurred_at at time zone organization_timezone)::date
        <= p_period_to
      and not exists (
        select 1
        from public.earned_commissions materialized_reversal
        where materialized_reversal.organization_id = accrual.organization_id
          and materialized_reversal.origin_key = 'after-sales:'
            || refund_event.id::text || ':' || accrual.id::text
      )
  ),
  requested_refunds as (
    select
      refund.*,
      round(refund.amount * refund.refund_ratio, 2) as requested_amount,
      coalesce((
        select sum(existing_reversal.amount)
        from public.earned_commissions existing_reversal
        where existing_reversal.organization_id = refund.organization_id
          and existing_reversal.reverses_commission_id = refund.id
          and existing_reversal.entry_kind = 'reversal'
      ), 0) as existing_reversals
    from refund_matches refund
  ),
  bounded_refunds as (
    select
      requested.*,
      least(
        requested.requested_amount,
        greatest(
          requested.amount + requested.existing_reversals
            - coalesce(sum(requested.requested_amount) over (
                partition by requested.id
                order by requested.refunded_on, requested.refund_case_id
                rows between unbounded preceding and 1 preceding
              ), 0),
          0
        )
      )::numeric(14, 2) as reversal_amount
    from requested_refunds requested
  )
  insert into public.earned_commissions (
    organization_id,
    branch_id,
    employee_id,
    commission_rule_id,
    entry_kind,
    source_type,
    origin_type,
    origin_id,
    origin_key,
    reverses_commission_id,
    occurred_on,
    basis_amount,
    amount,
    employee_role,
    rule_snapshot
  )
  select
    refund.organization_id,
    refund.branch_id,
    refund.employee_id,
    refund.commission_rule_id,
    'reversal',
    refund.source_type,
    'after_sales',
    refund.refund_case_id,
    'after-sales:' || refund.refund_case_id::text || ':' || refund.id::text,
    refund.id,
    refund.refunded_on,
    refund.basis_amount,
    -refund.reversal_amount,
    refund.employee_role,
    refund.rule_snapshot || jsonb_build_object(
      'reversal_reason', 'refund',
      'refund_ratio', refund.refund_ratio
    )
  from bounded_refunds refund
  where refund.reversal_amount > 0
  on conflict (organization_id, origin_key) do nothing;

  get diagnostics refund_reversal_count = row_count;

  return accrual_count + terminal_reversal_count + refund_reversal_count;
end;
$function$
;
revoke all on function public.calculate_earned_commissions(uuid,date,date,uuid) from public,anon;
grant execute on function public.calculate_earned_commissions(uuid,date,date,uuid) to authenticated,service_role;
commit;
