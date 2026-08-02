import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'

// ---------------------------------------------------------------------------
// POST: grant super_admin role to a user (by email)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const me = await getSuperAdminUser()
  if (!me) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Email inválido.' }, { status: 400 })
  }

  const admin = createAdminSupabase()

  // Find user by email (paginate up to 5 pages of 200 = 1000 users)
  type AuthUser = { id: string; email?: string }
  let targetUser: AuthUser | null = null
  for (let page = 1; page <= 5 && !targetUser; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const users = (data?.users ?? []) as AuthUser[]
    targetUser = users.find((u) => u.email?.toLowerCase() === email) ?? null
    if (users.length < 200) break
  }

  if (!targetUser) {
    return NextResponse.json({ error: `No existe un usuario con email ${email}.` }, { status: 404 })
  }

  const { error: roleError } = await admin.rpc('set_super_admin_role', {
    p_target_user_id: targetUser.id,
    p_email: targetUser.email ?? email,
    p_grant: true,
  })

  if (roleError) {
    return NextResponse.json({ error: roleError.message || 'No se pudo asignar el rol.' }, { status: 500 })
  }

  await logSuperAdminAction({
    actorId: me.id,
    actorEmail: me.email,
    action: 'role_change',
    resource: 'user_roles',
    resourceId: targetUser.id,
    newValues: { role: 'super_admin', target_email: email },
    request,
    severity: 'critical',
  })

  return NextResponse.json({ success: true, userId: targetUser.id, email: targetUser.email })
}

// ---------------------------------------------------------------------------
// DELETE: revoke super_admin role
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  const me = await getSuperAdminUser()
  if (!me) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })

  const userId = request.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId requerido.' }, { status: 400 })

  if (userId === me.id) {
    return NextResponse.json({ error: 'No podés revocar tu propio rol de super_admin.' }, { status: 400 })
  }

  const admin = createAdminSupabase()

  const { error: roleError } = await admin.rpc('set_super_admin_role', {
    p_target_user_id: userId,
    p_email: '',
    p_grant: false,
  })

  if (roleError) {
    if (roleError.message.includes('LAST_SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Debe quedar al menos un super_admin activo.' }, { status: 400 })
    }
    if (roleError.message.includes('SUPER_ADMIN_NOT_FOUND')) {
      return NextResponse.json({ error: 'El usuario no es un super_admin activo.' }, { status: 404 })
    }
    return NextResponse.json({ error: roleError.message || 'No se pudo revocar el rol.' }, { status: 500 })
  }

  await logSuperAdminAction({
    actorId: me.id,
    actorEmail: me.email,
    action: 'role_change',
    resource: 'user_roles',
    resourceId: userId,
    oldValues: { role: 'super_admin' },
    newValues: { role: 'admin' },
    request,
    severity: 'critical',
  })

  return NextResponse.json({ success: true })
}
