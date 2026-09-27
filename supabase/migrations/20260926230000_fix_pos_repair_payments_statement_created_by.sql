-- Arregla el trigger capture_pos_repair_payments_statement: referenciaba
-- repairs.created_by, columna que no existe. Como el trigger corre en TODO
-- update de public.repairs, rompía cualquier cambio de reparaciones
-- (verificación técnica, cambios de estado, ediciones, etc.).
-- La columna no se usaba: el pago se registra con sales.created_by.

begin;

create or replace function public.capture_pos_repair_payments_statement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allocation record;
  resolved_method text;
  resolved_immediate numeric(12, 2);
  resolved_financed numeric(12, 2);
  resolved_breakdown jsonb;
begin
  for allocation in
    with changed as (
      select
        new_rows.id as repair_id,
        new_rows.organization_id,
        new_rows.branch_id,
        greatest(0, coalesce(new_rows.paid_amount, 0) - coalesce(old_rows.paid_amount, 0))::numeric(12, 2) as payment_delta,
        substring(new_rows.problem_description from 'Venta relacionada #([0-9a-fA-F-]{36})')::uuid as resolved_sale_id
      from new_rows
      join old_rows using (id)
      where coalesce(new_rows.paid_amount, 0) > coalesce(old_rows.paid_amount, 0)
        and new_rows.problem_description ~ 'Venta relacionada #[0-9a-fA-F-]{36}'
    ),
    payment_totals as (
      select
        changed.*,
        sale.created_by as sale_created_by,
        sale.payment_method as sale_payment_method,
        coalesce(sum(payment.amount) filter (where payment.payment_method <> 'credit'), 0)::numeric(12, 2) as sale_immediate,
        coalesce(sum(payment.amount) filter (where payment.payment_method = 'credit'), 0)::numeric(12, 2) as sale_financed
      from changed
      join public.sales sale
        on sale.id = changed.resolved_sale_id
       and sale.organization_id = changed.organization_id
      left join public.sale_payments payment
        on payment.sale_id = changed.resolved_sale_id
       and payment.organization_id = changed.organization_id
      group by changed.repair_id, changed.organization_id, changed.branch_id,
        changed.payment_delta, changed.resolved_sale_id,
        sale.created_by, sale.payment_method
    ),
    ordered as (
      select
        payment_totals.*,
        coalesce(sum(payment_delta) over (
          partition by organization_id, resolved_sale_id
          order by repair_id
          rows between unbounded preceding and 1 preceding
        ), 0)::numeric(12, 2) as prior_repair_delta
      from payment_totals
    )
    select * from ordered order by organization_id, resolved_sale_id, repair_id
  loop
    resolved_immediate := least(
      allocation.payment_delta,
      greatest(0, allocation.sale_immediate - allocation.prior_repair_delta)
    );
    resolved_financed := allocation.payment_delta - resolved_immediate;

    if resolved_immediate + resolved_financed <> allocation.payment_delta then
      raise exception 'REPAIR_POS_PAYMENT_ALLOCATION_MISMATCH';
    end if;
    if resolved_financed > allocation.sale_financed then
      raise exception 'REPAIR_POS_FINANCING_ALLOCATION_EXCEEDS_SALE';
    end if;

    resolved_method := case
      when resolved_immediate > 0 and resolved_financed > 0 then 'mixed'
      when resolved_financed > 0 then 'credit'
      when lower(coalesce(allocation.sale_payment_method, '')) in ('cash', 'efectivo') then 'cash'
      when lower(coalesce(allocation.sale_payment_method, '')) in ('card', 'tarjeta') then 'card'
      when lower(coalesce(allocation.sale_payment_method, '')) in ('transfer', 'transferencia') then 'transfer'
      else 'mixed'
    end;

    resolved_breakdown := case
      when resolved_immediate > 0 and resolved_financed > 0 then jsonb_build_array(
        jsonb_build_object('method', 'immediate', 'amount', resolved_immediate),
        jsonb_build_object('method', 'credit', 'amount', resolved_financed)
      )
      when resolved_financed > 0 then jsonb_build_array(
        jsonb_build_object('method', 'credit', 'amount', resolved_financed)
      )
      else jsonb_build_array(
        jsonb_build_object('method', resolved_method, 'amount', resolved_immediate)
      )
    end;

    insert into public.repair_payments (
      repair_id, organization_id, branch_id, amount, payment_method,
      idempotency_key, source, sale_id, created_by, payment_breakdown,
      immediate_amount, financed_amount, created_at
    ) values (
      allocation.repair_id, allocation.organization_id, allocation.branch_id,
      allocation.payment_delta, resolved_method,
      'pos:' || allocation.resolved_sale_id::text || ':' || allocation.repair_id::text,
      'pos', allocation.resolved_sale_id, allocation.sale_created_by,
      resolved_breakdown, resolved_immediate, resolved_financed, now()
    ) on conflict (organization_id, idempotency_key) do nothing;
  end loop;

  return null;
end;
$$;

revoke all on function public.capture_pos_repair_payments_statement() from public, anon, authenticated;
grant execute on function public.capture_pos_repair_payments_statement() to service_role;

commit;
