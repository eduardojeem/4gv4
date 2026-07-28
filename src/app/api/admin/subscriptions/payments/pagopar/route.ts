import { NextResponse } from 'next/server'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import {
  createSubscriptionPagoparCheckout,
  SubscriptionCheckoutError,
} from '@/lib/saas/pagopar-subscription-checkout'

export async function POST(request: Request) {
  const auth = await resolveRequestAuthUser()

  if ('reason' in auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const organization = await getCurrentOrganizationContext(auth.user.id)

  if (!organization || !['owner', 'admin'].includes(organization.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as { plan?: unknown }
  const targetPlanCode = typeof body.plan === 'string' ? body.plan.trim() : null

  try {
    const checkout = await createSubscriptionPagoparCheckout({
      organization,
      userEmail: auth.user.email,
      targetPlanCode,
      canChangePlan: organization.role === 'owner' || auth.user.role === 'super_admin',
    })

    return NextResponse.json(checkout)
  } catch (error) {
    if (error instanceof SubscriptionCheckoutError) {
      return NextResponse.json(
        {
          error: error.message,
          conflictingResources: error.conflictingResources,
        },
        { status: error.status },
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo iniciar el pago con Pagopar.' },
      { status: 500 },
    )
  }
}
