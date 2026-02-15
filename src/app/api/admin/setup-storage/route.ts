import { NextRequest, NextResponse } from 'next/server'
import { withSuperAdminAuth } from '@/lib/api/withAdminAuth'
import { logger } from '@/lib/logger'

async function handler(request: NextRequest, context: { user: { id: string; email?: string; role: string } }) {
  try {
    logger.info('Storage setup initiated', { userId: context.user.id })

    // Importar dinámicamente para evitar errores si el script no existe
    const { setupStorageBuckets } = await import('../../../../../scripts/setup-storage-buckets')

    // Configurar buckets de storage
    await setupStorageBuckets()

    // Registrar en audit_log
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    
    await supabase.from('audit_log').insert({
      user_id: context.user.id,
      action: 'setup_storage',
      resource: 'storage',
      resource_id: 'buckets',
      new_values: { success: true }
    }).catch(err => {
      logger.error('Failed to log storage setup', { error: err })
    })

    logger.info('Storage setup completed', { userId: context.user.id })

    return NextResponse.json({ 
      success: true, 
      message: 'Storage configurado correctamente' 
    })

  } catch (error: any) {
    logger.error('Error configurando storage', { error: error.message })
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message }, 
      { status: 500 }
    )
  }
}

export const POST = withSuperAdminAuth(handler)