import type { OrganizationModule } from '@/lib/organization/business-profile'

export type DashboardSearchType = 'productos' | 'clientes' | 'reparaciones' | 'todos'

export function isNavigationModuleAvailable(
  requiredModule: OrganizationModule | undefined,
  effectiveModules: readonly string[],
) {
  return !requiredModule || effectiveModules.includes(requiredModule)
}

export function getAvailableDashboardSearchTypes(
  effectiveModules: readonly string[],
): DashboardSearchType[] {
  return [
    'todos',
    ...(effectiveModules.includes('inventory') ? ['productos' as const] : []),
    'clientes',
    ...(effectiveModules.includes('repairs') ? ['reparaciones' as const] : []),
  ]
}

export function filterDashboardSearchResultsByModules<
  T extends { href: string },
>(results: readonly T[], effectiveModules: readonly string[]): T[] {
  const hasRepairs = effectiveModules.includes('repairs')

  return results.filter((result) => {
    if (!hasRepairs && (
      result.href.startsWith('/dashboard/repairs')
      || result.href.startsWith('/dashboard/technician')
    )) return false

    return true
  })
}
