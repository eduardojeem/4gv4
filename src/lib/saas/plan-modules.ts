type PlanFeature = { label?: string; value?: boolean | string }

const featureModuleByLabel: Record<string, string> = {
  'creditos y cuotas': 'credits',
  'promociones y descuentos': 'promotions',
  'seguridad y auditoria': 'security',
  'inventario avanzado': 'inventory_admin',
  'inventario avanzado (/admin/inventory)': 'inventory_admin',
  'servicios': 'services',
  'pedidos': 'orders',
  'entregas': 'delivery',
}

const defaultsByTier: Record<string, string[]> = {
  FREE: ['inventory', 'pos', 'crm', 'repairs', 'services'],
  BASIC: ['inventory', 'inventory_admin', 'pos', 'crm', 'ecommerce', 'repairs', 'services', 'orders', 'delivery'],
  PRO: ['inventory', 'inventory_admin', 'pos', 'repairs', 'crm', 'ecommerce', 'services', 'orders', 'delivery', 'analytics', 'promotions', 'security'],
  ENTERPRISE: ['inventory', 'inventory_admin', 'pos', 'repairs', 'crm', 'ecommerce', 'services', 'orders', 'delivery', 'analytics', 'promotions', 'security'],
}

function normalizeLabel(value: string) {
  return value.trim().toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function deriveTechnicalModules(tier: string, features: unknown) {
  const code = tier.toUpperCase()
  const modules = new Set(defaultsByTier[code] ?? defaultsByTier.FREE)

  if (!Array.isArray(features)) return Array.from(modules)

  for (const feature of features as PlanFeature[]) {
    if (!feature?.label) continue
    const moduleCode = featureModuleByLabel[normalizeLabel(feature.label)]
    if (!moduleCode) continue
    if (feature.value === true) modules.add(moduleCode)
    if (feature.value === false) modules.delete(moduleCode)
  }

  return Array.from(modules)
}
