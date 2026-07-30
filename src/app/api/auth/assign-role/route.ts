import { NextResponse } from 'next/server'
import { withSuperAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import type { UserRole } from '@/lib/auth/roles-permissions'

const VALID_ROLES: UserRole[] = ['admin', 'vendedor', 'tecnico', 'cliente']

async function handler(request: Request, context: AdminAuthContext) {
  try {
    const { role, user_id: userId } = await request.json()

    if (!role || !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `Rol invalido. Debe ser uno de: ${VALID_ROLES.join(', ')}` },
        { status: 400 }
      )
    }

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'Se requiere user_id del usuario objetivo' },
        { status: 400 }
      )
    }

    const admin = createAdminSupabase()
    const { error: roleError } = await admin.from('user_roles').upsert({
      user_id: userId,
      role,
      is_active: true,
      updated_at: new Date().toISOString(),
    })

    if (roleError) {
      return NextResponse.json(
        { error: `Error al actualizar rol: ${roleError.message}` },
        { status: 500 }
      )
    }

    const { error: profileError } = await admin
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', userId)

    if (profileError) {
      return NextResponse.json(
        { error: `El rol se actualizo parcialmente: ${profileError.message}` },
        { status: 500 }
      )
    }

    await admin.from('audit_log').insert({
      user_id: context.user.id,
      action: 'assign_role',
      resource: 'auth',
      resource_id: userId,
      new_values: {
        role,
        assigned_by: context.user.id,
        organization_id: context.organizationId,
      },
      organization_id: context.organizationId,
      created_at: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      message: `Rol ${role} asignado correctamente`,
      role,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json(
      { error: `Error interno del servidor: ${message}` },
      { status: 500 }
    )
  }
}

export const POST = withSuperAdminAuth(handler)
