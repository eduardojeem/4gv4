import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import {
  assessPlanChange,
  cancelSubscriptionAtPeriodEnd,
  changePlan,
  getChangePlanData,
  getCurrentOrganizationSubscription,
  planRequiresPayment,
} from '@/lib/saas/subscription-service'
import {
  createSubscriptionPagoparCheckout,
  getMissingBillingFields,
  SubscriptionCheckoutError,
} from '@/lib/saas/pagopar-subscription-checkout'
import { parsePagoparPaymentMethod } from '@/lib/payments/pagopar'
import { getBrowserRequestOrigin, isStripeCheckoutEnabled } from '@/lib/payments/stripe'
import { createSubscriptionStripeCheckout } from '@/lib/saas/stripe-subscription-checkout'
import { BankTransferError, createBankTransferRequest } from '@/lib/saas/bank-transfers'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Fin del período pago vigente, si lo hay: hasta ahí se conserva el plan actual. */
function activePaidPeriodEnd(state: Awaited<ReturnType<typeof getCurrentOrganizationSubscription>>) {
  const periodEnd = state.subscription?.current_period_ends_at
  if (!periodEnd || state.currentPlan.price_monthly <= 0) return null
  return new Date(periodEnd).getTime() > Date.now() ? periodEnd : null
}

export async function GET() {
  const auth = await resolveRequestAuthUser()

  if ('reason' in auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const organization = await getCurrentOrganizationContext(auth.user.id)

  if (!organization || (organization.role !== 'owner' && auth.user.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Solo el propietario puede cambiar el plan.' }, { status: 403 })
  }

  try {
    const [data, state] = await Promise.all([
      getChangePlanData(organization.id),
      getCurrentOrganizationSubscription(organization.id),
    ])
    return NextResponse.json({
      ...data,
      stripeEnabled: isStripeCheckoutEnabled(),
      billingMissingFields: getMissingBillingFields(state.billingProfile),
      paidPeriodEndsAt: activePaidPeriodEnd(state),
      cancelScheduled: state.subscription?.cancel_at_period_end === true,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudieron cargar los planes.' },
      { status: 503 },
    )
  }
}

export async function POST(request: NextRequest) {
  const requestedCorrelationId = request.headers.get('x-correlation-id')
  const correlationId = requestedCorrelationId && UUID_PATTERN.test(requestedCorrelationId)
    ? requestedCorrelationId
    : randomUUID()
  const auth = await resolveRequestAuthUser()

  if ('reason' in auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const organization = await getCurrentOrganizationContext(auth.user.id)

  // Solo el propietario (o superadmin) puede cambiar el plan
  if (!organization || (organization.role !== 'owner' && auth.user.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Solo el propietario de la organización puede cambiar el plan.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const newPlan = typeof body.plan === 'string' ? body.plan.trim() : ''
  const useStripe = body.paymentMethod === 'stripe'
  const useTransfer = body.paymentMethod === 'transfer'
  const paymentMethod = useStripe || useTransfer ? null : parsePagoparPaymentMethod(body.paymentMethod ?? 'card')

  if (!newPlan) {
    return NextResponse.json({ error: 'Falta el campo plan.' }, { status: 400 })
  }

  try {
    const assessment = await assessPlanChange(organization.id, newPlan)
    if (assessment.success === false) {
      return NextResponse.json(
        { error: assessment.error, conflictingResources: assessment.conflictingResources },
        { status: assessment.conflictingResources ? 409 : 400 },
      )
    }

    if (planRequiresPayment(assessment.targetPlan)) {
      if (useTransfer) {
        const transfer = await createBankTransferRequest(organization.id, auth.user.id, assessment.targetPlan.code)
        return NextResponse.json({
          success: true,
          pendingPayment: true,
          transferRequestId: transfer.id,
          redirectTo: '/admin/subscriptions#pay-transfer',
        })
      }

      if (useStripe) {
        const checkout = await createSubscriptionStripeCheckout({
          organization,
          userEmail: auth.user.email,
          targetPlanCode: assessment.targetPlan.code,
          canChangePlan: true,
          requestOrigin: getBrowserRequestOrigin(request),
          correlationId,
        })
        return NextResponse.json({ success: true, pendingPayment: true, ...checkout })
      }

      if (!paymentMethod) {
        return NextResponse.json({ error: 'Forma de pago no válida.' }, { status: 400 })
      }

      const checkout = await createSubscriptionPagoparCheckout({
        organization,
        userEmail: auth.user.email,
        targetPlanCode: assessment.targetPlan.code,
        canChangePlan: true,
        paymentMethod,
        correlationId,
      })
      return NextResponse.json({ success: true, pendingPayment: true, ...checkout })
    }

    // Bajar al plan gratuito con un mes ya pagado no corta ese mes: se programa
    // la baja para el vencimiento, igual que «Cancelar suscripción».
    const state = await getCurrentOrganizationSubscription(organization.id)
    if (activePaidPeriodEnd(state)) {
      const scheduled = await cancelSubscriptionAtPeriodEnd(organization.id)
      if (scheduled.success === false) {
        return NextResponse.json(
          { error: scheduled.error, conflictingResources: scheduled.conflictingResources },
          { status: scheduled.conflictingResources ? 409 : 400 },
        )
      }
      return NextResponse.json({
        success: true,
        pendingPayment: false,
        scheduled: true,
        effectiveUntil: scheduled.effectiveUntil,
      })
    }

    const result = await changePlan(organization.id, assessment.targetPlan.code)
    if (result.success === false) {
      return NextResponse.json(
        { error: result.error, conflictingResources: result.conflictingResources },
        { status: result.conflictingResources ? 409 : 400 },
      )
    }

    return NextResponse.json({ success: true, pendingPayment: false })
  } catch (error) {
    if (error instanceof SubscriptionCheckoutError) {
      return NextResponse.json(
        {
          error: error.message,
          conflictingResources: error.conflictingResources,
          correlationId: error.correlationId || correlationId,
        },
        { status: error.status },
      )
    }
    if (error instanceof BankTransferError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }

    return NextResponse.json(
      { error: `No se pudo cambiar el plan. Código: ${correlationId}`, correlationId },
      { status: 503 },
    )
  }
}
