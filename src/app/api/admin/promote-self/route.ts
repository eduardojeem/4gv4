import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

/**
 * POST /api/admin/promote-self
 * 
 * Permite que un usuario se promueva a admin SOLO si:
 * 1. No existen otros administradores en el sistema (primer setup)
 * 2. O si está en modo de desarrollo (con variable de entorno)
 * 
 * SEGURIDAD: Este endpoint está diseñado para el setup inicial del sistema.
 * Una vez que existe un admin, solo ese admin puede crear otros admins.
 */
export async function POST() {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = createAdminSupabase()

    // SEGURIDAD: Verificar si ya existen administradores
    const { count: adminCount, error: countError } = await admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .in('role', ['admin', 'super_admin'])

    if (countError) {
      logger.error('Failed to count admins', { error: countError })
      return NextResponse.json({ error: 'Failed to verify admin status' }, { status: 500 })
    }

    // Si ya existen admins y no estamos en modo dev, denegar
    const isDevelopment = process.env.NODE_ENV === 'development'
    const allowSelfPromotion = process.env.ALLOW_SELF_PROMOTION === 'true'
    
    if (adminCount && adminCount > 0 && !isDevelopment && !allowSelfPromotion) {
      logger.warn('Unauthorized self-promotion attempt', {
        userId: user.id,
        email: user.email,
        existingAdmins: adminCount
      })

      // Registrar intento de escalación de privilegios
      await admin.from('audit_log').insert({
        user_id: user.id,
        action: 'unauthorized_self_promotion_attempt',
        resource: 'auth',
        resource_id: user.id,
        new_values: { 
          attempted_role: 'admin',
          existing_admins: adminCount,
          blocked: true
        }
      })

      return NextResponse.json(
        { 
          error: 'Forbidden', 
          message: 'Administrators already exist. Contact an existing admin for privileges.' 
        },
        { status: 403 }
      )
    }

    // Permitir promoción (primer admin o modo dev)
    logger.info('Self-promotion to admin', {
      userId: user.id,
      email: user.email,
      isFirstAdmin: adminCount === 0,
      isDevelopment
    })

    const { error: profileError } = await admin
      .from('profiles')
      .upsert({
        id: user.id,
        role: 'admin',
        full_name: user.user_metadata?.full_name ?? null,
        updated_at: new Date().toISOString()
      })
    
    if (profileError) {
      logger.error('Failed to update profile', { error: profileError })
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    const { error: roleError } = await admin
      .from('user_roles')
      .upsert({
        user_id: user.id,
        role: 'admin',
        is_active: true,
        updated_at: new Date().toISOString()
      })
    
    if (roleError) {
      logger.error('Failed to update user role', { error: roleError })
      return NextResponse.json({ error: roleError.message }, { status: 500 })
    }

    // Registrar promoción exitosa
    await admin.from('audit_log').insert({
      user_id: user.id,
      action: 'grant_admin_self',
      resource: 'auth',
      resource_id: user.id,
      new_values: { 
        role_ui: 'admin', 
        role_db: 'admin',
        is_first_admin: adminCount === 0,
        is_development: isDevelopment
      }
    })

    return NextResponse.json({ 
      success: true,
      message: adminCount === 0 
        ? 'Successfully promoted to admin (first administrator)' 
        : 'Successfully promoted to admin (development mode)'
    })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    logger.error('Self-promotion error', { error: errorMessage })
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

