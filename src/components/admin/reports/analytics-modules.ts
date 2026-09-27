/**
 * Qué partes de Analytics le corresponden a cada empresa.
 *
 * Sale de los módulos activos (`effectiveModules`): lo que incluye el plan y
 * la empresa eligió en Configuración según su rubro y forma de trabajo. Una
 * tienda de ropa sin taller no tiene por qué ver «Reparaciones: ₲ 0» en cada
 * gráfico ni en el PDF.
 */

export interface AnalyticsModuleFlags {
  repairs: boolean
  inventory: boolean
  crm: boolean
}

export type AnalyticsModuleKey = keyof AnalyticsModuleFlags

/**
 * Mientras la suscripción no cargó (`status` null) se muestra todo: esconder
 * una pestaña y hacerla aparecer un instante después se lee como un error.
 */
export function resolveAnalyticsModules(
  status: string | null,
  effectiveModules: readonly string[],
): AnalyticsModuleFlags {
  if (status === null) return { repairs: true, inventory: true, crm: true }
  return {
    repairs: effectiveModules.includes('repairs'),
    inventory: effectiveModules.includes('inventory'),
    crm: effectiveModules.includes('crm'),
  }
}

/** Avisos de «Lo que tenés que mirar» que dependen de un módulo. */
const INSIGHT_MODULE: Record<string, AnalyticsModuleKey> = {
  'inventory-risk': 'inventory',
  'repair-backlog': 'repairs',
  'repeat-customers': 'crm',
}

export function filterInsightsByModules<T extends { id: string }>(insights: T[], flags: AnalyticsModuleFlags): T[] {
  return insights.filter((insight) => {
    const required = INSIGHT_MODULE[insight.id]
    return !required || flags[required]
  })
}

/**
 * Tarjetas que hablan del taller. Sin reparaciones, «Facturación total (POS +
 * taller)» se reemplaza por «Facturado en POS», que es la misma cifra que
 * muestra Reportes.
 */
const REPAIR_CARD_IDS = ['gross', 'repairs']

export function isHeadlineCardVisible(id: string, flags: AnalyticsModuleFlags): boolean {
  return flags.repairs || !REPAIR_CARD_IDS.includes(id)
}

/** Primera tarjeta de facturación: con taller, el total; sin taller, solo POS. */
export function revenueCardId(flags: AnalyticsModuleFlags): 'gross' | 'pos-revenue' {
  return flags.repairs ? 'gross' : 'pos-revenue'
}

/** «Ventas, dinero, inventario, clientes y taller», según lo que tenga la empresa. */
export function describeAnalyticsSections(flags: AnalyticsModuleFlags): string {
  const parts = [
    'Ventas',
    'dinero',
    flags.inventory ? 'inventario' : null,
    flags.crm ? 'clientes' : null,
    flags.repairs ? 'taller' : null,
  ].filter((part): part is string => Boolean(part))
  if (parts.length === 1) return parts[0]
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`
}
