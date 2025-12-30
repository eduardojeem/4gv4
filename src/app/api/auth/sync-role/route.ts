import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'

export async function POST() {
  try {
    // Obtener usuario autenticado
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    console.log('🔄 Sincronizando rol para usuario:', user.id)

    // Usar cliente admin para operaciones
    const admin = createAdminSupabase()

    // 1. Verificar estado actual en user_roles
    const { data: currentRole, error: roleError } = await admin
      .from('user_roles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    console.log('📋 Rol actual en user_roles:', currentRole, roleError?.message)

    // 2. Verificar estado actual en profiles
    const { data: currentProfile, error: profileError } = await admin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    console.log('👤 Perfil actual en profiles:', currentProfile, profileError?.message)

    // 3. Determinar el rol a asignar (prioridad: user_roles > profiles > metadata > default admin)
    let targetRole = 'admin' // Default para usuarios sin rol

    if (currentRole?.role) {
      targetRole = currentRole.role
    } else if (currentProfile?.role) {
      targetRole = currentProfile.role
    } else if (user.user_metadata?.role) {
      targetRole = user.user_metadata.role
    }

    console.log('🎯 Rol objetivo:', targetRole)

    // 4. Sincronizar user_roles
    const { error: upsertRoleError } = await admin
      .from('user_roles')
      .upsert({
        user_id: user.id,
        role: targetRole,
        is_active: true,
        created_at: currentRole?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })

    if (upsertRoleError) {
      console.error('❌ Error actualizando user_roles:', upsertRoleError)
      return NextResponse.json(
        { error: 'Error al sincronizar user_roles: ' + upsertRoleError.message },
        { status: 500 }
      )
    }

    // 5. Sincronizar profiles
    const { error: upsertProfileError } = await admin
      .from('profiles')
      .upsert({
        id: user.id,
        role: targetRole,
        full_name: currentProfile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario',
        email: user.email,
        created_at: currentProfile?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })

    if (upsertProfileError) {
      console.error('❌ Error actualizando profiles:', upsertProfileError)
      // No fallar si profiles falla, user_roles es más crítico
    }

    // 6. Verificar que la sincronización funcionó
    const { data: verifyRole } = await admin
      .from('user_roles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    const { data: verifyProfile } = await admin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    // 7. Registrar en audit log
    try {
      await admin.from('audit_log').insert({
        user_id: user.id,
        action: 'sync_role',
        resource: 'auth',
        resource_id: user.id,
        old_values: { 
          user_roles: currentRole, 
          profiles: currentProfile 
        },
        new_values: { 
          user_roles: verifyRole, 
          profiles: verifyProfile,
          target_role: targetRole
        },
        created_at: new Date().toISOString()
      })
    } catch (auditError) {
      console.error('⚠️ Error en audit log:', auditError)
      // No fallar si audit falla
    }

    console.log('✅ Sincronización completada')

    return NextResponse.json({ 
      success: true,
      message: 'Rol sincronizado correctamente',
      data: {
        user_id: user.id,
        target_role: targetRole,
        user_roles: verifyRole,
        profiles: verifyProfile,
        sync_timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('💥 Error en sync-role API:', error)
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + errorMessage },
      { status: 500 }
    )
  }
}