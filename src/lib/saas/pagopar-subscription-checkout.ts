import { randomUUID } from 'crypto'
import {
  createPagoparOrder,
  getPagoparAmountInPyg,
  isPagoparConfigured,
  type PagoparPaymentMethod,
  PagoparOrderCreationError,
} from '@/lib/payments/pagopar'
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

export async function createSubscriptionPagoparCheckout(params: {
  organization: CheckoutOrganization
  userEmail?: string | null
  targetPlanCode?: string | null
  canChangePlan: boolean
  paymentMethod: PagoparPaymentMethod
  correlationId?: string
}) {
  const { organization, userEmail, targetPlanCode, canChangePlan, paymentMethod, correlationId } = params

  if (!isPagoparConfigured()) {
    throw new SubscriptionCheckoutError('Pagopar no está configurado.', 501)
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
  const pendingPaymentMethod = paymentMethod === 'qr' ? 'Pagopar QR' : 'Pagopar Tarjeta'
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const { data: reusablePayment } = await admin
    .from('subscription_payments')
    .select('receipt_url')
    .eq('organization_id', organization.id)
    .eq('plan_id', targetPlan.code)
    .eq('provider', 'pagopar')
    .eq('status', 'pending')
    .eq('payment_method', pendingPaymentMethod)
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
      paymentMethod,
      correlationId,
      reused: true,
    }
  }

  const externalReference = `SUB${Date.now()}${randomUUID().replace(/-/g, '').slice(0, 10)}`
  const { data: payment, error: paymentError } = await admin
    .from('subscription_payments')
    .insert({
      organization_id: organization.id,
      subscription_id: state.subscription?.id || null,
      plan_id: targetPlan.code,
      amount: chargedAmount,
      currency: 'PYG',
      status: 'pending',
      payment_method: pendingPaymentMethod,
      provider: 'pagopar',
      external_reference: externalReference,
      proration_credit: proration?.credit ?? 0,
      proration_extra_days: proration?.extraDays ?? 0,
    })
    .select('id')
    .single()

  if (paymentError || !payment) {
    throw new SubscriptionCheckoutError(paymentError?.message || 'No se pudo crear el pago.', 500)
  }

  if (discount) await reserveSubscriptionDiscount(discount, payment.id)

  try {
    const order = await createPagoparOrder({
      amountPyg: chargedAmount,
      buyer: {
        businessName: state.billingProfile?.business_name || organization.name,
        document: state.billingProfile?.ruc || null,
        email: state.billingProfile?.billing_email || userEmail || null,
        name: state.billingProfile?.business_name || organization.name,
        phone: state.billingProfile?.phone || null,
        ruc: state.billingProfile?.ruc || null,
        address: state.billingProfile?.fiscal_address || '',
      },
      description: `Suscripción ${targetPlan.name} - ${organization.name}`,
      externalReference,
      itemId: Number.parseInt(payment.id.replace(/[^\d]/g, '').slice(0, 9), 10) || 1,
      paymentMethod,
      correlationId,
    })

    const { error: updateError } = await admin
      .from('subscription_payments')
      .update({
        provider_payment_id: order.providerOrderId,
        receipt_url: order.checkoutUrl,
        external_reference: order.hash,
      })
      .eq('id', payment.id)

    if (updateError) {
      throw new Error(`No se pudo vincular el pago con Pagopar: ${updateError.message}`)
    }

    return {
      checkoutUrl: order.checkoutUrl,
      planCode: targetPlan.code,
      paymentMethod,
      reused: false,
    }
  } catch (error) {
    await admin
      .from('subscription_payments')
      .update({ status: 'failed' })
      .eq('id', payment.id)

    // 424 y no 502: Cloudflare, delante del sitio, reemplaza las respuestas
    // 502 por su propia página y el usuario perdería el motivo del rechazo.
    throw new SubscriptionCheckoutError(
      error instanceof Error ? error.message : 'No se pudo iniciar el pago con Pagopar.',
      424,
      undefined,
      error instanceof PagoparOrderCreationError ? error.correlationId : correlationId,
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

  const amountPyg = getPagoparAmountInPyg(targetPlan.price_monthly, targetPlan.currency)
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
