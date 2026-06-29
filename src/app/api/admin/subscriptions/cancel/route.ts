import { NextRequest, NextResponse } from 'next/server'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { cancelSubscriptionAtPeriodEnd, reactivateSubscription } from '@/lib/saas/subscription-service'

export async function POST(request: NextRequest) {
  const auth = await resolveRequestAuthUser()
  if ('reason' in auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const organization = await getCurrentOrganizationContext(auth.user.id)
  // Owner y admin de la organización (o superadmin) pueden cancelar.
  if (
    !organization ||
    (!['owner', 'admin'].includes(organization.role) && auth.user.role !== 'super_admin')
  ) {
    return NextResponse.json(
      { error: 'Solo el propietario o un administrador de la organización puede cancelar la suscripción.' },
      { status: 403 },
    )
  }

  const body = await request.json().catch(() => ({})) as { reactivate?: boolean }

  if (body.reactivate === true) {
    const result = await reactivateSubscription(organization.id)
    if (!result.success) {
      const fail = result as { success: false; error: string }
      return NextResponse.json({ error: fail.error }, { status: 400 })
    }
    return NextResponse.json({ success: true, reactivated: true })
  }

  const result = await cancelSubscriptionAtPeriodEnd(organization.id)
  if (!result.success) {
    const fail = result as { success: false; error: string; conflictingResources?: Array<{ resource: string; current: number; limit: number }> }
    return NextResponse.json(
      { error: fail.error, conflictingResources: fail.conflictingResources },
      { status: fail.conflictingResources ? 409 : 400 },
    )
  }

  const ok = result as { success: true; effectiveUntil: string | null }
  return NextResponse.json({ success: true, effectiveUntil: ok.effectiveUntil })
}
