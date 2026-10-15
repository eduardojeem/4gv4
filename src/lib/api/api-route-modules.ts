import { NextResponse } from 'next/server'
import { getOrganizationPlanInfo } from '@/lib/saas/subscription-service'
import type { OrganizationModule } from '@/lib/organization/business-profile'

/**
 * Qué módulo necesita cada API del admin, por prefijo de la URL.
 *
 * Las API del admin (withAdminAuth) no revisaban módulos: Finanzas (17 rutas),
 * Monitor de caja y Seguridad respondían y guardaban aunque la tienda hubiera
 * apagado el módulo o el plan no lo incluyera. withAdminAuth lo aplica solo
 * mirando la URL, así una ruta nueva bajo estos prefijos no puede olvidarlo.
 * Las del dashboard (withTenantAuth) lo declaran en cada ruta.
 */
export const ADMIN_API_MODULES: Record<string, OrganizationModule> = {
  '/api/admin/finances': 'finances',
  '/api/admin/cash-monitor': 'pos',
  '/api/admin/analytics/website': 'web_analytics',
  '/api/admin/security': 'security',
}

export function moduleForAdminApi(pathname: string): OrganizationModule | null {
  let best: string | null = null
  for (const prefix of Object.keys(ADMIN_API_MODULES)) {
    if ((pathname === prefix || pathname.startsWith(`${prefix}/`)) && (!best || prefix.length > best.length)) best = prefix
  }
  return best ? ADMIN_API_MODULES[best] : null
}

/**
 * La respuesta cuando la organización no puede usar el módulo; null si puede.
 * Mismos códigos que withTenantAuth: 403 si la tienda lo apagó (el plan lo
 * incluye), 402 si el plan no lo incluye.
 */
export async function moduleAccessResponse(organizationId: string, module: OrganizationModule | readonly OrganizationModule[]): Promise<NextResponse | null> {
  const anyOf: readonly OrganizationModule[] = typeof module === 'string' ? [module] : module
  const planInfo = await getOrganizationPlanInfo(organizationId)
  if (anyOf.some((candidate) => planInfo.modules.includes(candidate))) return null

  const commerciallyAvailable = anyOf.some((candidate) => planInfo.entitledModules.includes(candidate)
    || planInfo.moduleTrials.some((trial) => trial.module === candidate))
  return NextResponse.json(
    commerciallyAvailable
      ? { error: 'Module disabled', code: 'MODULE_DISABLED', message: 'This module is disabled for the current organization.' }
      : { error: 'Module unavailable', code: 'MODULE_NOT_ENTITLED', message: 'This module is not enabled for the current plan.' },
    { status: commerciallyAvailable ? 403 : 402 },
  )
}
