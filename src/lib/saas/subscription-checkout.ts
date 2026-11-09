import { randomUUID } from 'crypto'
import { assertSubscriptionPaymentEnabled } from '@/lib/payments/subscription-controls'
import { PaymentControlError } from '@/lib/payments/control-contract'
import {
  BancardError,
  createBancardSingleBuy,
  getBancardAmountInPyg,
  isBancardConfigured,
} from '@/lib/payments/bancard'
import { getAppReturnOrigin } from '@/lib/http/app-origin'
import { createAdminSupabase } from '@/lib/supabase/admin'
import {
  applySubscriptionDiscount,
  findAvailableSubscriptionDiscount,
  reserveSubscriptionDiscount,
} from '@/lib/saas/subscription-discount'
import { prorationForChange } from '@/lib/saas/subscription-proration'
import {
  assessPlanChange,
  getCurrentOrganizationSubscription,
  normalizePlanCode,
} from '@/lib/saas/subscription-service'

/** Método con el que queda registrado un pago único con tarjeta por Bancard. */
export const BANCARD_CARD_PAYMENT_METHOD = 'Bancard Tarjeta'
/** Método de los cobros del débito automático (tarjeta guardada en Bancard). */
export const AUTOPAY_PAYMENT_METHOD = 'Bancard Débito automático'

type CheckoutOrganization = {
  id: string
  name: string
}

export class SubscriptionCheckoutError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly conflictingResources?: Array<{ resource: string; current: number; limit: number }>,
    readonly correlationId?: string,
  ) {
    super(message)
  }
}

export function getMissingBillingFields(
  profile: Awaited<ReturnType<typeof getCurrentOrganizationSubscription>>['billingProfile']
) {
  const missing: string[] = []
  const ruc = profile?.ruc?.replace(/[^\d]/g, '') || ''

  if (!profile?.business_name?.trim()) missing.push('Razón social')
  if (!ruc) missing.push('RUC o CI')
  if (!profile?.billing_email?.trim()) missing.push('Correo de facturación')
  if (!profile?.phone?.trim()) missing.push('Teléfono')
  if (!profile?.fiscal_address?.trim()) missing.push('Dirección fiscal')

  return missing
}

/** Siguiente shop_process_id para Bancard (entero único, sale de una secuencia de la base). */
export async function nextBancardShopProcessId() {
  const { data, error } = await createAdminSupabase().rpc('next_bancard_shop_process_id')
  const value = Array.isArray(data) ? data[0] : data
  if (error || value === null || value === undefined) {
    throw new Error(`No se pudo generar el identificador del pago: ${error?.message || 'sin respuesta'}`)
  }
  return String(value)
}

export function getBancardCheckoutPath(processId: string, shopProcessId: string) {
  return `/admin/subscriptions/pagar?process_id=${encodeURIComponent(processId)}&ref=${encodeURIComponent(shopProcessId)}`
}

export async function createSubscriptionBancardCheckout(params: {
  organization: CheckoutOrganization
  targetPlanCode?: string | null
  canChangePlan: boolean
  requestOrigin?: string | null
  correlationId?: string
}) {
  const { organization, targetPlanCode, canChangePlan, requestOrigin } = params
  const correlationId = params.correlationId || randomUUID()

  try { await assertSubscriptionPaymentEnabled('bancard_card') }
  catch (error) { if (error instanceof PaymentControlError) throw new SubscriptionCheckoutError(error.message, error.status); throw error }

  if (!isBancardConfigured()) {
    throw new SubscriptionCheckoutError('Bancard no está configurado.', 501)
  }

  const { state, targetPlan, amountPyg } = await resolveSubscriptionCheckoutTarget({
    organizationId: organization.id,
    targetPlanCode,
    canChangePlan,
  })

  // Cupón de descuento canjeado: se cobra el monto con descuento y el cupón
  // queda reservado para este pago.
  const discount = await findAvailableSubscriptionDiscount(organization.id, targetPlan.code)
  // Prorrateo al cambiar entre planes pagos: al subir se descuenta lo que
  // quedaba del plan actual; al bajar se suma como días extra.
  const proration = prorationForChange({
    currentPlanCode: state.currentPlan.code,
    currentPrice: state.currentPlan.price_monthly,
    targetPlanCode: targetPlan.code,
    targetPrice: amountPyg,
    subscription: state.subscription,
  })
  const discountedAmount = applySubscriptionDiscount(amountPyg, discount)
  const chargedAmount = proration?.kind === 'upgrade'
    ? Math.max(1, discountedAmount - proration.credit)
    : discountedAmount

  const admin = createAdminSupabase()
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const { data: reusablePayment } = await admin
    .from('subscription_payments')
    .select('receipt_url')
    .eq('organization_id', organization.id)
    .eq('plan_id', targetPlan.code)
    .eq('provider', 'bancard')
    .eq('status', 'pending')
    .eq('payment_method', BANCARD_CARD_PAYMENT_METHOD)
    .eq('amount', chargedAmount)
    .gte('created_at', fifteenMinutesAgo)
    .not('receipt_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (reusablePayment?.receipt_url) {
    return {
      checkoutUrl: reusablePayment.receipt_url,
      planCode: targetPlan.code,
      paymentMethod: 'card' as const,
      correlationId,
      reused: true,
    }
  }

  const shopProcessId = await nextBancardShopProcessId()
  const { data: payment, error: paymentError } = await admin
    .from('subscription_payments')
    .insert({
      organization_id: organization.id,
      subscription_id: state.subscription?.id || null,
      plan_id: targetPlan.code,
      amount: chargedAmount,
      currency: 'PYG',
      status: 'pending',
      payment_method: BANCARD_CARD_PAYMENT_METHOD,
      provider: 'bancard',
      external_reference: shopProcessId,
      proration_credit: proration?.credit ?? 0,
      proration_extra_days: proration?.extraDays ?? 0,
    })
    .select('id')
    .single()

  if (paymentError || !payment) {
    throw new SubscriptionCheckoutError(paymentError?.message || 'No se pudo crear el pago.', 500)
  }

  if (discount && !await reserveSubscriptionDiscount(discount, payment.id)) {
    await admin.from('subscription_payments').update({ status: 'failed' }).eq('id', payment.id)
    throw new SubscriptionCheckoutError('El cupón de descuento se está usando en otro pago. Volvé a intentar en unos segundos.', 409)
  }

  try {
    const origin = getAppReturnOrigin(requestOrigin)
    const returnUrl = `${origin}/admin/subscriptions/payments?ref=${shopProcessId}`
    const { processId } = await createBancardSingleBuy({
      shopProcessId,
      amountPyg: chargedAmount,
      description: `Plan ${targetPlan.name}`,
      returnUrl,
      cancelUrl: returnUrl,
    })
    const checkoutUrl = getBancardCheckoutPath(processId, shopProcessId)

    const { error: updateError } = await admin
      .from('subscription_payments')
      .update({ provider_payment_id: processId, receipt_url: checkoutUrl })
      .eq('id', payment.id)

    if (updateError) {
      throw new Error(`No se pudo vincular el pago con Bancard: ${updateError.message}`)
    }

    return {
      checkoutUrl,
      planCode: targetPlan.code,
      paymentMethod: 'card' as const,
      reused: false,
    }
  } catch (error) {
    await admin
      .from('subscription_payments')
      .update({ status: 'failed' })
      .eq('id', payment.id)

    console.error('[bancard-checkout] No se pudo iniciar el pago.', {
      correlationId,
      paymentId: payment.id,
      reason: error instanceof Error ? error.message : 'unknown_error',
    })
    // 424 y no 502: Cloudflare, delante del sitio, reemplaza las respuestas
    // 502 por su propia página y el usuario perdería el motivo del rechazo.
    throw new SubscriptionCheckoutError(
      error instanceof BancardError && error.rejected
        ? `Bancard rechazó el pago: ${error.message}`
        : `No se pudo iniciar el pago. Código: ${correlationId}`,
      424,
      undefined,
      correlationId,
    )
  }
}

/**
 * Valida plan, permisos, límites y datos de facturación antes de cobrar.
 * Compartido por todos los proveedores de pago de la suscripción.
 */
export async function resolveSubscriptionCheckoutTarget(params: {
  organizationId: string
  targetPlanCode?: string | null
  canChangePlan: boolean
}) {
  const { organizationId, targetPlanCode, canChangePlan } = params
  const state = await getCurrentOrganizationSubscription(organizationId)
  const requestedCode = targetPlanCode
    ? normalizePlanCode(targetPlanCode)
    : normalizePlanCode(state.currentPlan.code)
  const targetPlan = state.plans.find((plan) => plan.code === requestedCode)

  if (!targetPlan) {
    throw new SubscriptionCheckoutError('El plan solicitado no existe o no está disponible.', 404)
  }

  const isPlanChange = targetPlan.code !== state.currentPlan.code
  if (isPlanChange && !canChangePlan) {
    throw new SubscriptionCheckoutError('Solo el propietario puede cambiar el plan.', 403)
  }

  if (isPlanChange) {
    const assessment = await assessPlanChange(organizationId, targetPlan.code)
    if (assessment.success === false) {
      throw new SubscriptionCheckoutError(
        assessment.error,
        assessment.conflictingResources ? 409 : 400,
        assessment.conflictingResources,
      )
    }
  }

  const amountPyg = getBancardAmountInPyg(targetPlan.price_monthly, targetPlan.currency)
  if (amountPyg <= 0) {
    throw new SubscriptionCheckoutError('El plan solicitado no tiene monto para cobrar.', 400)
  }

  const missingFields = getMissingBillingFields(state.billingProfile)
  if (missingFields.length > 0) {
    throw new SubscriptionCheckoutError(
      `Completa los datos de facturación antes de pagar: ${missingFields.join(', ')}.`,
      400,
    )
  }

  return { state, targetPlan, amountPyg }
}
