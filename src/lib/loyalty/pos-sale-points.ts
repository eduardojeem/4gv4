/**
 * Puntos de una venta del POS.
 *
 * Hasta acá ninguna venta del POS sumaba puntos: la función que los acredita
 * solo se llamaba desde /api/sales, que ninguna pantalla usa. El POS cobra por
 * /api/pos/process-sale —ventas, turnos de agenda y reparaciones— y ninguna de
 * sus funciones de base acreditaba. En producción no había un solo asiento de
 * compra en el historial de puntos.
 */

type LoyaltyRpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{
    data: unknown
    error: { message?: string; code?: string } | null
  }>
}

export type PosSalePayment = { payment_method: string; amount: number }

/**
 * Lo que el cliente pagó ahora y suma puntos: sin la parte financiada (se paga
 * en cuotas más adelante) ni el saldo a favor (es plata que ya era suya). Nunca
 * más que el total de la venta, aunque el efectivo entregado lo supere.
 */
export function pointsBaseForPosSale(input: { total: number; payments: PosSalePayment[]; storeCreditAmount?: number | null }): number {
  const total = Math.max(0, Number(input.total) || 0)
  const storeCredit = Math.max(0, Number(input.storeCreditAmount) || 0)
  const paidNow = input.payments
    .filter((payment) => payment.payment_method !== 'credit')
    .reduce((sum, payment) => sum + Math.max(0, Number(payment.amount) || 0), 0)
  return Math.max(0, Math.min(paidNow, total - storeCredit))
}

export type PosSaleLoyaltyResult = {
  /** Puntos acreditados por esta venta (para el comprobante). */
  points: number
  errors: Array<{ message?: string; code?: string }>
}

function pointsOf(data: unknown): number {
  const row = Array.isArray(data) ? data[0] : data
  const points = row && typeof row === 'object' ? Number((row as { points?: unknown }).points) : 0
  return Number.isFinite(points) && points > 0 ? points : 0
}

/**
 * Acredita la venta. Cada reparación cobrada va con su propia clave
 * (`repair:<id>`), la misma que usan sus pantallas de cobro y entrega: si
 * después se entrega desde reparaciones, no se acredita dos veces. El resto,
 * con `sale:<id>`. Las claves hacen que reintentar sea seguro.
 */
export async function awardPosSaleLoyaltyPoints(
  client: LoyaltyRpcClient,
  input: {
    organizationId: string
    customerId: string | null
    saleId: string
    pointsBase: number
    repairs?: Array<{ id: string; amount: number }>
  },
): Promise<PosSaleLoyaltyResult> {
  const result: PosSaleLoyaltyResult = { points: 0, errors: [] }
  if (!input.customerId || input.pointsBase <= 0) return result

  let remaining = input.pointsBase
  const award = async (amount: number, key: string) => {
    if (amount <= 0) return
    const { data, error } = await client.rpc('award_loyalty_points_for_sale', {
      p_organization_id: input.organizationId,
      p_customer_id: input.customerId,
      p_amount: amount,
      p_sale_id: input.saleId,
      p_idempotency_key: key,
    })
    if (error) result.errors.push(error)
    else result.points += pointsOf(data)
  }

  for (const repair of input.repairs ?? []) {
    const amount = Math.min(remaining, Math.max(0, Number(repair.amount) || 0))
    remaining -= amount
    await award(amount, `repair:${repair.id}`)
  }
  await award(remaining, `sale:${input.saleId}`)
  return result
}
