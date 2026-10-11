type LoyaltyClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>
      }
    }
  }
}

/**
 * Puntos de una venta a crédito: se suman al cobrar cada cuota, no al vender.
 *
 * Sumarlos al vender premiaba plata que todavía no entró (y que quizás no
 * entre). Cada pago acredita lo cobrado, con la clave
 * `credit-installment:<cuota>:<pagado hasta ahora>`: dos pagos parciales de la
 * misma cuota tienen claves distintas, y reintentar el mismo pedido no vuelve
 * a acreditar. Vale para el cobro de cuotas, el cobro por cliente y la primera
 * cuota que se paga en el POS al vender.
 */
export async function awardCreditInstallmentLoyaltyPoints(
  client: LoyaltyClient,
  input: { organizationId: string; installmentId: string; paidAmount: number },
): Promise<{ points: number; error: { message?: string; code?: string } | null }> {
  const paid = Math.max(0, Number(input.paidAmount) || 0)
  if (!input.installmentId || paid <= 0) return { points: 0, error: null }

  const { data, error } = await client
    .from('credit_installments')
    .select('id, amount_paid, customer_credits(customer_id, organization_id)')
    .eq('id', input.installmentId)
    .maybeSingle()
  if (error) return { points: 0, error }

  const row = data as { amount_paid?: number | null; customer_credits?: { customer_id?: string; organization_id?: string } | Array<{ customer_id?: string; organization_id?: string }> | null } | null
  const credit = Array.isArray(row?.customer_credits) ? row?.customer_credits[0] : row?.customer_credits
  if (!credit?.customer_id || credit.organization_id !== input.organizationId) return { points: 0, error: null }

  const paidSoFar = Number(row?.amount_paid ?? 0)
  const { data: awarded, error: awardError } = await client.rpc('award_loyalty_points_for_sale', {
    p_organization_id: input.organizationId,
    p_customer_id: credit.customer_id,
    p_amount: paid,
    p_sale_id: null,
    p_idempotency_key: `credit-installment:${input.installmentId}:${paidSoFar}`,
  })
  if (awardError) return { points: 0, error: awardError }
  const points = Number((awarded as { points?: unknown } | null)?.points)
  return { points: Number.isFinite(points) && points > 0 ? points : 0, error: null }
}
