-- ───────────────────────────────────────────────────────────────────────────
-- Anular una venta, en vez de borrarla
--
-- `DELETE /api/sales` borraba la fila y nada más. La venta desaparecía pero:
--   · el stock que había descontado no volvía nunca,
--   · el crédito y sus cuotas seguían vivos —`credit_installments.sale_id` es
--     `on delete set null`—, así que el cliente seguía debiendo una venta que
--     ya no existía,
--   · la plata seguía contada en el cierre de caja.
--
-- Anular es lo contrario: la venta queda, marcada como anulada y con el motivo,
-- y se revierte cada efecto dentro de la misma transacción.
--
-- Lo que NO hace, a propósito: si el crédito ya tiene pagos, no se anula sola.
-- Devolver plata cobrada es una decisión del negocio —nota de crédito, saldo a
-- favor, efectivo—, no algo que deba inventar una función.
-- ───────────────────────────────────────────────────────────────────────────

begin;

comment on column public.credit_installments.status is
  'pending | paid | cancelled. El estado «late» no lo escribe nadie: la mora se calcula por fecha al leer (ver isCreditInstallmentOverdue). Una consulta que filtre por «late» va a devolver siempre cero.';

create or replace function public.void_pos_sale(
  p_sale_id uuid,
  p_organization_id uuid,
  p_actor_id uuid,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sale public.sales%rowtype;
  item record;
  credit record;
  paid_installments integer := 0;
  cancelled_installments integer := 0;
  restored_units integer := 0;
  cash_total numeric := 0;
  open_session uuid;
  motivo text := nullif(trim(coalesce(p_reason, '')), '');
begin
  select * into sale
  from public.sales
  where id = p_sale_id and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'SALE_NOT_IN_ORGANIZATION';
  end if;

  -- Anular dos veces no puede devolver el stock dos veces.
  if sale.status = 'cancelled' then
    return jsonb_build_object('sale_id', sale.id, 'already_voided', true);
  end if;

  -- ── El crédito primero: si ya cobraron algo, no se sigue ──
  for credit in
    select c.id
    from public.customer_credits c
    where c.sale_id = p_sale_id and c.organization_id = p_organization_id
  loop
    select count(*) into paid_installments
    from public.credit_installments i
    where i.credit_id = credit.id and coalesce(i.amount_paid, 0) > 0;

    if paid_installments > 0 then
      raise exception 'SALE_CREDIT_ALREADY_PAID';
    end if;
  end loop;

  -- ── Stock: se devuelve lo que la venta descontó ──
  for item in
    select si.product_id, si.variant_id, sum(si.quantity)::integer as quantity
    from public.sale_items si
    where si.sale_id = p_sale_id and si.organization_id = p_organization_id
    group by si.product_id, si.variant_id
  loop
    if item.variant_id is not null then
      perform public.adjust_variant_stock_atomic(
        p_organization_id, sale.branch_id, item.variant_id, item.quantity,
        'return', 'void-sale:' || p_sale_id::text || ':' || item.variant_id::text,
        p_actor_id, 'sale', p_sale_id, 'Anulación de venta',
        jsonb_build_object('sale_id', p_sale_id, 'voided', true)
      );
    else
      update public.products
      set stock_quantity = stock_quantity + item.quantity, updated_at = now()
      where id = item.product_id and organization_id = p_organization_id;

      update public.branch_inventory
      set stock_quantity = stock_quantity + item.quantity, updated_at = now()
      where branch_id = sale.branch_id and product_id = item.product_id;
    end if;

    restored_units := restored_units + item.quantity;
  end loop;

  -- ── Crédito: las cuotas impagas se cancelan y el crédito se cierra ──
  for credit in
    select c.id
    from public.customer_credits c
    where c.sale_id = p_sale_id and c.organization_id = p_organization_id
  loop
    update public.credit_installments
    set status = 'cancelled', updated_at = now()
    where credit_id = credit.id and status <> 'paid';
    get diagnostics cancelled_installments = row_count;

    update public.customer_credits
    set status = 'cancelled',
        updated_at = now(),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'voided_with_sale', p_sale_id, 'voided_at', now(), 'voided_by', p_actor_id)
    where id = credit.id;
  end loop;

  -- ── Caja: el efectivo cobrado sale con un movimiento inverso ──
  select coalesce(sum(sp.amount), 0) into cash_total
  from public.sale_payments sp
  where sp.sale_id = p_sale_id
    and sp.organization_id = p_organization_id
    and lower(sp.payment_method) = 'cash';

  if cash_total > 0 then
    select cc.id into open_session
    from public.cash_closures cc
    where cc.organization_id = p_organization_id
      and cc.branch_id = sale.branch_id
      and cc.date is null
    order by cc.created_at desc
    limit 1;

    -- Sin caja abierta el movimiento no se puede registrar: mejor frenar que
    -- devolver el stock y dejar la plata contada como si se hubiera vendido.
    if open_session is null then
      raise exception 'VOID_REQUIRES_OPEN_REGISTER';
    end if;

    insert into public.cash_movements (
      session_id, type, amount, reason, payment_method, created_by, created_at,
      organization_id, branch_id
    ) values (
      open_session, 'cash_out', cash_total,
      'Anulación de venta ' || coalesce(sale.code, p_sale_id::text)
        || case when motivo is null then '' else ' — ' || motivo end,
      'cash', p_actor_id, now(), p_organization_id, sale.branch_id
    );
  end if;

  -- ── La venta queda, marcada ──
  update public.sales
  set status = 'cancelled',
      payment_status = 'cancelled',
      notes = trim(both E'\n' from coalesce(notes, '') || E'\n[ANULADA ' || to_char(now(), 'YYYY-MM-DD HH24:MI') || ']'
        || case when motivo is null then '' else ' ' || motivo end),
      updated_at = now()
  where id = p_sale_id;

  return jsonb_build_object(
    'sale_id', sale.id,
    'already_voided', false,
    'restored_units', restored_units,
    'cancelled_installments', cancelled_installments,
    'cash_returned', cash_total
  );
end $$;

revoke all on function public.void_pos_sale(uuid, uuid, uuid, text) from public;
grant execute on function public.void_pos_sale(uuid, uuid, uuid, text) to service_role;

commit;
