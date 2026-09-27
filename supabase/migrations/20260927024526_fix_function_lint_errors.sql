set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.apply_paid_subscription_payment(p_external_reference text, p_provider_payment_id text, p_payment_method text, p_paid_at timestamp with time zone, p_amount numeric DEFAULT NULL::numeric)
 RETURNS TABLE(applied boolean, organization_id uuid, plan_id text, payment_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_payment public.subscription_payments%rowtype;
  v_existing_plan text;
  v_existing_period_end timestamptz;
  v_paid_at timestamptz := coalesce(p_paid_at, now());
  v_period_start timestamptz;
  v_period_end timestamptz;
begin
  if nullif(trim(p_external_reference), '') is null then
    raise exception 'La referencia externa es obligatoria.';
  end if;

  select *
    into v_payment
    from public.subscription_payments
   where provider = 'pagopar'
     and external_reference = p_external_reference
   for update;

  if not found then
    raise exception 'Pago de suscripcion no encontrado.';
  end if;

  if v_payment.plan_id is null then
    raise exception 'El pago no tiene un plan destino.';
  end if;

  if p_amount is not null and abs(v_payment.amount - p_amount) > 0.5 then
    raise exception 'El monto notificado no coincide con el pago pendiente.';
  end if;

  if v_payment.status = 'paid' then
    return query
      select false, v_payment.organization_id, v_payment.plan_id, v_payment.id;
    return;
  end if;

  select s.plan, s.current_period_ends_at
    into v_existing_plan, v_existing_period_end
    from public.subscriptions s
   where s.organization_id = v_payment.organization_id;

  v_period_start := case
    when v_existing_plan = v_payment.plan_id
      and v_existing_period_end is not null
      and v_existing_period_end > v_paid_at
    then v_existing_period_end
    else v_paid_at
  end;
  v_period_end := v_period_start + interval '1 month';

  update public.subscription_payments
     set status = 'paid',
         payment_method = coalesce(nullif(trim(p_payment_method), ''), 'Pagopar'),
         provider_payment_id = nullif(trim(p_provider_payment_id), ''),
         paid_at = v_paid_at
   where id = v_payment.id;

  insert into public.subscriptions (
    organization_id,
    plan,
    status,
    provider,
    provider_subscription_id,
    external_reference,
    payment_status,
    last_payment_method,
    started_at,
    current_period_starts_at,
    current_period_ends_at,
    cancel_at_period_end,
    updated_at
  )
  values (
    v_payment.organization_id,
    v_payment.plan_id,
    'active',
    'pagopar',
    p_external_reference,
    p_external_reference,
    'paid',
    coalesce(nullif(trim(p_payment_method), ''), 'Pagopar'),
    v_paid_at,
    v_period_start,
    v_period_end,
    false,
    now()
  )
  on conflict on constraint subscriptions_organization_id_key
  do update set
    plan = excluded.plan,
    status = 'active',
    provider = 'pagopar',
    provider_subscription_id = excluded.provider_subscription_id,
    external_reference = excluded.external_reference,
    payment_status = 'paid',
    last_payment_method = excluded.last_payment_method,
    started_at = coalesce(public.subscriptions.started_at, excluded.started_at),
    current_period_starts_at = excluded.current_period_starts_at,
    current_period_ends_at = excluded.current_period_ends_at,
    cancel_at_period_end = false,
    updated_at = now();

  update public.organizations
     set plan = v_payment.plan_id,
         updated_at = now()
   where id = v_payment.organization_id;

  insert into public.tenant_audit_log (
    organization_id,
    action,
    resource,
    resource_id,
    metadata
  )
  values (
    v_payment.organization_id,
    'subscription.payment_confirmed',
    'subscription_payments',
    v_payment.id::text,
    jsonb_build_object(
      'plan', v_payment.plan_id,
      'amount', v_payment.amount,
      'provider', 'pagopar',
      'external_reference', p_external_reference
    )
  );

  return query
    select true, v_payment.organization_id, v_payment.plan_id, v_payment.id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.award_loyalty_points_for_sale(p_organization_id uuid, p_customer_id uuid, p_amount numeric, p_sale_id uuid DEFAULT NULL::uuid, p_idempotency_key text DEFAULT NULL::text)
 RETURNS public.loyalty_ledger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare
  settings public.loyalty_settings;
  rule public.loyalty_point_rules;
  existing public.loyalty_ledger;
  base_points integer := 0;
  bonus_points integer := 0;
  total_points integer := 0;
  customer_bonus_used integer := 0;
  earned_today integer := 0;
  daily_room integer;
  current_balance integer := 0;
  inserted public.loyalty_ledger;
  key text := p_idempotency_key;
begin
  if p_organization_id is null or p_customer_id is null then
    raise exception 'Falta la organización o el cliente.' using errcode = 'invalid_parameter_value';
  end if;

  -- 'pos.sales.create' es el permiso que tiene quien cierra una venta:
  -- cajero, vendedor, encargado, admin y dueño. Con un nombre que
  -- has_org_permission no conozca, solo pasarían dueño y admin y el POS
  -- dejaría de acreditar.
  if not (
    public.has_org_permission(p_organization_id, 'pos.sales.create')
    or public.has_org_permission(p_organization_id, 'repairs.orders.update')
  ) then
    raise exception 'No tenés permiso para acreditar puntos en esta organización.'
      using errcode = 'insufficient_privilege';
  end if;

  if key is null and p_sale_id is not null then
    key := 'sale:' || p_sale_id::text;
  end if;

  -- Idempotencia: si ya se acredito este hecho, se devuelve el asiento previo.
  if key is not null then
    select * into existing
    from public.loyalty_ledger
    where organization_id = p_organization_id
      and idempotency_key = key;

    if found then
      return existing;
    end if;
  end if;

  select * into settings
  from public.loyalty_settings
  where organization_id = p_organization_id;

  if not found or not settings.enabled then
    return null;
  end if;

  -- El cliente tiene que pertenecer a la organizacion.
  if not exists (
    select 1 from public.customers c
    where c.id = p_customer_id and c.organization_id = p_organization_id
  ) then
    raise exception 'El cliente no pertenece a la organización indicada.' using errcode = 'invalid_parameter_value';
  end if;

  base_points := public.calculate_base_loyalty_points(
    p_amount,
    settings.currency_per_point,
    settings.points_per_unit,
    settings.rounding
  );

  if base_points <= 0 then
    return null;
  end if;

  -- Promocion vigente: se toma la de mayor beneficio y se bloquea la fila para
  -- que dos ventas simultaneas no se pasen del cupo total.
  select * into rule
  from public.loyalty_point_rules r
  where r.organization_id = p_organization_id
    and r.is_active
    and now() >= r.starts_at
    and now() < r.ends_at
    and (r.min_purchase_amount is null or p_amount >= r.min_purchase_amount)
  order by
    case when r.kind = 'multiplier' then base_points * (r.multiplier - 1) else r.bonus_points end desc
  limit 1
  for update;

  if found then
    if rule.kind = 'multiplier' then
      bonus_points := greatest(0, floor(base_points * (rule.multiplier - 1))::integer);
    else
      bonus_points := rule.bonus_points;
    end if;

    -- Tope por cliente dentro de la promocion.
    if rule.max_bonus_points_per_customer is not null then
      select coalesce(sum(points), 0) into customer_bonus_used
      from public.loyalty_ledger
      where rule_id = rule.id and customer_id = p_customer_id and source = 'promotion';

      bonus_points := least(
        bonus_points,
        greatest(0, rule.max_bonus_points_per_customer - customer_bonus_used)
      );
    end if;

    -- Tope total de la promocion.
    if rule.max_bonus_points_total is not null then
      bonus_points := least(
        bonus_points,
        greatest(0, rule.max_bonus_points_total - rule.awarded_bonus_points)
      );
    end if;

    if bonus_points > 0 then
      update public.loyalty_point_rules
      set awarded_bonus_points = loyalty_point_rules.awarded_bonus_points + rule.bonus_points
      where id = rule.id;
    end if;
  end if;

  total_points := base_points + bonus_points;

  -- Tope diario de la organizacion: acota el dano de un error de carga.
  if settings.max_points_per_customer_per_day is not null then
    select coalesce(sum(points), 0) into earned_today
    from public.loyalty_ledger
    where customer_id = p_customer_id
      and points > 0
      and created_at >= date_trunc('day', now());

    daily_room := greatest(0, settings.max_points_per_customer_per_day - earned_today);
    total_points := least(total_points, daily_room);
  end if;

  if total_points <= 0 then
    return null;
  end if;

  select coalesce(balance, 0) into current_balance
  from public.loyalty_accounts
  where customer_id = p_customer_id;

  current_balance := coalesce(current_balance, 0);

  insert into public.loyalty_ledger (
    organization_id, customer_id, points, balance_after, source, description,
    sale_id, rule_id, idempotency_key, expires_at, created_by
  )
  values (
    p_organization_id,
    p_customer_id,
    total_points,
    current_balance + total_points,
    case when bonus_points > 0 then 'promotion' else 'purchase' end,
    case
      when bonus_points > 0 then
        format('Compra: %s puntos base + %s de bonificación (%s)', base_points, bonus_points, coalesce(rule.name, 'promoción'))
      else format('Compra: %s puntos', base_points)
    end,
    p_sale_id,
    case when bonus_points > 0 then rule.id else null end,
    key,
    case
      when settings.points_expiration_months is not null
        then now() + make_interval(months => settings.points_expiration_months)
      else null
    end,
    auth.uid()
  )
  returning * into inserted;

  return inserted;
end;
$function$
;

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
      and (p_branch_id is null or attribution.branch_id = p_branch_id)
      and (attribution.occurred_at at time zone organization_timezone)::date
        between p_period_from and p_period_to
      and attribution.basis_amount > 0

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
      and (p_branch_id is null or attribution.branch_id = p_branch_id)
      and (attribution.occurred_at at time zone organization_timezone)::date
        between p_period_from and p_period_to
      and attribution.labor_basis_amount > 0
  ),
  ranked_rules as (
    select
      candidate.*,
      rule.id as commission_rule_id,
      rule.calculation_type,
      rule.value,
      row_number() over (
        partition by candidate.candidate_key, rule.calculation_type
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
    'accrual:' || ranked.source_type || ':' || ranked.origin_id::text
      || ':' || ranked.calculation_type,
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

CREATE OR REPLACE FUNCTION public.delete_repair_with_inventory(p_repair_id uuid, p_organization_id uuid, p_branch_id uuid, p_actor_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  deleted_id uuid;
begin
  perform public.replace_repair_parts_with_inventory(
    p_repair_id,
    p_organization_id,
    p_branch_id,
    '[]'::jsonb,
    p_actor_id,
    null::numeric, null::numeric, null::numeric, null::text,
    null::numeric, null::text, null::uuid
  );

  delete from public.repairs
  where id = p_repair_id
    and organization_id = p_organization_id
    and branch_id = p_branch_id
  returning id into deleted_id;

  return deleted_id is not null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_inventory_report(start_date date DEFAULT NULL::date, end_date date DEFAULT NULL::date, category_filter uuid DEFAULT NULL::uuid)
 RETURNS TABLE(product_id uuid, sku character varying, product_name character varying, category_name character varying, current_stock integer, stock_value numeric, entries integer, exits integer, net_movement integer, turnover_rate numeric)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin return query
select p.id,p.sku,p.name,c.name,p.stock_quantity,p.stock_quantity*p.purchase_price,
 coalesce(sum(pm.quantity) filter(where pm.movement_type in('entry','adjustment') and pm.quantity>0),0)::integer,
 coalesce(sum(pm.quantity) filter(where pm.movement_type in('exit','sale') and pm.quantity>0),0)::integer,
 coalesce(sum(case when pm.movement_type in('entry','adjustment') and pm.quantity>0 then pm.quantity when pm.movement_type in('exit','sale') and pm.quantity>0 then -pm.quantity else 0 end),0)::integer,
 case when p.stock_quantity>0 then round(coalesce(sum(pm.quantity) filter(where pm.movement_type in('exit','sale')),0)/p.stock_quantity::numeric,2) else 0::numeric end
from public.products p left join public.categories c on c.id=p.category_id
left join public.product_movements pm on pm.product_id=p.id and(start_date is null or pm.created_at>=start_date) and(end_date is null or pm.created_at<end_date+1)
where p.is_active=true and(category_filter is null or p.category_id=category_filter)
group by p.id,p.sku,p.name,c.name,p.stock_quantity,p.purchase_price
order by(p.stock_quantity*p.purchase_price) desc; end; $function$
;

CREATE OR REPLACE FUNCTION public.get_product_stats()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_products', COUNT(*),
        'active_products', COUNT(*) FILTER (WHERE is_active = true),
        'low_stock_products', COUNT(*) FILTER (WHERE stock_quantity <= min_stock AND is_active = true),
        'out_of_stock_products', COUNT(*) FILTER (WHERE stock_quantity = 0 AND is_active = true),
        'total_stock_value', COALESCE(SUM(stock_quantity * purchase_price), 0)
    ) INTO result
    FROM public.products;

    RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_products_with_alerts(p_limit integer DEFAULT 10, p_offset integer DEFAULT 0)
 RETURNS TABLE(product_id uuid, name text, sku text, stock_quantity integer, min_stock integer, alert_type text, alert_message text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    p.id as product_id,
    p.name::text,
    p.sku::text,
    p.stock_quantity,
    p.min_stock,
    pa.alert_type::text,
    pa.message::text as alert_message,
    pa.created_at
  FROM product_alerts pa
  JOIN products p ON pa.product_id = p.id
  WHERE pa.is_resolved = false
  ORDER BY pa.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_recent_activity_feed(p_limit integer DEFAULT 10)
 RETURNS TABLE(id uuid, type text, amount numeric, status text, created_at timestamp with time zone, info_1 text, info_2 text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH all_activity AS (
    (
      SELECT
        s.id,
        'sale'::TEXT as type,
        s.total_amount as amount,
        s.status::text,
        s.created_at,
        NULL::TEXT as info_1,
        NULL::TEXT as info_2
      FROM sales s
      ORDER BY s.created_at DESC
      LIMIT p_limit
    )
    UNION ALL
    (
      SELECT
        r.id,
        'repair'::TEXT as type,
        r.final_cost as amount,
        r.status::text,
        r.created_at,
        r.device_brand as info_1,
        r.device_model as info_2
      FROM repairs r
      ORDER BY r.created_at DESC
      LIMIT p_limit
    )
    UNION ALL
    (
      SELECT
        c.id,
        'customer'::TEXT as type,
        NULL::NUMERIC as amount,
        'new'::TEXT as status,
        c.created_at,
        c.name::text as info_1,
        NULL::TEXT as info_2
      FROM customers c
      ORDER BY c.created_at DESC
      LIMIT p_limit
    )
  )
  SELECT *
  FROM all_activity
  ORDER BY created_at DESC
  LIMIT p_limit;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_recent_movements(days integer DEFAULT 30, limit_count integer DEFAULT 50)
 RETURNS TABLE(movement_id uuid, product_name character varying, product_sku character varying, movement_type character varying, quantity integer, previous_stock integer, new_stock integer, total_cost numeric, created_at timestamp with time zone, notes text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        pm.id,
        p.name,
        p.sku,
        pm.movement_type,
        pm.quantity,
        pm.previous_stock,
        pm.new_stock,
        pm.total_cost,
        pm.created_at,
        pm.notes
    FROM product_movements pm
    JOIN products p ON pm.product_id = p.id
    WHERE pm.created_at >= NOW() - make_interval(days => greatest(days, 0))
    ORDER BY pm.created_at DESC
    LIMIT limit_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_storage_usage()
 RETURNS TABLE(category text, size_bytes bigint, size_mb numeric, percentage numeric)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  total_db_size bigint;
BEGIN
  -- Get total database size
  SELECT pg_database_size(current_database()) INTO total_db_size;

  RETURN QUERY
  WITH storage_data AS (
    SELECT
      'Tablas' as category,
      SUM(pg_total_relation_size(format('%I.%I', schemaname, tablename)))::bigint as size_bytes
    FROM pg_tables
    WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')

    UNION ALL

    SELECT
      'Índices' as category,
      SUM(pg_indexes_size(format('%I.%I', schemaname, tablename)))::bigint as size_bytes
    FROM pg_tables
    WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
  )
  SELECT
    sd.category,
    sd.size_bytes,
    ROUND(sd.size_bytes / 1024.0 / 1024.0, 2) as size_mb,
    ROUND((sd.size_bytes::numeric / NULLIF(total_db_size, 0)::numeric) * 100, 2) as percentage
  FROM storage_data sd
  ORDER BY sd.size_bytes DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_supplier_stats()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare result json; current_org uuid:=public.current_organization_id();
begin if current_org is null then raise exception 'ORGANIZATION_CONTEXT_REQUIRED'; end if;
with ss as(select count(*)::bigint total_suppliers,count(*) filter(where status='active')::bigint active_suppliers,count(*) filter(where status='inactive')::bigint inactive_suppliers,count(*) filter(where status='pending')::bigint pending_suppliers,coalesce(avg(rating),0)::numeric avg_rating from public.suppliers where organization_id=current_org),
os as(select count(*)::bigint total_orders,coalesce(sum(totalamount),0)::numeric total_amount from public.purchase_orders where organization_id=current_org)
select json_build_object('total_suppliers',ss.total_suppliers,'active_suppliers',ss.active_suppliers,'inactive_suppliers',ss.inactive_suppliers,'pending_suppliers',ss.pending_suppliers,'avg_rating',ss.avg_rating,'total_orders',os.total_orders,'total_amount',os.total_amount) into result from ss cross join os; return result; end; $function$
;

CREATE OR REPLACE FUNCTION public.perform_cash_admin_action(p_session_id uuid, p_action text, p_reason text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  actor_id UUID := auth.uid();
  previous_session public.cash_closures%ROWTYPE;
  updated_session public.cash_closures%ROWTYPE;
  session_organization_id UUID;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_action NOT IN ('remote_close', 'suspend', 'unsuspend', 'block', 'unblock', 'reopen') THEN
    RAISE EXCEPTION 'Unsupported cash admin action';
  END IF;

  SELECT *
  INTO previous_session
  FROM public.cash_closures
  WHERE id = p_session_id
  FOR UPDATE;

  IF previous_session.id IS NULL THEN
    RAISE EXCEPTION 'Cash session not found';
  END IF;

  SELECT organization_id
  INTO session_organization_id
  FROM public.cash_closures
  WHERE id = p_session_id;

  IF NOT (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = actor_id AND role = 'super_admin' AND is_active = TRUE
    )
    OR EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = actor_id
        AND organization_id = session_organization_id
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  ) THEN
    RAISE EXCEPTION 'Insufficient organization permissions';
  END IF;

  UPDATE public.cash_closures
  SET
    status = CASE p_action
      WHEN 'remote_close' THEN 'cerrada'
      WHEN 'suspend' THEN 'suspendida'
      WHEN 'unsuspend' THEN 'abierta'
      WHEN 'block' THEN 'bloqueada'
      WHEN 'unblock' THEN 'abierta'
      WHEN 'reopen' THEN 'abierta'
    END,
    date = CASE
      WHEN p_action = 'remote_close' THEN NOW()
      WHEN p_action = 'reopen' THEN NULL
      ELSE date
    END,
    closed_by = CASE
      WHEN p_action = 'remote_close' THEN actor_id::text
      WHEN p_action = 'reopen' THEN NULL
      ELSE closed_by
    END,
    suspended_by = CASE
      WHEN p_action = 'suspend' THEN actor_id
      WHEN p_action = 'unsuspend' THEN NULL
      ELSE suspended_by
    END,
    suspended_at = CASE
      WHEN p_action = 'suspend' THEN NOW()
      WHEN p_action = 'unsuspend' THEN NULL
      ELSE suspended_at
    END,
    blocked_by = CASE
      WHEN p_action = 'block' THEN actor_id
      WHEN p_action = 'unblock' THEN NULL
      ELSE blocked_by
    END,
    blocked_at = CASE
      WHEN p_action = 'block' THEN NOW()
      WHEN p_action = 'unblock' THEN NULL
      ELSE blocked_at
    END,
    updated_at = NOW()
  WHERE id = p_session_id
  RETURNING * INTO updated_session;

  INSERT INTO public.cash_admin_audit (
    session_id, register_id, action, performed_by, reason,
    previous_state, new_state, ip_address, user_agent
  )
  VALUES (
    p_session_id,
    previous_session.register_id,
    p_action,
    actor_id,
    NULLIF(BTRIM(p_reason), ''),
    to_jsonb(previous_session),
    to_jsonb(updated_session),
    inet_client_addr(),
    NULLIF(BTRIM(p_user_agent), '')
  );

  RETURN to_jsonb(updated_session);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.record_cash_movement_atomic(p_organization_id uuid, p_branch_id uuid, p_session_id uuid, p_type text, p_amount numeric, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor_id uuid := auth.uid();
  created_movement public.cash_movements%rowtype;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;
  if not public.has_org_permission(p_organization_id, 'pos.cash.manage') then
    raise exception 'Insufficient cash permissions';
  end if;
  if p_type not in ('cash_in', 'cash_out') then
    raise exception 'INVALID_CASH_MOVEMENT_TYPE';
  end if;
  if coalesce(p_amount, 0) <= 0 then
    raise exception 'INVALID_CASH_MOVEMENT_AMOUNT';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'CASH_MOVEMENT_REASON_REQUIRED';
  end if;

  perform 1
  from public.cash_closures c
  join public.cash_registers r
    on r.id::text = c.register_id
   and r.organization_id = c.organization_id
   and r.branch_id = c.branch_id
  where c.id = p_session_id
    and c.organization_id = p_organization_id
    and c.branch_id = p_branch_id
    and c.date is null
    and r.is_active = true
  for update of c, r;

  if not found then
    raise exception 'OPEN_CASH_SESSION_NOT_FOUND';
  end if;

  insert into public.cash_movements (
    session_id, type, amount, reason, created_by, created_at,
    organization_id, branch_id
  ) values (
    p_session_id,
    p_type::public.cash_movement_type,
    p_amount,
    left(trim(p_reason), 500),
    actor_id,
    now(),
    p_organization_id,
    p_branch_id
  ) returning * into created_movement;

  update public.cash_closures
  set last_activity_at = now(), updated_at = now()
  where id = p_session_id
    and organization_id = p_organization_id
    and branch_id = p_branch_id;

  return to_jsonb(created_movement);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.save_product_with_variants(p_product jsonb, p_variants jsonb, p_branch_id uuid, p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_variable
declare
  product_id uuid := coalesce(nullif(p_product->>'id', '')::uuid, gen_random_uuid());
  organization_id uuid := nullif(p_product->>'organization_id', '')::uuid;
  has_variants boolean := coalesce((p_product->>'has_variants')::boolean, false);
  variant_entry jsonb;
  saved_variant_id uuid;
  saved_variant_ids uuid[] := '{}'::uuid[];
  initial_stock integer;
  branch_organization_id uuid;
begin
  if organization_id is null or p_actor_id is null then
    raise exception 'VARIANT_PRODUCT_INVALID_INPUT';
  end if;

  if not exists (
    select 1
    from public.organization_members member
    where member.organization_id = organization_id
      and member.user_id = p_actor_id
      and member.status = 'active'
  ) then
    raise exception 'VARIANT_ACTOR_FORBIDDEN';
  end if;

  if jsonb_typeof(coalesce(p_variants, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_product->'variant_attribute_config', '[]'::jsonb)) <> 'array' then
    raise exception 'VARIANT_PRODUCT_INVALID_INPUT';
  end if;

  if has_variants and (p_branch_id is null or jsonb_array_length(p_variants) = 0) then
    raise exception 'VARIANT_PRODUCT_REQUIRES_VARIANTS';
  end if;

  if p_branch_id is not null then
    select branch.organization_id into branch_organization_id
    from public.branches branch
    where branch.id = p_branch_id;

    if branch_organization_id is distinct from organization_id then
      raise exception 'VARIANT_BRANCH_FORBIDDEN';
    end if;
  end if;

  insert into public.products (
    id,
    organization_id,
    name,
    sku,
    description,
    category_id,
    supplier_id,
    brand,
    brand_id,
    tags,
    purchase_price,
    sale_price,
    wholesale_price,
    stock_quantity,
    min_stock,
    max_stock,
    unit_measure,
    barcode,
    images,
    image_url,
    offer_price,
    has_offer,
    installments_enabled,
    installments_public,
    installments_plans,
    visibility,
    warranty_months,
    warranty_info,
    return_window_days,
    exchange_window_days,
    return_policy,
    exchange_policy,
    is_active,
    has_variants,
    variant_attribute_config
  ) values (
    product_id,
    organization_id,
    trim(p_product->>'name'),
    trim(p_product->>'sku'),
    nullif(trim(p_product->>'description'), ''),
    nullif(p_product->>'category_id', '')::uuid,
    nullif(p_product->>'supplier_id', '')::uuid,
    nullif(trim(p_product->>'brand'), ''),
    nullif(p_product->>'brand_id', '')::uuid,
    case
      when jsonb_typeof(p_product->'tags') = 'array'
        then array(select jsonb_array_elements_text(p_product->'tags'))
      else null
    end,
    coalesce((p_product->>'purchase_price')::numeric, 0),
    coalesce((p_product->>'sale_price')::numeric, 0),
    nullif(p_product->>'wholesale_price', '')::numeric,
    case when has_variants then 0 else coalesce((p_product->>'stock_quantity')::integer, 0) end,
    coalesce((p_product->>'min_stock')::integer, 0),
    coalesce((p_product->>'max_stock')::integer, 1000),
    coalesce(nullif(trim(p_product->>'unit_measure'), ''), 'unidad'),
    nullif(trim(p_product->>'barcode'), ''),
    case
      when jsonb_typeof(p_product->'images') = 'array'
        then array(select jsonb_array_elements_text(p_product->'images'))
      else null
    end,
    nullif(trim(p_product->>'image_url'), ''),
    nullif(p_product->>'offer_price', '')::numeric,
    coalesce((p_product->>'has_offer')::boolean, false),
    coalesce((p_product->>'installments_enabled')::boolean, false),
    coalesce((p_product->>'installments_public')::boolean, true),
    coalesce(p_product->'installments_plans', '[]'::jsonb),
    coalesce(nullif(trim(p_product->>'visibility'), ''), 'public'),
    nullif(p_product->>'warranty_months', '')::integer,
    nullif(trim(p_product->>'warranty_info'), ''),
    nullif(p_product->>'return_window_days', '')::integer,
    nullif(p_product->>'exchange_window_days', '')::integer,
    nullif(trim(p_product->>'return_policy'), ''),
    nullif(trim(p_product->>'exchange_policy'), ''),
    coalesce((p_product->>'is_active')::boolean, true),
    has_variants,
    coalesce(p_product->'variant_attribute_config', '[]'::jsonb)
  )
  on conflict (id) do update
  set
    name = excluded.name,
    sku = excluded.sku,
    description = excluded.description,
    category_id = excluded.category_id,
    supplier_id = excluded.supplier_id,
    brand = excluded.brand,
    brand_id = excluded.brand_id,
    tags = excluded.tags,
    purchase_price = excluded.purchase_price,
    sale_price = excluded.sale_price,
    wholesale_price = excluded.wholesale_price,
    min_stock = excluded.min_stock,
    max_stock = excluded.max_stock,
    unit_measure = excluded.unit_measure,
    barcode = excluded.barcode,
    images = excluded.images,
    image_url = excluded.image_url,
    offer_price = excluded.offer_price,
    has_offer = excluded.has_offer,
    installments_enabled = excluded.installments_enabled,
    installments_public = excluded.installments_public,
    installments_plans = excluded.installments_plans,
    visibility = excluded.visibility,
    warranty_months = excluded.warranty_months,
    warranty_info = excluded.warranty_info,
    return_window_days = excluded.return_window_days,
    exchange_window_days = excluded.exchange_window_days,
    return_policy = excluded.return_policy,
    exchange_policy = excluded.exchange_policy,
    is_active = excluded.is_active,
    has_variants = excluded.has_variants,
    variant_attribute_config = excluded.variant_attribute_config,
    updated_at = now()
  where products.organization_id = excluded.organization_id;

  if not found then
    raise exception 'VARIANT_PRODUCT_NOT_IN_ORGANIZATION';
  end if;

  delete from public.product_variant_attributes
  where product_variant_attributes.organization_id = organization_id
    and product_variant_attributes.product_id = product_id;

  insert into public.product_variant_attributes (
    organization_id,
    product_id,
    attribute_key,
    label,
    control,
    options,
    sort_order
  )
  select
    organization_id,
    product_id,
    trim(attribute.value->>'key'),
    trim(attribute.value->>'label'),
    attribute.value->>'control',
    coalesce(attribute.value->'options', '[]'::jsonb),
    attribute.ordinality - 1
  from jsonb_array_elements(coalesce(p_product->'variant_attribute_config', '[]'::jsonb))
    with ordinality as attribute(value, ordinality);

  if not has_variants then
    update public.product_variants
    set is_active = false,
        updated_at = now()
    where product_variants.organization_id = organization_id
      and product_variants.product_id = product_id;

    return jsonb_build_object('product_id', product_id, 'variant_ids', '[]'::jsonb);
  end if;

  for variant_entry in
    select value from jsonb_array_elements(p_variants)
  loop
    initial_stock := greatest(0, coalesce((variant_entry->>'stock_quantity')::integer, 0));
    saved_variant_id := coalesce(nullif(variant_entry->>'id', '')::uuid, gen_random_uuid());

    insert into public.product_variants (
      id,
      organization_id,
      product_id,
      variant_name,
      attributes,
      sku,
      barcode,
      purchase_price,
      sale_price,
      wholesale_price,
      min_stock,
      stock_quantity,
      price_adjustment,
      is_active
    ) values (
      saved_variant_id,
      organization_id,
      product_id,
      trim(variant_entry->>'name'),
      coalesce(variant_entry->'attributes', '{}'::jsonb),
      nullif(trim(variant_entry->>'sku'), ''),
      nullif(trim(variant_entry->>'barcode'), ''),
      coalesce((variant_entry->>'purchase_price')::numeric, 0),
      coalesce((variant_entry->>'sale_price')::numeric, 0),
      nullif(variant_entry->>'wholesale_price', '')::numeric,
      greatest(0, coalesce((variant_entry->>'min_stock')::integer, 0)),
      initial_stock,
      coalesce((variant_entry->>'sale_price')::numeric, 0)
        - coalesce((p_product->>'sale_price')::numeric, 0),
      coalesce((variant_entry->>'is_active')::boolean, true)
    )
    on conflict (id) do update
    set
      variant_name = excluded.variant_name,
      attributes = excluded.attributes,
      sku = excluded.sku,
      barcode = excluded.barcode,
      purchase_price = excluded.purchase_price,
      sale_price = excluded.sale_price,
      wholesale_price = excluded.wholesale_price,
      min_stock = excluded.min_stock,
      price_adjustment = excluded.price_adjustment,
      is_active = excluded.is_active,
      updated_at = now()
    where product_variants.organization_id = excluded.organization_id
      and product_variants.product_id = excluded.product_id;

    if not found then
      raise exception 'VARIANT_PRODUCT_MISMATCH';
    end if;

    saved_variant_ids := array_append(saved_variant_ids, saved_variant_id);

    insert into public.branch_variant_inventory (
      organization_id,
      branch_id,
      product_id,
      variant_id,
      stock_quantity,
      min_stock
    ) values (
      organization_id,
      p_branch_id,
      product_id,
      saved_variant_id,
      initial_stock,
      greatest(0, coalesce((variant_entry->>'min_stock')::integer, 0))
    )
    on conflict on constraint branch_variant_inventory_pkey do nothing;

    if found and initial_stock > 0 then
      insert into public.variant_inventory_movements (
        organization_id,
        branch_id,
        product_id,
        variant_id,
        movement_type,
        quantity_delta,
        stock_before,
        stock_after,
        idempotency_key,
        reason,
        actor_id,
        metadata
      ) values (
        organization_id,
        p_branch_id,
        product_id,
        saved_variant_id,
        'initial',
        initial_stock,
        0,
        initial_stock,
        'variant-initial:' || p_branch_id::text || ':' || saved_variant_id::text,
        'Stock inicial de la variante',
        p_actor_id,
        '{}'::jsonb
      ) on conflict on constraint variant_inventory_movements_organization_id_idempotency_key_key do nothing;
    end if;

    update public.branch_variant_inventory
    set min_stock = greatest(0, coalesce((variant_entry->>'min_stock')::integer, 0)),
        updated_at = now()
    where branch_variant_inventory.organization_id = organization_id
      and branch_variant_inventory.branch_id = p_branch_id
      and branch_variant_inventory.variant_id = saved_variant_id;
  end loop;

  update public.product_variants
  set is_active = false,
      updated_at = now()
  where product_variants.organization_id = organization_id
    and product_variants.product_id = product_id
    and not (product_variants.id = any(saved_variant_ids));

  return jsonb_build_object(
    'product_id', product_id,
    'variant_ids', to_jsonb(saved_variant_ids)
  );
exception
  when unique_violation then
    if sqlerrm ilike '%barcode%' then
      raise exception 'VARIANT_BARCODE_DUPLICATE';
    end if;
    raise exception 'VARIANT_SKU_DUPLICATE';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.search_products(search_term text DEFAULT ''::text, category_filter uuid DEFAULT NULL::uuid, supplier_filter uuid DEFAULT NULL::uuid, status_filter character varying DEFAULT NULL::character varying, stock_filter character varying DEFAULT NULL::character varying, limit_count integer DEFAULT 50, offset_count integer DEFAULT 0)
 RETURNS TABLE(id uuid, sku character varying, name character varying, description text, category_name character varying, category_color character varying, brand character varying, supplier_name character varying, purchase_price numeric, sale_price numeric, wholesale_price numeric, stock integer, min_stock integer, status character varying, stock_status character varying, profit_margin numeric, total_value numeric, active_alerts integer, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.sku,
        p.name,
        p.description,
        c.name as category_name,
        NULL::character varying as category_color,
        p.brand,
        s.name as supplier_name,
        p.purchase_price,
        p.sale_price,
        p.wholesale_price,
        p.stock_quantity,
        p.min_stock,
        (CASE WHEN p.is_active THEN 'active' ELSE 'inactive' END)::character varying as status,
        (CASE
            WHEN p.stock_quantity = 0 THEN 'out_of_stock'
            WHEN p.stock_quantity <= p.min_stock THEN 'low_stock'
            ELSE 'normal'
        END)::character varying as stock_status,
        CASE
            WHEN p.purchase_price > 0 THEN
                ROUND(((p.sale_price - p.purchase_price) / p.purchase_price * 100)::numeric, 2)
            ELSE 0
        END as profit_margin,
        (p.stock_quantity * p.purchase_price) as total_value,
        (SELECT COUNT(*)::INTEGER FROM product_alerts pa WHERE pa.product_id = p.id AND pa.is_resolved = false) as active_alerts,
        p.created_at
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE
        (search_term = '' OR
         p.name ILIKE '%' || search_term || '%' OR
         p.sku ILIKE '%' || search_term || '%' OR
         p.brand ILIKE '%' || search_term || '%' OR
         p.description ILIKE '%' || search_term || '%')
        AND (category_filter IS NULL OR p.category_id = category_filter)
        AND (supplier_filter IS NULL OR p.supplier_id = supplier_filter)
        AND (status_filter IS NULL OR (status_filter = 'active' AND p.is_active = true) OR (status_filter = 'inactive' AND p.is_active = false))
        AND (stock_filter IS NULL OR
             (stock_filter = 'low' AND p.stock_quantity <= p.min_stock) OR
             (stock_filter = 'out' AND p.stock_quantity = 0) OR
             (stock_filter = 'normal' AND p.stock_quantity > p.min_stock))
    ORDER BY
        CASE WHEN p.stock_quantity = 0 THEN 0 ELSE 1 END,
        CASE WHEN p.stock_quantity <= p.min_stock THEN 0 ELSE 1 END,
        p.name
    LIMIT limit_count
    OFFSET offset_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.transfer_branch_inventory_stock(p_product_id uuid, p_from_branch_id uuid, p_to_branch_id uuid, p_quantity integer, p_reason text DEFAULT NULL::text, p_reference_id text DEFAULT NULL::text)
 RETURNS TABLE(product_id uuid, from_branch_id uuid, to_branch_id uuid, quantity integer, from_previous_stock integer, from_new_stock integer, to_previous_stock integer, to_new_stock integer, transfer_reference_id text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_from_previous_stock INTEGER := 0;
  v_to_previous_stock INTEGER := 0;
  v_from_new_stock INTEGER := 0;
  v_to_new_stock INTEGER := 0;
  v_reference_id UUID := COALESCE(NULLIF(p_reference_id, '')::uuid, gen_random_uuid());
  v_from_branch_name TEXT;
  v_to_branch_name TEXT;
  v_product_organization_id UUID;
  v_from_organization_id UUID;
  v_to_organization_id UUID;
BEGIN
  IF p_product_id IS NULL OR p_from_branch_id IS NULL OR p_to_branch_id IS NULL THEN
    RAISE EXCEPTION 'Producto, sucursal origen y sucursal destino son obligatorios.';
  END IF;

  IF p_from_branch_id = p_to_branch_id THEN
    RAISE EXCEPTION 'La sucursal origen y destino deben ser diferentes.';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'La cantidad a transferir debe ser mayor a cero.';
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.';
  END IF;

  v_role := public.get_user_role(v_uid);
  IF NOT public.has_permission('inventory.manage', v_uid)
     AND NOT public.has_permission('inventory.stock.manage', v_uid)
     AND v_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Permisos insuficientes para transferir inventario.';
  END IF;

  IF NOT public.user_has_branch_access(p_from_branch_id, v_uid) THEN
    RAISE EXCEPTION 'No autorizado para operar sobre la sucursal origen.';
  END IF;

  IF NOT public.user_has_branch_access(p_to_branch_id, v_uid) THEN
    RAISE EXCEPTION 'No autorizado para operar sobre la sucursal destino.';
  END IF;

  SELECT p.organization_id
  INTO v_product_organization_id
  FROM public.products p
  WHERE p.id = p_product_id;

  IF v_product_organization_id IS NULL THEN
    RAISE EXCEPTION 'Producto no encontrado.';
  END IF;

  SELECT b.organization_id, b.name
  INTO v_from_organization_id, v_from_branch_name
  FROM public.branches b
  WHERE b.id = p_from_branch_id
    AND b.is_active = TRUE;

  IF v_from_organization_id IS NULL THEN
    RAISE EXCEPTION 'Sucursal origen no encontrada o inactiva.';
  END IF;

  SELECT b.organization_id, b.name
  INTO v_to_organization_id, v_to_branch_name
  FROM public.branches b
  WHERE b.id = p_to_branch_id
    AND b.is_active = TRUE;

  IF v_to_organization_id IS NULL THEN
    RAISE EXCEPTION 'Sucursal destino no encontrada o inactiva.';
  END IF;

  IF v_product_organization_id IS DISTINCT FROM v_from_organization_id
     OR v_product_organization_id IS DISTINCT FROM v_to_organization_id THEN
    RAISE EXCEPTION 'El producto y las sucursales deben pertenecer a la misma organizacion.';
  END IF;

  INSERT INTO public.branch_inventory (branch_id, product_id, stock_quantity, reserved_quantity)
  VALUES
    (p_from_branch_id, p_product_id, 0, 0),
    (p_to_branch_id, p_product_id, 0, 0)
  ON CONFLICT ON CONSTRAINT inventario_sucursal_pk DO NOTHING;

  PERFORM 1
  FROM public.branch_inventory bi
  WHERE bi.product_id = p_product_id
    AND bi.branch_id IN (p_from_branch_id, p_to_branch_id)
  ORDER BY bi.branch_id
  FOR UPDATE;

  SELECT COALESCE(bi.stock_quantity, 0)
  INTO v_from_previous_stock
  FROM public.branch_inventory bi
  WHERE bi.branch_id = p_from_branch_id
    AND bi.product_id = p_product_id;

  SELECT COALESCE(bi.stock_quantity, 0)
  INTO v_to_previous_stock
  FROM public.branch_inventory bi
  WHERE bi.branch_id = p_to_branch_id
    AND bi.product_id = p_product_id;

  IF v_from_previous_stock < p_quantity THEN
    RAISE EXCEPTION 'Stock insuficiente en la sucursal origen. Disponible: %, solicitado: %.',
      v_from_previous_stock,
      p_quantity;
  END IF;

  v_from_new_stock := v_from_previous_stock - p_quantity;
  v_to_new_stock := v_to_previous_stock + p_quantity;

  UPDATE public.branch_inventory
  SET stock_quantity = v_from_new_stock,
      updated_at = NOW()
  WHERE branch_inventory.branch_id = p_from_branch_id
    AND branch_inventory.product_id = p_product_id;

  UPDATE public.branch_inventory
  SET stock_quantity = v_to_new_stock,
      updated_at = NOW()
  WHERE branch_inventory.branch_id = p_to_branch_id
    AND branch_inventory.product_id = p_product_id;

  INSERT INTO public.product_movements (
    product_id,
    movement_type,
    quantity,
    previous_stock,
    new_stock,
    notes,
    reference_id,
    reference_type,
    user_id,
    branch_id,
    created_at
  )
  VALUES
    (
      p_product_id,
      'transfer',
      p_quantity,
      v_from_previous_stock,
      v_from_new_stock,
      COALESCE(NULLIF(p_reason, ''), 'Transferencia entre sucursales') || ' | Salida hacia: ' || COALESCE(v_to_branch_name, p_to_branch_id::TEXT),
      v_reference_id,
      'branch_transfer',
      v_uid,
      p_from_branch_id,
      NOW()
    ),
    (
      p_product_id,
      'transfer',
      p_quantity,
      v_to_previous_stock,
      v_to_new_stock,
      COALESCE(NULLIF(p_reason, ''), 'Transferencia entre sucursales') || ' | Entrada desde: ' || COALESCE(v_from_branch_name, p_from_branch_id::TEXT),
      v_reference_id,
      'branch_transfer',
      v_uid,
      p_to_branch_id,
      NOW()
    );

  RETURN QUERY
  SELECT
    p_product_id,
    p_from_branch_id,
    p_to_branch_id,
    p_quantity,
    v_from_previous_stock,
    v_from_new_stock,
    v_to_previous_stock,
    v_to_new_stock,
    v_reference_id::text;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_product_stock(product_id uuid, quantity_change integer, movement_type character varying, reference character varying DEFAULT NULL::character varying, notes text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare current_stock integer; next_stock integer; product_org uuid;
begin select p.stock_quantity,p.organization_id into current_stock,product_org from public.products p where p.id=$1 for update; if not found then raise exception 'Producto no encontrado'; end if; next_stock:=current_stock+quantity_change; if next_stock<0 then raise exception 'Stock insuficiente. Stock actual: %, Cambio solicitado: %',current_stock,quantity_change; end if; update public.products p set stock_quantity=next_stock,updated_at=now() where p.id=$1; insert into public.product_movements(product_id,movement_type,quantity,previous_stock,new_stock,reference_type,notes,user_id,organization_id) values($1,$3,abs(quantity_change),current_stock,next_stock,reference,notes,auth.uid(),product_org); return true; end; $function$
;

CREATE OR REPLACE FUNCTION public.update_product_stock(product_id_param uuid, new_stock integer, movement_type_param character varying, reference_type_param character varying DEFAULT NULL::character varying, reference_id_param uuid DEFAULT NULL::uuid, notes_param text DEFAULT NULL::text, unit_cost_param numeric DEFAULT NULL::numeric)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare current_stock integer; product_org uuid;
begin select p.stock_quantity,p.organization_id into current_stock,product_org from public.products p where p.id=product_id_param for update; if not found then raise exception 'Producto no encontrado'; end if; if new_stock<0 then raise exception 'El stock no puede ser negativo'; end if; update public.products p set stock_quantity=new_stock,updated_at=now() where p.id=product_id_param; insert into public.product_movements(product_id,movement_type,quantity,previous_stock,new_stock,unit_cost,total_cost,reference_type,reference_id,notes,user_id,organization_id) values(product_id_param,movement_type_param,abs(new_stock-current_stock),current_stock,new_stock,unit_cost_param,case when unit_cost_param is not null then unit_cost_param*abs(new_stock-current_stock) end,reference_type_param,reference_id_param,notes_param,auth.uid(),product_org); return true; end; $function$
;
