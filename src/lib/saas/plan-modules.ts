type PlanFeature = { label?: string; value?: boolean | string }

const featureModuleByLabel: Record<string, string> = {
  'créditos y cuotas': 'credits',
  'creditos y cuotas': 'credits',
  'promociones y descuentos': 'promotions',
  'seguridad y auditoría': 'security',
  'seguridad y auditoria': 'security',
}

const defaultsByTier: Record<string, string[]> = {
  FREE: ['inventory', 'pos', 'crm', 'repairs'],
  BASIC: ['inventory', 'pos', 'crm', 'ecommerce', 'repairs'],
  PRO: ['inventory', 'pos', 'repairs', 'crm', 'ecommerce', 'analytics', 'promotions', 'security'],
  ENTERPRISE: ['inventory', 'pos', 'repairs', 'crm', 'ecommerce', 'delivery', 'analytics', 'promotions', 'security'],
}

export function deriveTechnicalModules(tier: string, features: unknown) {
  const code = tier.toUpperCase()
  const modules = new Set(defaultsByTier[code] ?? defaultsByTier.FREE)

  if (!Array.isArray(features)) return Array.from(modules)

  for (const feature of features as PlanFeature[]) {
    if (!feature?.label) continue
    const moduleCode = featureModuleByLabel[feature.label.trim().toLowerCase()]
    if (!moduleCode) continue
    if (feature.value === true) modules.add(moduleCode)
    if (feature.value === false) modules.delete(moduleCode)
  }

  return Array.from(modules)
}
