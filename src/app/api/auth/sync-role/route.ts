import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'

export async function POST() {
  try {
    const supabase = await createServerSupabase()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const admin = createAdminSupabase()

    // 1. Verificar estado actual en user_roles
    const { data: currentRole } = await admin
      .from('user_roles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    // 2. Verificar estado actual en profiles
    const { data: currentProfile } = await admin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    // 3. Determinar el rol (prioridad: user_roles > profiles > metadata > default cliente)
    let targetRole = 'cliente'

    if (currentRole?.role) {
      targetRole = currentRole.role
    } else if (currentProfile?.role) {
      targetRole = currentProfile.role
    } else if (user.user_metadata?.role) {
      targetRole = user.user_metadata.role as string
    }

    // 4. Sincronizar user_roles
    const { error: upsertRoleError } = await admin
      .from('user_roles')
      .upsert(
        {
          user_id: user.id,
          role: targetRole,
          is_active: true,
          created_at: currentRole?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (upsertRoleError) {
      return NextResponse.json(
        { error: 'Error al sincronizar user_roles: ' + upsertRoleError.message },
        { status: 500 }
      )
    }

    // 5. Sincronizar profiles
    await admin
      .from('profiles')
      .upsert(
        {
          id: user.id,
          role: targetRole,
          full_name:
            currentProfile?.full_name ||
            user.user_metadata?.full_name ||
            user.email?.split('@')[0] ||
            'Usuario',
          email: user.email,
          created_at: currentProfile?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )

    // 6. Verificar que la sincronizacion funciono
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
        old_values: { user_roles: currentRole, profiles: currentProfile },
        new_values: {
          user_roles: verifyRole,
          profiles: verifyProfile,
          target_role: targetRole,
        },
        created_at: new Date().toISOString(),
      })
    } catch {
      // No fallar si audit falla
    }

    return NextResponse.json({
      success: true,
      message: 'Rol sincronizado correctamente',
      data: {
        user_id: user.id,
        target_role: targetRole,
        user_roles: verifyRole,
        profiles: verifyProfile,
        sync_timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + errorMessage },
      { status: 500 }
    )
  }
}
