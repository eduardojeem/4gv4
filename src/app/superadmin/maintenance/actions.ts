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
  purgeImageTrash,
  restoreTrashedImages,
  scanProductImageOrphans,
  trashProductImageOrphans,
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

function validPaths(paths: unknown): string[] | string {
  if (!Array.isArray(paths) || paths.length === 0) return 'No hay archivos seleccionados'
  const clean = paths.filter((p): p is string => typeof p === 'string')
  return clean.length > 500 ? 'Máximo 500 archivos por operación' : clean
}

/** Nada se borra: las imágenes sin uso van a la papelera y se pueden restaurar. */
export async function trashOrphanImagesAction(paths: string[]): Promise<ActionResult<{ moved: number; skipped: number }>> {
  const user = await getSuperAdminUser()
  if (!user) return { ok: false, error: 'Acceso denegado' }
  const clean = validPaths(paths)
  if (typeof clean === 'string') return { ok: false, error: clean }
  try {
    const { moved, skipped } = await trashProductImageOrphans(clean)
    await logSuperAdminAction({
      actorId: user.id,
      actorEmail: user.email,
      action: MAINTENANCE_ACTIONS.trashOrphanImages,
      resource: 'storage.product-images',
      newValues: { moved_count: moved.length, skipped_count: skipped, sample: moved.slice(0, 20) },
      severity: 'medium',
    })
    revalidatePath('/superadmin/maintenance')
    return { ok: true, data: { moved: moved.length, skipped } }
  } catch (error) {
    return { ok: false, error: message(error) }
  }
}

export async function restoreTrashedImagesAction(paths: string[]): Promise<ActionResult<{ restored: number; failed: number }>> {
  const user = await getSuperAdminUser()
  if (!user) return { ok: false, error: 'Acceso denegado' }
  const clean = validPaths(paths)
  if (typeof clean === 'string') return { ok: false, error: clean }
  try {
    const { restored, failed } = await restoreTrashedImages(clean)
    await logSuperAdminAction({
      actorId: user.id,
      actorEmail: user.email,
      action: MAINTENANCE_ACTIONS.restoreImages,
      resource: 'storage.product-images',
      newValues: { restored_count: restored.length, skipped_count: failed.length, sample: restored.slice(0, 20) },
      severity: 'low',
    })
    revalidatePath('/superadmin/maintenance')
    return { ok: true, data: { restored: restored.length, failed: failed.length } }
  } catch (error) {
    return { ok: false, error: message(error) }
  }
}

/** Palabra que hay que escribir para borrar definitivamente de la papelera. */
const PURGE_CONFIRMATION = 'BORRAR'

export async function purgeImageTrashAction(paths: string[], confirmation: string): Promise<ActionResult<{ deleted: number; skipped: number }>> {
  const user = await getSuperAdminUser()
  if (!user) return { ok: false, error: 'Acceso denegado' }
  if (confirmation.trim().toUpperCase() !== PURGE_CONFIRMATION) {
    return { ok: false, error: `Escribí ${PURGE_CONFIRMATION} para confirmar` }
  }
  const clean = validPaths(paths)
  if (typeof clean === 'string') return { ok: false, error: clean }
  try {
    const { deleted, skipped } = await purgeImageTrash(clean)
    await logSuperAdminAction({
      actorId: user.id,
      actorEmail: user.email,
      action: MAINTENANCE_ACTIONS.purgeImageTrash,
      resource: 'storage.product-images',
      newValues: { deleted_count: deleted.length, skipped_count: skipped, sample: deleted.slice(0, 20) },
      severity: 'high',
    })
    revalidatePath('/superadmin/maintenance')
    return { ok: true, data: { deleted: deleted.length, skipped } }
  } catch (error) {
    return { ok: false, error: message(error) }
  }
}
