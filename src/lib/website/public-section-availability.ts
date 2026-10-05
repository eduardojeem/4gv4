import { getOrganizationPlanInfo } from '@/lib/saas/subscription-service'
import { hideUnavailableSections } from '@/lib/website/section-availability'
import { resolveStorefrontCapabilities } from '@/lib/website/storefront-capabilities'
import type { WebsiteSettings } from '@/types/website-settings'

/**
 * Ajustes públicos limitados a los módulos que la organización usa hoy. Si no
 * se puede leer el plan se devuelven tal cual: es mejor mostrar lo configurado
 * que vaciar la tienda por un error pasajero.
 */
export async function restrictPublicSettingsToModules(settings: WebsiteSettings, organizationId: string): Promise<WebsiteSettings> {
  const plan = await getOrganizationPlanInfo(organizationId).catch(() => null)
  if (!plan) return settings
  const capabilities = resolveStorefrontCapabilities({
    businessVertical: plan.businessVertical,
    operatingModel: plan.operatingModel,
    effectiveModules: plan.effectiveModules,
  })
  return hideUnavailableSections(settings, capabilities)
}
