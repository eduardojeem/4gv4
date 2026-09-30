import { commercialFeatureKeyForLabel, getCommercialFeatureValue } from './commercial-plan-features'
import { PLAN_FEATURES, planFeatureByKey } from './plan-feature-catalog'

type PlanFeature = { label?: string; value?: boolean | string }

/**
 * Features que se muestran en la venta pero no habilitan un módulo: usuarios y
 * sucursales dependen de los límites, exportar reportes de que el plan sea pago
 * y el soporte es un servicio.
 */
export const INFORMATIVE_FEATURE_KEYS = PLAN_FEATURES.filter((feature) => feature.module === null).map((feature) => feature.key)

/**
 * Feature de la matriz de planes → módulo que habilita, según el catálogo.
 *
 * Antes solo 8 de los 17 features estaban conectados: tildar "Ecommerce",
 * "Analytics" o "Reparaciones" cambiaba lo que se publicitaba pero no lo que
 * la tienda recibía (Gratis mostraba Ecommerce ✓ sin tenerlo).
 */
export function moduleForFeatureLabel(label: string): string | null {
  const key = commercialFeatureKeyForLabel(label)
  return key ? planFeatureByKey(key)?.module ?? null : null
}

const defaultsByTier: Record<string, string[]> = {
  FREE: ['inventory', 'pos', 'crm', 'repairs', 'services'],
  BASIC: ['inventory', 'inventory_admin', 'pos', 'crm', 'ecommerce', 'repairs', 'services', 'orders', 'delivery'],
  PRO: ['inventory', 'inventory_admin', 'pos', 'repairs', 'crm', 'ecommerce', 'services', 'orders', 'delivery', 'analytics', 'promotions', 'security'],
  ENTERPRISE: ['inventory', 'inventory_admin', 'pos', 'repairs', 'crm', 'ecommerce', 'services', 'orders', 'delivery', 'analytics', 'promotions', 'security'],
}

export function deriveTechnicalModules(tier: string, features: unknown) {
  const code = tier.toUpperCase()
  const modules = new Set(defaultsByTier[code] ?? defaultsByTier.FREE)

  if (!Array.isArray(features)) return Array.from(modules)

  for (const feature of features as PlanFeature[]) {
    if (!feature?.label) continue
    const moduleCode = moduleForFeatureLabel(feature.label)
    if (!moduleCode) continue
    if (feature.value === true) modules.add(moduleCode)
    if (feature.value === false) modules.delete(moduleCode)
  }

  // El inventario avanzado se apoya en el básico: no puede quedar uno sin el otro.
  if (modules.has('inventory_admin')) modules.add('inventory')

  return Array.from(modules)
}

/**
 * Cada feature del catálogo → si el plan lo incluye de verdad. Los de módulo
 * salen de los módulos que reciben las tiendas (incluidos los que el plan trae
 * por defecto sin estar en la lista); los informativos, de la lista comercial.
 * Todas las pantallas de planes muestran esto para no contradecirse.
 */
export function effectivePlanFeatures(tier: string, features: PlanFeature[] | null | undefined): Record<string, boolean> {
  const modules = new Set(deriveTechnicalModules(tier, features ?? []))
  return Object.fromEntries(
    PLAN_FEATURES.map((feature) => [
      feature.key,
      feature.module ? modules.has(feature.module) : Boolean(getCommercialFeatureValue(features, feature.key)),
    ]),
  )
}
