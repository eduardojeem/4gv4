/**
 * Deuda pendiente de un cliente, en un solo lugar.
 *
 * El panel del cliente descontaba de la linea de credito la deuda de
 * reparaciones, y el servidor —que es quien aprueba o rechaza la venta— solo
 * descontaba las cuotas. La pantalla y la caja decian cosas distintas. La regla
 * vive aca para que las dos usen exactamente la misma.
 */

export type OutstandingInstallment = {
  status?: string | null
  amount?: number | string | null
  amount_paid?: number | string | null
}

export type OutstandingRepair = {
  status?: string | null
  payment_status?: string | null
  final_cost?: number | string | null
  estimated_cost?: number | string | null
  paid_amount?: number | string | null
}

const PENDING_INSTALLMENT_STATUSES = ['pending', 'late']
const PAID_REPAIR_STATUSES = ['pagado', 'paid']

function toAmount(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

/**
 * Lo que falta cobrar de las cuotas: el saldo de cada una, no su importe
 * completo. Una cuota abonada a medias no debe contar entera.
 */
export function sumInstallmentsOutstanding(installments: OutstandingInstallment[]): number {
  return installments.reduce((total, installment) => {
    const status = String(installment.status ?? '').toLowerCase()
    if (!PENDING_INSTALLMENT_STATUSES.includes(status)) return total

    const amount = toAmount(installment.amount)
    const paid = Math.min(amount, toAmount(installment.amount_paid))
    return total + (amount - paid)
  }, 0)
}

/**
 * Lo que falta cobrar de las reparaciones. Se ignora la que ya figura pagada y
 * la que todavia no tiene costo cargado: sin costo no hay deuda que reclamar.
 */
export function sumRepairsOutstanding(repairs: OutstandingRepair[]): number {
  return repairs.reduce((total, repair) => {
    const isPaid = PAID_REPAIR_STATUSES.includes(String(repair.payment_status ?? '').toLowerCase())
    if (isPaid) return total

    const cost = toAmount(repair.final_cost ?? repair.estimated_cost)
    if (cost <= 0) return total

    const paid = toAmount(repair.paid_amount)
    return total + Math.max(0, cost - paid)
  }, 0)
}

export type CustomerOutstanding = {
  installments: number
  repairs: number
  total: number
}

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => PromiseLike<{ data: unknown[] | null; error: unknown }>
        in: (column: string, values: string[]) => PromiseLike<{ data: unknown[] | null; error: unknown }>
      }
    }
  }
}

/**
 * Deuda total del cliente contra la que se mide su linea de credito.
 *
 * Incluye reparaciones por decision de negocio: cualquier saldo abierto consume
 * el cupo, no solo las ventas financiadas.
 */
export async function getCustomerOutstandingDebt(params: {
  supabase: SupabaseLike
  organizationId: string
  customerId: string
}): Promise<CustomerOutstanding> {
  const { supabase, organizationId, customerId } = params

  const creditsResult = await supabase
    .from('customer_credits')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('customer_id', customerId)

  if (creditsResult.error) throw creditsResult.error

  const creditIds = ((creditsResult.data ?? []) as Array<{ id?: string }>)
    .map((row) => String(row.id ?? ''))
    .filter(Boolean)

  let installments = 0
  if (creditIds.length > 0) {
    const installmentsResult = await supabase
      .from('credit_installments')
      .select('status, amount, amount_paid')
      .eq('organization_id', organizationId)
      .in('credit_id', creditIds)

    if (installmentsResult.error) throw installmentsResult.error
    installments = sumInstallmentsOutstanding((installmentsResult.data ?? []) as OutstandingInstallment[])
  }

  const repairsResult = await supabase
    .from('repairs')
    .select('status, payment_status, final_cost, estimated_cost, paid_amount')
    .eq('organization_id', organizationId)
    .eq('customer_id', customerId)

  if (repairsResult.error) throw repairsResult.error
  const repairs = sumRepairsOutstanding((repairsResult.data ?? []) as OutstandingRepair[])

  return { installments, repairs, total: installments + repairs }
}
