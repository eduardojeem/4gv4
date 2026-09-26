export type ChargeableRepair = {
  final_cost?: number | null
  estimated_cost?: number | null
  paid_amount?: number | null
}

export type PosChargeableRepair = ChargeableRepair & {
  id?: string | null
  ticket_number?: string | number | null
  status?: string | null
  payment_status?: string | null
  qualityCheck?: { result?: string | null } | Array<{ result?: string | null }> | null
}

export type RepairChargeability = {
  canCharge: boolean
  balanceDue: number
  reason?: string
}

export type RepairDeliveryEligibility = {
  canDeliver: boolean
  blockingTickets: string[]
  reason?: string
}

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
const READY_STATUSES = new Set(['listo', 'ready_for_pickup', 'completed'])
const PAID_STATUSES = new Set(['pagado', 'paid'])

function finiteMoney(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeStatus(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase()
}

function normalizeQualityResult(repair: PosChargeableRepair): string {
  const qualityCheck = Array.isArray(repair.qualityCheck)
    ? repair.qualityCheck[0]
    : repair.qualityCheck
  return String(qualityCheck?.result ?? '').trim().toLowerCase()
}

function repairTicket(repair: PosChargeableRepair): string {
  const ticket = String(repair.ticket_number ?? '').trim()
  return ticket || String(repair.id ?? 'Sin ticket')
}

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
  const total = finiteMoney(repair.final_cost) ?? finiteMoney(repair.estimated_cost) ?? 0
  const paid = finiteMoney(repair.paid_amount) ?? 0
  return Math.max(0, roundMoney(total - paid))
}

export function getRepairChargeability(repair: PosChargeableRepair): RepairChargeability {
  if (PAID_STATUSES.has(normalizeStatus(repair.payment_status))) {
    return { canCharge: false, balanceDue: 0, reason: 'Sin saldo pendiente' }
  }

  const balanceDue = getRepairBalanceDue(repair)
  return balanceDue > 0
    ? { canCharge: true, balanceDue }
    : { canCharge: false, balanceDue: 0, reason: 'Sin saldo pendiente' }
}

export function getRepairDeliveryEligibility(
  repairs: PosChargeableRepair[]
): RepairDeliveryEligibility {
  if (repairs.length === 0) {
    return {
      canDeliver: false,
      blockingTickets: [],
      reason: 'Seleccioná al menos una reparación',
    }
  }

  const blockingTickets = repairs
    .filter((repair) => (
      !READY_STATUSES.has(normalizeStatus(repair.status))
      || normalizeQualityResult(repair) !== 'passed'
    ))
    .map(repairTicket)

  return blockingTickets.length === 0
    ? { canDeliver: true, blockingTickets: [] }
    : {
        canDeliver: false,
        blockingTickets,
        reason: 'Falta estado Listo o control técnico aprobado',
      }
}
