import { NextRequest, NextResponse } from 'next/server'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import {
  assessPlanChange,
  changePlan,
  getChangePlanData,
  planRequiresPayment,
} from '@/lib/saas/subscription-service'
import {
  createSubscriptionPagoparCheckout,
  SubscriptionCheckoutError,
} from '@/lib/saas/pagopar-subscription-checkout'

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
    const data = await getChangePlanData(organization.id)
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudieron cargar los planes.' },
      { status: 503 },
    )
  }
}

export async function POST(request: NextRequest) {
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
      const checkout = await createSubscriptionPagoparCheckout({
        organization,
        userEmail: auth.user.email,
        targetPlanCode: assessment.targetPlan.code,
        canChangePlan: true,
      })
      return NextResponse.json({ success: true, pendingPayment: true, ...checkout })
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
        { error: error.message, conflictingResources: error.conflictingResources },
        { status: error.status },
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo cambiar el plan.' },
      { status: 503 },
    )
  }
}
