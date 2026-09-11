import type { OrganizationModule } from '@/lib/organization/business-profile'
import { getOrganizationPlanInfo } from '@/lib/saas/subscription-service'

/**
 * Si una organizacion tiene un modulo utilizable, para decidirlo en el servidor.
 *
 * La tienda publica no miraba los modulos: «Mis reparaciones» dependia solo de
 * la configuracion del sitio web, y `/mis-reparaciones` ni siquiera eso, asi
 * que una organizacion sin taller seguia ofreciendo seguimiento de reparaciones
 * y respondiendo en esa URL.
 *
 * Usa `getOrganizationPlanInfo`, la misma fuente que arma los modulos del
 * dashboard. Si la consulta falla no se oculta nada: esconder una seccion por
 * un error de lectura romperia la tienda por una razon que no tiene que ver con
 * el plan.
 */
export async function isOrganizationModuleEnabled(
  organizationId: string,
  module: OrganizationModule
): Promise<boolean> {
  try {
    const info = await getOrganizationPlanInfo(organizationId)
    return info.effectiveModules.includes(module)
  } catch (error) {
    console.error('[organization-modules] No se pudieron resolver los modulos', { organizationId, module, error })
    return true
  }
}
