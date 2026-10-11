type LoyaltyRpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{
    data: unknown
    error: { message?: string; code?: string } | null
  }>
}

/**
 * Puntos de un pedido de la tienda online, cuando queda totalmente pagado.
 *
 * Los pedidos web no sumaban nada. Suma lo cobrado en dinero (el total menos el
 * saldo a favor aplicado o reservado), una sola vez por pedido: la clave
 * `order:<id>` hace que registrar otro cobro o reintentar no acredite de nuevo.
 */
export async function awardPaidOrderLoyaltyPoints(
  client: LoyaltyRpcClient,
  input: {
    organizationId: string
    orderId: string
    customerId: string | null
    paymentStatus: string
    total: number
    storeCreditApplied?: number | null
    storeCreditReserved?: number | null
  },
): Promise<{ points: number; error: { message?: string; code?: string } | null }> {
  if (input.paymentStatus !== 'PAID' || !input.customerId) return { points: 0, error: null }
  const amount = Math.max(0, (Number(input.total) || 0) - (Number(input.storeCreditApplied) || 0) - (Number(input.storeCreditReserved) || 0))
  if (amount <= 0) return { points: 0, error: null }

  const { data, error } = await client.rpc('award_loyalty_points_for_sale', {
    p_organization_id: input.organizationId,
    p_customer_id: input.customerId,
    p_amount: amount,
    p_sale_id: null,
    p_idempotency_key: `order:${input.orderId}`,
  })
  if (error) return { points: 0, error }
  const points = Number((data as { points?: unknown } | null)?.points)
  return { points: Number.isFinite(points) && points > 0 ? points : 0, error: null }
}
