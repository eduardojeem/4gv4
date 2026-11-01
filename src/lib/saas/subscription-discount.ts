import 'server-only'
import { createAdminSupabase } from '@/lib/supabase/admin'

/**
 * Cupones de descuento de la suscripción (porcentaje o monto fijo).
 *
 * El canje solo registra el cupón; el descuento se aplica en el cobro con
 * tarjeta o QR. Al iniciar ese cobro el cupón queda reservado para el pago
 * (applied_payment_id). Si el pago falla, o queda pendiente más que el plazo
 * de Pagopar, el cupón vuelve a estar disponible.
 */

const PENDING_PAYMENT_TTL_MS = 72 * 60 * 60 * 1000

export type SubscriptionDiscount = {
  redemptionId: string
  percent: number | null
  amount: number | null
}

type RedemptionRow = {
  id: string
  benefit_snapshot: Record<string, unknown> | null
  applied_payment_id: string | null
}

function readNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

/** Monto con el descuento aplicado; nunca menos de 1 guaraní. */
export function applySubscriptionDiscount(amountPyg: number, discount: SubscriptionDiscount | null) {
  if (!discount) return Math.round(amountPyg)
  const discounted = discount.percent !== null
    ? amountPyg * (1 - Math.min(discount.percent, 100) / 100)
    : amountPyg - (discount.amount ?? 0)
  return Math.max(1, Math.round(discounted))
}

/** El cupón de descuento canjeado más reciente que todavía se puede usar con este plan. */
export async function findAvailableSubscriptionDiscount(
  organizationId: string,
  planCode: string,
  now = Date.now(),
): Promise<SubscriptionDiscount | null> {
  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('subscription_promo_redemptions')
    .select('id, benefit_snapshot, applied_payment_id')
    .eq('organization_id', organizationId)
    .order('redeemed_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('[subscription-discount] No se pudieron leer los cupones', { organizationId, code: error.code })
    return null
  }

  for (const row of (data ?? []) as RedemptionRow[]) {
    const benefit = row.benefit_snapshot ?? {}
    const type = benefit.benefit_type
    if (type !== 'discount_percent' && type !== 'discount_fixed') continue

    const targetPlan = typeof benefit.target_plan === 'string' ? benefit.target_plan.trim().toUpperCase() : ''
    if (targetPlan && targetPlan !== planCode.toUpperCase()) continue

    if (row.applied_payment_id) {
      const { data: payment } = await admin
        .from('subscription_payments')
        .select('status, created_at')
        .eq('id', row.applied_payment_id)
        .maybeSingle()
      const stalePending = payment?.status === 'pending'
        && now - new Date(payment.created_at as string).getTime() > PENDING_PAYMENT_TTL_MS
      if (payment && payment.status !== 'failed' && !stalePending) continue
    }

    const percent = type === 'discount_percent' ? readNumber(benefit.discount_percent) : null
    const amount = type === 'discount_fixed' ? readNumber(benefit.discount_amount) : null
    if (percent === null && amount === null) continue
    return { redemptionId: row.id, percent, amount }
  }

  return null
}

/** Reserva el cupón para el pago que se acaba de crear. */
export async function reserveSubscriptionDiscount(discount: SubscriptionDiscount, paymentId: string) {
  const { error } = await createAdminSupabase()
    .from('subscription_promo_redemptions')
    .update({ applied_payment_id: paymentId })
    .eq('id', discount.redemptionId)
  if (error) {
    console.error('[subscription-discount] No se pudo reservar el cupón', { redemptionId: discount.redemptionId, code: error.code })
  }
}

export function describeSubscriptionDiscount(discount: SubscriptionDiscount) {
  return discount.percent !== null ? `${discount.percent}% de descuento` : 'Descuento por cupón'
}
