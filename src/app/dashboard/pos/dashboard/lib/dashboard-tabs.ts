import type { OrganizationModule } from '@/lib/organization/business-profile'
import { isNavigationModuleAvailable } from '@/lib/navigation/dashboard-navigation'

/**
 * Las pestañas del dashboard del POS.
 *
 * Eran cuatro botones escritos a mano: «Reparaciones (Taller)» aparecia en
 * organizaciones sin el modulo de taller, y los creditos no tenian pestaña
 * propia —vivian dentro de «Ventas POS»—. Ahora cada pestaña declara el modulo
 * que necesita y se filtra con `isNavigationModuleAvailable`, la misma regla que
 * usa el menu lateral: si el menu no muestra Reparaciones, el dashboard tampoco.
 */
export type PosDashboardViewTab = 'all' | 'sales' | 'credits' | 'repairs' | 'profit'

export interface PosDashboardTabDefinition {
  value: PosDashboardViewTab
  label: string
  requiredModule?: OrganizationModule
}

export const POS_DASHBOARD_TABS: readonly PosDashboardTabDefinition[] = [
  { value: 'all', label: 'Vista General' },
  { value: 'sales', label: 'Ventas POS' },
  { value: 'credits', label: 'Créditos', requiredModule: 'credits' },
  { value: 'repairs', label: 'Reparaciones (Taller)', requiredModule: 'repairs' },
  { value: 'profit', label: 'Ganancias & Márgenes' },
]

export function availablePosDashboardTabs(effectiveModules: readonly string[]): PosDashboardTabDefinition[] {
  return POS_DASHBOARD_TABS.filter((tab) => isNavigationModuleAvailable(tab.requiredModule, effectiveModules))
}

/**
 * Una pestaña que ya no esta disponible —el modulo se deshabilito con la
 * pantalla abierta— no puede quedar seleccionada mostrando un dashboard vacio.
 */
export function resolveActiveTab(
  tab: PosDashboardViewTab,
  available: readonly PosDashboardTabDefinition[]
): PosDashboardViewTab {
  return available.some((item) => item.value === tab) ? tab : 'all'
}

/** Una seccion se ve en su pestaña y en la vista general. */
export function showsSection(section: PosDashboardViewTab, active: PosDashboardViewTab): boolean {
  return active === 'all' || active === section
}
