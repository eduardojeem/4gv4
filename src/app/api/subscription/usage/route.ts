import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, getAuthResponse, type AuthResult } from '@/lib/auth/require-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { canCreateResource, type ResourceType } from '@/lib/saas/subscription-service'

export const dynamic = 'force-dynamic'

const VALID_RESOURCES = new Set<ResourceType>(['users', 'branches', 'cashRegisters', 'products', 'categories'])

// Uso y límite de un recurso del plan (productos, usuarios, sucursales, cajas).
export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaff()
    const authResponse = getAuthResponse(auth)
    if (authResponse) return authResponse
    const staffAuth = auth as Extract<AuthResult, { authenticated: true }>

    const resource = request.nextUrl.searchParams.get('resource') as ResourceType | null
    if (!resource || !VALID_RESOURCES.has(resource)) {
      return NextResponse.json({ error: 'Invalid resource' }, { status: 400 })
    }

    const organization = await getCurrentOrganizationContext(staffAuth.user.id)
    if (!organization) {
      return NextResponse.json({ error: 'organization_required' }, { status: 403 })
    }

    const gate = await canCreateResource(organization.id, resource)

    return NextResponse.json({
      resource,
      current: gate.current,
      limit: gate.limit, // null = ilimitado
      remaining: gate.limit === null ? null : Math.max(0, gate.limit - gate.current),
      allowed: gate.allowed,
      blocked: gate.blocked === true,
      planName: gate.plan.name,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al obtener el uso del recurso'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
