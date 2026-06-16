import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireAdmin, getAuthResponse } from '@/lib/auth/require-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { UserRole } from '@/lib/auth/roles-permissions'

const VALID_ROLES: UserRole[] = ['admin', 'vendedor', 'tecnico', 'cliente']

/** El usuario objetivo debe pertenecer a la org del admin (super_admin = global). */
async function assertTargetInActorOrg(
  admin: ReturnType<typeof createAdminSupabase>,
  actorRole: string,
  actorId: string,
  targetUserId: string
): Promise<NextResponse | null> {
  if (actorRole === 'super_admin') return null

  const org = await getCurrentOrganizationContext(actorId)
  if (!org) {
    return NextResponse.json({ error: 'Sin organización activa.' }, { status: 403 })
  }

  const [{ data: member }, { data: customer }] = await Promise.all([
    admin.from('organization_members').select('user_id').eq('organization_id', org.id).eq('user_id', targetUserId).maybeSingle(),
    admin.from('customers').select('id').eq('organization_id', org.id).eq('profile_id', targetUserId).maybeSingle(),
  ])

  if (!member && !customer) {
    return NextResponse.json({ error: 'El usuario no pertenece a tu organización.' }, { status: 403 })
  }
  return null
}

export async function POST(request: Request) {
  try {
    // Solo un admin puede asignar roles
    const auth = await requireAdmin()
    const authResponse = getAuthResponse(auth)
    if (authResponse) return authResponse
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    // Autorización a nivel de objeto: el usuario objetivo debe pertenecer a la org del admin.
    const orgGuard = await assertTargetInActorOrg(admin, auth.role, auth.user.id, user_id)
    if (orgGuard) return orgGuard

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

