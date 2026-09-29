import { NextRequest, NextResponse } from 'next/server'
import { withSuperAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import {
  AUDIT_RETENTION_OPTIONS,
  isAuditRetentionDays,
  resetDatabaseStats,
  rotateAuditLog,
} from '@/lib/superadmin/maintenance'

/**
 * Tareas de mantenimiento usadas por /superadmin/database-monitoring.
 * La lógica (retención mínima de 90 días, registro en auditoría) vive en
 * src/lib/superadmin/maintenance.ts y es la misma que usa /superadmin/maintenance.
 */
async function handler(request: NextRequest, context: AdminAuthContext) {
  const body = await request.json().catch(() => null) as { task?: string; params?: { days?: unknown } } | null
  const task = body?.task
  const executedAt = new Date().toISOString()
  const actor = { id: context.user.id, email: context.user.email ?? null }

  try {
    if (task === 'rotate_audit_logs' || task === 'rotate_logs') {
      const days = Number(body?.params?.days ?? 90)
      if (!isAuditRetentionDays(days)) {
        return NextResponse.json(
          { error: `La retención debe ser de ${AUDIT_RETENTION_OPTIONS.join(', ')} días` },
          { status: 400 },
        )
      }
      const { deletedCount } = await rotateAuditLog(days, actor, request)
      return NextResponse.json({
        success: true,
        message: `Se eliminaron ${deletedCount} registros de auditoría anteriores a ${days} días`,
        task: 'rotate_logs',
        executedAt,
        retentionDays: days,
        deletedCount,
      })
    }

    if (task === 'reset_stats') {
      await resetDatabaseStats(actor, request)
      return NextResponse.json({
        success: true,
        message: 'Estadísticas de base de datos reiniciadas',
        task: 'reset_stats',
        executedAt,
      })
    }

    return NextResponse.json({ error: 'Tarea no soportada' }, { status: 400 })
  } catch (error) {
    console.error('Error in superadmin database maintenance API:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 },
    )
  }
}

export const POST = withSuperAdminAuth(handler)
