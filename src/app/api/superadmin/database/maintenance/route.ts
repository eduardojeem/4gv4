import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { withSuperAdminAuth } from '@/lib/api/withAdminAuth'

const ALLOWED_RETENTION_DAYS = new Set([30, 60, 90, 180])

async function handler(request: NextRequest) {
  try {
    const { task, params } = await request.json()
    const executedAt = new Date().toISOString()

    if (!task) {
      return NextResponse.json({ error: 'Missing task' }, { status: 400 })
    }

    const supabaseAdmin = createAdminSupabase()

    if (task === 'rotate_audit_logs') {
      const requestedDays = Number(params?.days ?? 90)
      const days = Number.isFinite(requestedDays) ? requestedDays : 90

      if (!ALLOWED_RETENTION_DAYS.has(days)) {
        return NextResponse.json(
          { error: 'La retencion debe ser 30, 60, 90 o 180 dias' },
          { status: 400 }
        )
      }

      try {
        const { error } = await supabaseAdmin.rpc('rotate_audit_logs', { days_to_keep: days })
        if (!error) {
          return NextResponse.json({
            success: true,
            message: `Se ha ejecutado la rotacion de logs (conservando ${days} dias)`,
            task: 'rotate_logs',
            executedAt,
            retentionDays: days,
          })
        }

        console.warn('Error ejecutando RPC rotate_audit_logs, intentando borrado manual:', error)
      } catch (rpcError) {
        console.warn('Excepcion ejecutando RPC rotate_audit_logs:', rpcError)
      }

      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)
      const cutoffIso = cutoffDate.toISOString()

      const { error, count } = await supabaseAdmin
        .from('audit_log')
        .delete({ count: 'exact' })
        .lt('created_at', cutoffIso)

      if (error) throw error

      return NextResponse.json({
        success: true,
        message: `Se han eliminado ${count || 0} registros antiguos de audit_log (anteriores a ${days} dias)`,
        task: 'rotate_logs',
        executedAt,
        retentionDays: days,
        deletedCount: count || 0,
      })
    }

    if (task === 'reset_stats') {
      const { error } = await supabaseAdmin.rpc('perform_maintenance_task', { task_name: 'reset_stats' })
      if (error) throw error

      return NextResponse.json({
        success: true,
        message: 'Estadisticas de base de datos reseteadas correctamente',
        task: 'reset_stats',
        executedAt,
      })
    }

    return NextResponse.json({ error: 'Task not supported' }, { status: 400 })
  } catch (error: unknown) {
    console.error('Error in superadmin database maintenance API:', error)
    const nestedErrorMessage = (
      typeof error === 'object' &&
      error !== null &&
      'error' in error &&
      typeof (error as { error?: { message?: string } }).error?.message === 'string'
    )
      ? (error as { error: { message: string } }).error.message
      : null
    const errorMessage = error instanceof Error
      ? error.message
      : nestedErrorMessage || (typeof error === 'string' ? error : 'Internal server error')
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export const POST = withSuperAdminAuth(handler)
