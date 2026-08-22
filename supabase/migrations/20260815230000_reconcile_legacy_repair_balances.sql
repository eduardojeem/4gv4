-- Reconcile historical repairs whose agreed customer price was stored only in
-- estimated_cost. The payment RPC intentionally derives automatic prices from
-- labor and parts, so these rows otherwise display a balance that cannot be
-- collected. This migration is idempotent because reconciled rows become
-- budget-priced and are excluded from subsequent executions.

with reconciled as (
  update public.repairs as r
  set
    pricing_mode = 'budget',
    final_cost = r.estimated_cost,
    price_override_reason = coalesce(
      nullif(btrim(r.price_override_reason), ''),
      'Reconciliacion automatica de precio historico antes del cobro'
    ),
    updated_at = now()
  where r.pricing_mode = 'automatic'
    and r.final_cost is null
    and coalesce(r.labor_cost, 0) = 0
    and coalesce(r.estimated_cost, 0) > coalesce(r.paid_amount, 0)
    and r.status <> 'cancelado'
    and not exists (
      select 1
      from public.repair_parts as rp
      where rp.repair_id = r.id
        and greatest(coalesce(rp.quantity, 0), 0)
          * greatest(coalesce(rp.unit_price, rp.unit_cost, 0), 0) > 0
    )
  returning r.id, r.estimated_cost
)
insert into public.repair_notes (
  repair_id,
  author_id,
  author_name,
  note_text,
  is_internal
)
select
  reconciled.id,
  null,
  'Sistema',
  'Precio historico reconciliado como presupuesto acordado: '
    || reconciled.estimated_cost::text
    || '. No se registro ningun pago ni movimiento de caja.',
  true
from reconciled;

