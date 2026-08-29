import type { OrganizationModule } from '@/lib/organization/business-profile'

export function isNavigationModuleAvailable(
  requiredModule: OrganizationModule | undefined,
  effectiveModules: readonly string[],
) {
  return !requiredModule || effectiveModules.includes(requiredModule)
}
