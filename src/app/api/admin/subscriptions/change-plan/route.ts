import { NextRequest, NextResponse } from 'next/server'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { changePlan, getChangePlanData } from '@/lib/saas/subscription-service'

export async function GET(_request: NextRequest) {
  const auth = await resolveRequestAuthUser()

  if ('reason' in auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const organization = await getCurrentOrganizationContext(auth.user.id)

  if (!organization || !['owner', 'admin'].includes(organization.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const data = await getChangePlanData(organization.id)
  return NextResponse.json(data)
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

  const result = await changePlan(organization.id, newPlan)

  if (!result.success) {
    const failResult = result as { success: false; error: string; conflictingResources?: Array<{ resource: string; current: number; limit: number }> }
    return NextResponse.json(
      { error: failResult.error, conflictingResources: failResult.conflictingResources },
      { status: failResult.conflictingResources ? 409 : 400 }
    )
  }

  return NextResponse.json({ success: true })
}
