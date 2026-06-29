import { NextResponse } from 'next/server'
import { requireStaff, getAuthResponse, type AuthResult } from '@/lib/auth/require-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { canCreateRepair } from '@/lib/saas/subscription-service'

export const dynamic = 'force-dynamic'

// Uso y límite mensual de reparaciones de la organización (para mostrar avisos).
export async function GET() {
  try {
    const auth = await requireStaff()
    const authResponse = getAuthResponse(auth)
    if (authResponse) return authResponse
    const staffAuth = auth as Extract<AuthResult, { authenticated: true }>

    const organization = await getCurrentOrganizationContext(staffAuth.user.id)
    if (!organization) {
      return NextResponse.json({ error: 'organization_required' }, { status: 403 })
    }

    const gate = await canCreateRepair(organization.id)

    return NextResponse.json({
      current: gate.current,
      limit: gate.limit, // null = ilimitado
      remaining: gate.limit === null ? null : Math.max(0, gate.limit - gate.current),
      allowed: gate.allowed,
      blocked: gate.blocked === true,
      planName: gate.plan.name,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al obtener el uso de reparaciones'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
