import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-auth'

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin()
    if (!auth.authenticated) return (auth as any).response

    const { task, params } = await request.json()
    console.log(`Ejecutando tarea de mantenimiento: ${task}`, params)

    if (!task) {
      return NextResponse.json({ error: 'Missing task' }, { status: 400 })
    }

    const supabaseAdmin = createAdminSupabase()

    if (task === 'rotate_audit_logs') {
      const days = params?.days || 90
      
      // Intentar usar la función RPC primero (más eficiente)
      try {
        const { error } = await supabaseAdmin.rpc('rotate_audit_logs', { days_to_keep: days })
        if (!error) {
           return NextResponse.json({
            success: true,
            message: `Se ha ejecutado la rotación de logs (conservando ${days} días)`,
          })
        }
        console.warn('Error ejecutando RPC rotate_audit_logs, intentando borrado manual:', error)
      } catch (e) {
        console.warn('Excepción ejecutando RPC rotate_audit_logs:', e)
      }

      // Fallback a borrado manual si falla el RPC
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)
      const cutoffIso = cutoffDate.toISOString()
      
      console.log(`Rotando audit_log (manual). Borrando registros anteriores a: ${cutoffIso}`)
      
      const { data, error, count } = await supabaseAdmin
        .from('audit_log' as any)
        .delete({ count: 'exact' })
        .lt('created_at', cutoffIso)

      if (error) throw error

      return NextResponse.json({
        success: true,
        message: `Se han eliminado ${count || 0} registros antiguos de audit_log (anteriores a ${days} días)`,
        count
      })
    }

    if (task === 'reset_stats') {
      const { error } = await supabaseAdmin.rpc('perform_maintenance_task', { task_name: 'reset_stats' })
      if (error) throw error
      
      return NextResponse.json({
        success: true,
        message: 'Estadísticas de base de datos reseteadas correctamente'
      })
    }

    return NextResponse.json({ error: 'Task not supported' }, { status: 400 })

  } catch (error: any) {
    console.error('Error in database maintenance API:', error)
    const errorMessage = error.message || (error.error && error.error.message) || (typeof error === 'string' ? error : 'Internal server error')
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
