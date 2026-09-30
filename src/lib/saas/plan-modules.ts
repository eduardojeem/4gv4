import { commercialFeatureKeyForLabel } from './commercial-plan-features'

type PlanFeature = { label?: string; value?: boolean | string }

/**
 * Feature de la matriz de planes → módulo que habilita.
 *
 * Antes solo 8 de los 17 features estaban conectados: tildar "Ecommerce",
 * "Analytics" o "Reparaciones" cambiaba lo que se publicitaba pero no lo que
 * la tienda recibía (Gratis mostraba Ecommerce ✓ sin tenerlo).
 */
const MODULE_BY_FEATURE_KEY: Record<string, string> = {
  pos: 'pos',
  inventory: 'inventory',
  inventoryAdmin: 'inventory_admin',
  repairs: 'repairs',
  services: 'services',
  orders: 'orders',
  delivery: 'delivery',
  crm: 'crm',
  ecommerce: 'ecommerce',
  analytics: 'analytics',
  credits: 'credits',
  promotions: 'promotions',
  security: 'security',
}

/**
 * Features que se muestran en la venta pero no habilitan un módulo: usuarios y
 * sucursales dependen de los límites, exportar reportes de que el plan sea pago
 * y el soporte es un servicio.
 */
export const INFORMATIVE_FEATURE_KEYS = ['users', 'branches', 'reports', 'support'] as const

export function moduleForFeatureLabel(label: string): string | null {
  const key = commercialFeatureKeyForLabel(label)
  return key ? MODULE_BY_FEATURE_KEY[key] ?? null : null
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
