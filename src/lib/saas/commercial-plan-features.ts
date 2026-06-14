export type CommercialPlanFeature = {
  label?: string
  value?: boolean | string
}

const aliasesByKey: Record<string, string[]> = {
  pos: ['Punto de Venta (POS)'],
  inventory: ['Inventario'],
  users: ['Gestión de usuarios', 'Usuarios'],
  branches: ['Sucursales múltiples', 'Sucursales'],
  repairs: ['Módulo de Reparaciones', 'Reparaciones'],
  crm: ['CRM / Gestión de clientes', 'CRM / Clientes', 'Gestión de clientes'],
  ecommerce: ['Ecommerce & Marketplace', 'Ecommerce / Marketplace'],
  analytics: ['Analytics avanzado'],
  reports: ['Reportes exportables (CSV/PDF)', 'Reportes exportables'],
  credits: ['Créditos y cuotas', 'Creditos y cuotas', 'Créditos'],
  promotions: ['Promociones y descuentos'],
  security: ['Seguridad y auditoría', 'Seguridad y auditoria'],
  support: ['Soporte prioritario', 'Soporte'],
}

function normalized(value: string) {
  return value.trim().toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function getCommercialFeatureValue(features: CommercialPlanFeature[] | null | undefined, keyOrLabel: string) {
  const normalizedInput = normalized(keyOrLabel)
  const aliases = aliasesByKey[keyOrLabel]
    ?? Object.values(aliasesByKey).find(group => group.some(alias => normalized(alias) === normalizedInput))
    ?? [keyOrLabel]
  const normalizedAliases = new Set(aliases.map(normalized))
  return features?.find(feature => feature.label && normalizedAliases.has(normalized(feature.label)))?.value ?? false
}

export function isCommercialFeatureLabel(label: string | undefined, key: string) {
  if (!label) return false
  return (aliasesByKey[key] ?? [key]).some(alias => normalized(alias) === normalized(label))
}
