import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/superadmin/auth'

// ---------------------------------------------------------------------------
// POST: grant super_admin role to a user (by email)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const me = await requireSuperAdmin()
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

  // Upsert user_roles + profiles
  const [{ error: roleError }, { error: profileError }, { error: auditError }] = await Promise.all([
    admin.from('user_roles').upsert(
      { user_id: targetUser.id, role: 'super_admin', is_active: true, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    ),
    admin.from('profiles').upsert(
      { id: targetUser.id, email: targetUser.email, role: 'super_admin', status: 'active' },
      { onConflict: 'id' }
    ),
    admin.from('audit_log').insert({
      user_id: me.id,
      action: 'role_change',
      resource: 'user_roles',
      resource_id: targetUser.id,
      new_values: { role: 'super_admin', target_email: email, granted_by: me.email },
    }),
  ])

  if (roleError || profileError) {
    return NextResponse.json({ error: (roleError ?? profileError)?.message || 'No se pudo asignar el rol.' }, { status: 500 })
  }

  if (auditError) {
    console.warn('Audit log failed for super_admin grant:', auditError.message)
  }

  return NextResponse.json({ success: true, userId: targetUser.id, email: targetUser.email })
}

// ---------------------------------------------------------------------------
// DELETE: revoke super_admin role
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  const me = await requireSuperAdmin()
  if (!me) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })

  const userId = request.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId requerido.' }, { status: 400 })

  if (userId === me.id) {
    return NextResponse.json({ error: 'No podés revocar tu propio rol de super_admin.' }, { status: 400 })
  }

  const admin = createAdminSupabase()

  // Make sure at least one super_admin remains
  const { count, error: countError } = await admin
    .from('user_roles')
    .select('user_id', { count: 'exact', head: true })
    .eq('role', 'super_admin')
    .eq('is_active', true)

  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 })
  if ((count ?? 0) <= 1) {
    return NextResponse.json({ error: 'Debe quedar al menos un super_admin activo.' }, { status: 400 })
  }

  // Demote to 'admin' (don't fully delete to keep audit trail consistent)
  const [{ error: roleError }, { error: profileError }] = await Promise.all([
    admin.from('user_roles').update({ role: 'admin', updated_at: new Date().toISOString() }).eq('user_id', userId),
    admin.from('profiles').update({ role: 'admin' }).eq('id', userId),
  ])

  if (roleError || profileError) {
    return NextResponse.json({ error: (roleError ?? profileError)?.message || 'No se pudo revocar el rol.' }, { status: 500 })
  }

  await admin.from('audit_log').insert({
    user_id: me.id,
    action: 'role_change',
    resource: 'user_roles',
    resource_id: userId,
    new_values: { role: 'admin', previous_role: 'super_admin', revoked_by: me.email },
  })

  return NextResponse.json({ success: true })
}
