import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-auth'
import { UserRole } from '@/lib/auth/roles-permissions'

const VALID_ROLES: UserRole[] = ['admin', 'vendedor', 'tecnico', 'cliente']

export async function POST(request: Request) {
  try {
    // Solo un admin puede asignar roles
    const auth = await requireAdmin()
    if (!auth.authenticated) return auth.response

    const { role, user_id } = await request.json()

    if (!role || !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: 'Rol invalido. Debe ser uno de: ' + VALID_ROLES.join(', ') },
        { status: 400 }
      )
    }

    if (!user_id || typeof user_id !== 'string') {
      return NextResponse.json(
        { error: 'Se requiere user_id del usuario objetivo' },
        { status: 400 }
      )
    }

    const admin = createAdminSupabase()

    // Actualizar en la tabla user_roles
    const { error: roleError } = await admin
      .from('user_roles')
      .upsert({
        user_id,
        role,
        is_active: true,
        updated_at: new Date().toISOString(),
      })

    if (roleError) {
      return NextResponse.json(
        { error: 'Error al actualizar rol: ' + roleError.message },
        { status: 500 }
      )
    }

    // Actualizar en la tabla profiles
    const { error: profileError } = await admin
      .from('profiles')
      .update({
        role,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user_id)

    if (profileError) {
      // No fallar si profiles falla, user_roles es mas importante
    }

    // Registrar en audit log
    try {
      await admin.from('audit_log').insert({
        user_id: auth.user.id,
        action: 'assign_role',
        resource: 'auth',
        resource_id: user_id,
        new_values: { role, assigned_by: auth.user.id },
        created_at: new Date().toISOString(),
      })
    } catch {
      // No fallar si audit falla
    }

    return NextResponse.json({
      success: true,
      message: `Rol ${role} asignado correctamente`,
      role,
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
