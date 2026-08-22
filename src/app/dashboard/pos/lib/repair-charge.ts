export type ChargeableRepair = {
  final_cost?: number | null
  estimated_cost?: number | null
  paid_amount?: number | null
}

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

/**
 * Monto pendiente de cobro para una reparación vinculada al POS.
 *
 * El costo total (final_cost si existe, si no estimated_cost) menos lo que
 * ya se cobró por otra vía (p.ej. un anticipo cobrado desde "Cobrar Aquí" en
 * la pantalla de reparaciones, que acumula `paid_amount`). Sin esto, vincular
 * en el POS una reparación con un anticipo ya cobrado cobra el costo bruto
 * de nuevo — un doble cobro real. Nunca negativo: si ya está saldada o
 * sobrepagada, el saldo es 0.
 *
 * El RPC `process_pos_sale_atomic_v2` recalcula el mismo saldo en el
 * servidor y rechaza la venta si el total de pagos no coincide exactamente,
 * así que esta fórmula debe mantenerse igual a la de la migración
 * `supabase/migrations/20260805090000_charge_repair_balance_due.sql`.
 */
export function getRepairBalanceDue(repair: ChargeableRepair): number {
  const total = repair.final_cost || repair.estimated_cost || 0
  const paid = repair.paid_amount || 0
  return Math.max(0, roundMoney(total - paid))
}
