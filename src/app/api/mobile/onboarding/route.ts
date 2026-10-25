import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { logger } from '@/lib/logger'
import { loadOnboardingProgress } from '@/lib/onboarding/progress'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Primeros pasos del comercio activo para la app: los mismos que cuenta
 * /admin/onboarding. Solo para quien configura el comercio (dueño o
 * administrador); el comercio sale de la sesión, nunca del pedido.
 */
export const GET = withTenantAuth({ permission: 'settings.manage' }, async (_request, { organization }) => {
  try {
    const progress = await loadOnboardingProgress(createAdminSupabase(), organization.id)
    return NextResponse.json({ success: true, data: progress })
  } catch (error) {
    logger.error('No se pudieron leer los primeros pasos', { error: error instanceof Error ? error.message : String(error), organizationId: organization.id })
    return NextResponse.json({ success: false, error: 'No se pudieron cargar los primeros pasos.' }, { status: 500 })
  }
})
