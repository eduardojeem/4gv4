import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import { getCurrentOrganizationSubscription } from '@/lib/saas/subscription-service'
import { getCurrentOrganizationContext } from '@/lib/saas/context'

async function getHandler(request: NextRequest, context: AdminAuthContext) {
  let organizationId = context.organizationId

  if (!organizationId && context.user.role === 'super_admin') {
    organizationId = (await getCurrentOrganizationContext(context.user.id).catch(() => null))?.id ?? null
  }

  if (!organizationId) {
    return NextResponse.json({ success: false, error: 'Organización no encontrada.' }, { status: 403 })
  }

  try {
    const data = await getCurrentOrganizationSubscription(organizationId)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo cargar la información de suscripción.'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export const GET = withAdminAuth(getHandler)
