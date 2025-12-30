import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { UserRole } from '@/lib/auth/roles-permissions'

const VALID_ROLES: UserRole[] = ['admin', 'vendedor', 'tecnico', 'cliente']

export async function POST(request: Request) {
  try {
    const { role } = await request.json()

    // Validar que el rol es válido
    if (!role || !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: 'Rol inválido. Debe ser uno de: ' + VALID_ROLES.join(', ') },
        { status: 400 }
      )
    }

    // Obtener usuario autenticado
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    // Usar cliente admin para actualizar roles
    const admin = createAdminSupabase()

    // Actualizar en la tabla user_roles
    const { error: roleError } = await admin
      .from('user_roles')
      .upsert({
        user_id: user.id,
        role: role,
        is_active: true,
        updated_at: new Date().toISOString()
      })

    if (roleError) {
      console.error('Error updating user_roles:', roleError)
      return NextResponse.json(
        { error: 'Error al actualizar rol en user_roles: ' + roleError.message },
        { status: 500 }
      )
    }

    // Actualizar en la tabla profiles
    const { error: profileError } = await admin
      .from('profiles')
      .upsert({
        id: user.id,
        role: role,
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario',
        updated_at: new Date().toISOString()
      })

    if (profileError) {
      console.error('Error updating profiles:', profileError)
      // No fallar si profiles falla, user_roles es más importante
    }

    // Registrar en audit log
    try {
      await admin.from('audit_log').insert({
        user_id: user.id,
        action: 'assign_role_self',
        resource: 'auth',
        resource_id: user.id,
        new_values: { role: role },
        created_at: new Date().toISOString()
      })
    } catch (auditError) {
      console.error('Error logging audit:', auditError)
      // No fallar si audit falla
    }

    return NextResponse.json({ 
      success: true, 
      message: `Rol ${role} asignado correctamente`,
      role: role
    })

  } catch (error) {
    console.error('Error in assign-role API:', error)
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + errorMessage },
      { status: 500 }
    )
  }
}