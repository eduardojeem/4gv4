type LoyaltyRpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{
    data: unknown
    error: { message?: string; code?: string } | null
  }>
}

type PaidRepairInput = {
  organizationId: string
  repairId: string
  customerId: string | null
  total: number
  paymentStatus: string
}

export type RepairLoyaltyResult = {
  awarded: boolean
  reason: 'awarded' | 'not-paid' | 'missing-customer' | 'invalid-total' | 'disabled' | 'error'
  error?: { message?: string; code?: string }
}

/**
 * Acredita fidelidad cuando la reparación ya quedó totalmente pagada.
 * La clave estable hace seguro llamar esta función desde cobro y entrega.
 */
export async function awardPaidRepairLoyaltyPoints(
  client: LoyaltyRpcClient,
  input: PaidRepairInput,
): Promise<RepairLoyaltyResult> {
  if (input.paymentStatus !== 'pagado') return { awarded: false, reason: 'not-paid' }
  if (!input.customerId) return { awarded: false, reason: 'missing-customer' }

  const total = Number(input.total)
  if (!Number.isFinite(total) || total <= 0) return { awarded: false, reason: 'invalid-total' }

  const { data, error } = await client.rpc('award_loyalty_points_for_sale', {
    p_organization_id: input.organizationId,
    p_customer_id: input.customerId,
    p_amount: total,
    p_sale_id: null,
    p_idempotency_key: `repair:${input.repairId}`,
  })

  if (error) return { awarded: false, reason: 'error', error }
  if (!data) return { awarded: false, reason: 'disabled' }
  return { awarded: true, reason: 'awarded' }
}
