// Mapeos puros de features por plan. Sin 'use client' ni imports de server/admin,
// para poder usarse tanto en componentes cliente como en rutas API.

export type PlanCode = 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE'

export interface ModuleTrial {
  module: string
  expiresAt: string
  daysLeft: number
}

export const MODULE_TRIAL_DAYS = 7

/** Límite de fotos por reparación según el plan. null = ilimitado, 0 = sin fotos. */
export function repairPhotoLimit(planCode: PlanCode): number | null {
  switch (planCode) {
    case 'FREE': return 0
    case 'BASIC': return 3
    default: return null // PRO / ENTERPRISE: ilimitado
  }
}

/** ¿Puede exportar/descargar reportes? Disponible desde Basic (FREE no). */
export function canExportReports(planCode: PlanCode): boolean {
  return planCode !== 'FREE'
}
