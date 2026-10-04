import type { OrganizationModule } from '@/lib/organization/business-profile'

export type DashboardSearchType = 'productos' | 'clientes' | 'reparaciones' | 'todos'

/** Con una lista alcanza con cualquiera de los módulos (ej.: Productos sirve al inventario y a los servicios). */
export function isNavigationModuleAvailable(
  requiredModule: OrganizationModule | readonly OrganizationModule[] | undefined,
  effectiveModules: readonly string[],
) {
  if (!requiredModule) return true
  const anyOf: readonly OrganizationModule[] = typeof requiredModule === 'string' ? [requiredModule] : requiredModule
  return anyOf.some((module) => effectiveModules.includes(module))
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
