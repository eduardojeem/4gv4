import { randomUUID } from 'crypto'
import {
  createPagoparOrder,
  getPagoparAmountInPyg,
  isPagoparConfigured,
  type PagoparPaymentMethod,
} from '@/lib/payments/pagopar'
import { createAdminSupabase } from '@/lib/supabase/admin'
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
  ) {
    super(message)
  }
}

function getMissingBillingFields(
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
}) {
  const { organization, userEmail, targetPlanCode, canChangePlan, paymentMethod } = params

  if (!isPagoparConfigured()) {
    throw new SubscriptionCheckoutError('Pagopar no está configurado.', 501)
  }

  const state = await getCurrentOrganizationSubscription(organization.id)
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
    const assessment = await assessPlanChange(organization.id, targetPlan.code)
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
      amount: amountPyg,
      currency: 'PYG',
      status: 'pending',
      payment_method: pendingPaymentMethod,
      provider: 'pagopar',
      external_reference: externalReference,
    })
    .select('id')
    .single()

  if (paymentError || !payment) {
    throw new SubscriptionCheckoutError(paymentError?.message || 'No se pudo crear el pago.', 500)
  }

  try {
    const order = await createPagoparOrder({
      amountPyg,
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

    throw new SubscriptionCheckoutError(
      error instanceof Error ? error.message : 'No se pudo iniciar el pago con Pagopar.',
      502,
    )
  }
}
