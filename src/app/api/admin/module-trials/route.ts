import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getAuthResponse, requireStaff, type AuthResult } from '@/lib/auth/require-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { getOrganizationPlanInfo } from '@/lib/saas/subscription-service'
import { MODULE_TRIAL_DAYS } from '@/lib/saas/plan-features'

const TRIALABLE_MODULES = new Set([
  'inventory', 'inventory_admin', 'pos', 'repairs', 'crm', 'ecommerce', 'delivery', 'analytics', 'promotions', 'security', 'credits',
])

// POST — Inicia una prueba de 7 días de un módulo que el plan no incluye.
export async function POST(request: NextRequest) {
  const auth = await requireStaff()
  const authResponse = getAuthResponse(auth)
  if (authResponse) return authResponse
  const { user } = auth as Extract<AuthResult, { authenticated: true }>

  const organization = await getCurrentOrganizationContext(user.id)
  if (!organization) {
    return NextResponse.json({ error: 'Organización no encontrada.' }, { status: 400 })
  }

  // Solo owner/admin pueden activar pruebas.
  if (!['owner', 'admin'].includes(organization.role)) {
    return NextResponse.json({ error: 'Solo el propietario o un admin puede activar pruebas.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null) as { module?: unknown } | null
  const moduleKey = typeof body?.module === 'string' ? body.module.trim().toLowerCase() : ''

  if (!TRIALABLE_MODULES.has(moduleKey)) {
    return NextResponse.json({ error: 'Módulo inválido.' }, { status: 400 })
  }

  // Si ya tiene acceso (por plan o por un trial activo), no tiene sentido iniciar otro.
  const planInfo = await getOrganizationPlanInfo(organization.id)
  if (planInfo.modules.includes(moduleKey)) {
    return NextResponse.json({ error: 'Ya tenés acceso a este módulo.' }, { status: 409 })
  }
  if (planInfo.trialedModules.includes(moduleKey)) {
    return NextResponse.json({ error: 'Ya usaste la prueba gratis de este módulo.' }, { status: 409 })
  }

  const admin = createAdminSupabase()
  const expiresAt = new Date(Date.now() + MODULE_TRIAL_DAYS * 86400000).toISOString()

  const { error } = await admin.from('organization_module_trials').insert({
    organization_id: organization.id,
    module: moduleKey,
    expires_at: expiresAt,
    created_by: user.id,
  })

  if (error) {
    // Violación de unique = ya fue probado.
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Ya usaste la prueba gratis de este módulo.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, module: moduleKey, expiresAt, daysLeft: MODULE_TRIAL_DAYS }, { status: 201 })
}
