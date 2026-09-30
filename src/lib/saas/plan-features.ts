// Mapeos puros de features por plan. Sin 'use client' ni imports de server/admin,
// para poder usarse tanto en componentes cliente como en rutas API.

export type PlanCode = 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE'

export interface ModuleTrial {
  module: string
  expiresAt: string
  daysLeft: number
}

export const MODULE_TRIAL_DAYS = 7

/**
 * Fotos por reparación que permite un plan, desde `plans.limits.repairPhotos`.
 *
 * Antes estaba fijo en código: solo ENTERPRISE, un plan inactivo, así que
 * nadie podía comprarlo. Si el catálogo todavía no tiene el dato se mantiene
 * esa regla, para no habilitar fotos por un plan mal cargado.
 */
export function repairPhotoLimitFromLimits(planCode: PlanCode, limits: unknown): number {
  const value = limits && typeof limits === 'object' ? (limits as Record<string, unknown>).repairPhotos : undefined
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  if (Number.isFinite(parsed) && parsed >= 0) return Math.floor(parsed)
  return planCode === 'ENTERPRISE' ? 6 : 0
}

/**
 * ¿Puede exportar/descargar reportes? Lo decide el módulo `reports` del plan
 * («Reportes exportables» en el editor), no el código: antes era «todo menos
 * FREE» y tildarlo o destildarlo en el panel no cambiaba nada.
 */
export function canExportReports(modules: readonly string[]): boolean {
  return modules.includes('reports')
}
