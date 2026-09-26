// Mapeos puros de features por plan. Sin 'use client' ni imports de server/admin,
// para poder usarse tanto en componentes cliente como en rutas API.

export type PlanCode = 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE'

export interface ModuleTrial {
  module: string
  expiresAt: string
  daysLeft: number
}

export const MODULE_TRIAL_DAYS = 7

export const REPAIR_PHOTOS_TARGET_PLAN: PlanCode = 'ENTERPRISE'
export const REPAIR_PHOTOS_TARGET_PLAN_LABEL = 'Plan Enterprise'

/** Límite de fotos por reparación según el plan. Exclusivo para el Plan Enterprise. */
export function repairPhotoLimit(planCode: PlanCode): number {
  return planCode === 'ENTERPRISE' ? 6 : 0
}

/** ¿Puede agregar fotos a las reparaciones? Solo disponible en el plan más alto (ENTERPRISE). */
export function canUploadRepairPhotos(planCode: PlanCode): boolean {
  return planCode === 'ENTERPRISE'
}

/** ¿Puede exportar/descargar reportes? Disponible desde Basic (FREE no). */
export function canExportReports(planCode: PlanCode): boolean {
  return planCode !== 'FREE'
}
