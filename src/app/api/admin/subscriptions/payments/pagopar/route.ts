import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import {
  createSubscriptionPagoparCheckout,
  SubscriptionCheckoutError,
} from '@/lib/saas/pagopar-subscription-checkout'
import { parsePagoparPaymentMethod } from '@/lib/payments/pagopar'

export async function POST(request: Request) {
  const requestedCorrelationId = request.headers.get('x-correlation-id')
  const correlationId = requestedCorrelationId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedCorrelationId)
    ? requestedCorrelationId
    : randomUUID()
  const auth = await resolveRequestAuthUser()

  if ('reason' in auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const organization = await getCurrentOrganizationContext(auth.user.id)

  if (!organization || !['owner', 'admin'].includes(organization.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as {
    plan?: unknown
    paymentMethod?: unknown
  }
  const targetPlanCode = typeof body.plan === 'string' ? body.plan.trim() : null
  const paymentMethod = parsePagoparPaymentMethod(body.paymentMethod ?? 'card')

  if (!paymentMethod) {
    return NextResponse.json({ error: 'Forma de pago de Pagopar no válida.' }, { status: 400 })
  }

  try {
    const checkout = await createSubscriptionPagoparCheckout({
      organization,
      userEmail: auth.user.email,
      targetPlanCode,
      canChangePlan: organization.role === 'owner' || auth.user.role === 'super_admin',
      paymentMethod,
      correlationId,
    })

    return NextResponse.json(checkout)
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

    return NextResponse.json(
      {
        error: `No se pudo iniciar el pago. Código: ${correlationId}`,
        correlationId,
      },
      { status: 500 },
    )
  }
}
