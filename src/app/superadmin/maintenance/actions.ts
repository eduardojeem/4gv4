'use server'

import { revalidatePath } from 'next/cache'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import {
  MAINTENANCE_ACTIONS,
  isAuditRetentionDays,
  resetDatabaseStats,
  rotateAuditLog,
} from '@/lib/superadmin/maintenance'
import {
  deleteProductImageOrphans,
  scanProductImageOrphans,
  type StorageScanResult,
} from '@/lib/superadmin/storage-cleanup'

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string }

/** Palabra que hay que escribir para confirmar una rotación de auditoría. */
const ROTATE_CONFIRMATION = 'ROTAR'

function message(error: unknown) {
  return error instanceof Error ? error.message : 'Error inesperado'
}

export async function rotateAuditLogAction(days: number, confirmation: string): Promise<ActionResult<{ deletedCount: number }>> {
  const user = await getSuperAdminUser()
  if (!user) return { ok: false, error: 'Acceso denegado' }
  if (!isAuditRetentionDays(days)) return { ok: false, error: 'La retención mínima es de 90 días' }
  if (confirmation.trim().toUpperCase() !== ROTATE_CONFIRMATION) {
    return { ok: false, error: `Escribí ${ROTATE_CONFIRMATION} para confirmar` }
  }
  try {
    const result = await rotateAuditLog(days, { id: user.id, email: user.email })
    revalidatePath('/superadmin/maintenance')
    return { ok: true, data: result }
  } catch (error) {
    return { ok: false, error: message(error) }
  }
}

export async function resetDatabaseStatsAction(): Promise<ActionResult> {
  const user = await getSuperAdminUser()
  if (!user) return { ok: false, error: 'Acceso denegado' }
  try {
    await resetDatabaseStats({ id: user.id, email: user.email })
    revalidatePath('/superadmin/maintenance')
    return { ok: true, data: undefined }
  } catch (error) {
    return { ok: false, error: message(error) }
  }
}

export async function scanStorageAction(): Promise<ActionResult<StorageScanResult>> {
  const user = await getSuperAdminUser()
  if (!user) return { ok: false, error: 'Acceso denegado' }
  try {
    return { ok: true, data: await scanProductImageOrphans() }
  } catch (error) {
    return { ok: false, error: message(error) }
  }
}

export async function deleteOrphanImagesAction(paths: string[]): Promise<ActionResult<{ deleted: number; skipped: number }>> {
  const user = await getSuperAdminUser()
  if (!user) return { ok: false, error: 'Acceso denegado' }
  if (!Array.isArray(paths) || paths.length === 0) return { ok: false, error: 'No hay archivos seleccionados' }
  if (paths.length > 1000) return { ok: false, error: 'Máximo 1000 archivos por operación' }
  try {
    const { deleted, skipped } = await deleteProductImageOrphans(paths.filter((p) => typeof p === 'string'))
    await logSuperAdminAction({
      actorId: user.id,
      actorEmail: user.email,
      action: MAINTENANCE_ACTIONS.deleteOrphanImages,
      resource: 'storage.product-images',
      newValues: { deleted_count: deleted.length, skipped_count: skipped, sample: deleted.slice(0, 20) },
      severity: 'medium',
    })
    revalidatePath('/superadmin/maintenance')
    return { ok: true, data: { deleted: deleted.length, skipped } }
  } catch (error) {
    return { ok: false, error: message(error) }
  }
}
