import { NextResponse } from 'next/server'
import { createAdminSupabase, mapUiRoleToDbRole } from '@/lib/supabase/admin'
import { requireAdmin, getAuthResponse } from '@/lib/auth/require-auth'

export async function POST(request: Request) {
  try {
    // Solo un admin puede cambiar roles por email
    const auth = await requireAdmin()
    const authResponse = getAuthResponse(auth)
    if (authResponse) return authResponse
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const email = typeof body?.email === 'string' ? body.email.trim() : ''
    const uiRole = (typeof body?.role === 'string' ? body.role : 'cliente')
      .trim()
      .toLowerCase()

    if (!email || !/.+@.+\..+/.test(email)) {
      return NextResponse.json({ error: 'Email invalido' }, { status: 400 })
    }

    const admin = createAdminSupabase()

    // Buscar usuario por email (paginando si es necesario)
    let targetUser: { id: string; email?: string } | null = null
    let page = 1
    const perPage = 200
    for (let i = 0; i < 5 && !targetUser; i++) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage,
      })
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      targetUser =
        (data?.users || []).find(
          (u) => u.email?.toLowerCase() === email.toLowerCase()
        ) ?? null
      if (!targetUser && (data?.users?.length || 0) < perPage) break
      page++
    }

    if (!targetUser) {
      return NextResponse.json(
        { error: 'Usuario no encontrado para ese email' },
        { status: 404 }
      )
    }

    const dbRole = mapUiRoleToDbRole(uiRole)
    if (!dbRole) {
      return NextResponse.json({ error: `Rol invalido: ${uiRole}` }, { status: 400 })
    }

    if (dbRole === 'super_admin' && auth.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'No tienes permisos para asignar super_admin' }, { status: 403 })
    }

    const { error: upsertError } = await admin
      .from('user_roles')
      .upsert({ user_id: targetUser.id, role: dbRole })

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    await admin
      .from('profiles')
      .update({ role: dbRole, updated_at: new Date().toISOString() })
      .eq('id', targetUser.id)

    // Audit log
    await admin.from('audit_log').insert({
      user_id: auth.user.id,
      action: 'assign_role_by_email',
      resource_type: 'user',
      resource_id: targetUser.id,
      details: {
        email,
        ui_role: uiRole,
        db_role: dbRole,
        assigned_by: auth.user.email,
      },
    })

    return NextResponse.json({
      success: true,
      user_id: targetUser.id,
      role: dbRole,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error inesperado'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

