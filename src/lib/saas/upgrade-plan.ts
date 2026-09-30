import type { ModulePlanAvailability, OrganizationModule } from '@/lib/organization/business-profile'

/**
 * Nombre del plan al que hay que subir para tener un módulo: el primer plan
 * activo que lo incluye. `modulePlanAvailability` viene ordenado del plan más
 * barato al más caro, así que el primero es el mínimo necesario.
 *
 * Se lee del catálogo en vez de escribirse en cada pantalla: los textos fijos
 * ("disponible desde el plan Basic", "Plan Enterprise") quedaban apuntando a
 * planes que no existían con ese nombre o que no se podían comprar.
 */
export function upgradePlanNameFor(
  module: string,
  availability: Partial<Record<OrganizationModule, ModulePlanAvailability[]>> | undefined,
): string | null {
  const plans = availability?.[module as OrganizationModule] ?? []
  return plans.find((plan) => plan.isActive)?.name ?? null
}
