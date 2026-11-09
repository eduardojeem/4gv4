import { NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/api/withAdminAuth'
import { resolveWebsiteAdminOrganizationId } from '@/lib/website/admin-organization'
import { getOrganizationTemplateAccess } from '@/lib/website/template-plan-access.server'

/**
 * GET /api/admin/website/storefront-templates
 * Plantillas que trae el plan de la organización y en qué plan está cada una.
 */
export const GET = withAdminAuth(async (_request, context) => {
  const organizationId = await resolveWebsiteAdminOrganizationId(context)
  if (!organizationId) {
    return NextResponse.json({ success: false, error: 'No active organization found' }, { status: 403 })
  }
  try {
    const access = await getOrganizationTemplateAccess(organizationId)
    return NextResponse.json({ success: true, data: access })
  } catch (error) {
    console.error('[storefront-templates] No se pudo leer el plan', error)
    return NextResponse.json({ success: false, error: 'No se pudo comprobar tu plan.' }, { status: 500 })
  }
})
