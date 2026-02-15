import { NextResponse } from 'next/server'
import { createAdminSupabase, mapUiRoleToDbRole } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body?.email === 'string' ? body.email.trim() : ''
    const uiRole = (typeof body?.role === 'string' ? body.role : 'cliente').trim().toLowerCase()

    if (!email || !/.+@.+\..+/.test(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    const admin = createAdminSupabase()

    // Buscar usuario por email (paginando si es necesario)
    let targetUser: { id: string; email?: string } | null = null
    let page = 1
    const perPage = 200
    for (let i = 0; i < 5 && !targetUser; i++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      targetUser = (data?.users || []).find(u => u.email?.toLowerCase() === email.toLowerCase()) ?? null
      if (!targetUser && (data?.users?.length || 0) < perPage) break
      page++
    }

    if (!targetUser) {
      return NextResponse.json({ error: 'Usuario no encontrado para ese email' }, { status: 404 })
    }

    const dbRole = mapUiRoleToDbRole(uiRole) ?? 'viewer'

    const { error: upsertError } = await admin
      .from('user_roles')
      .upsert({ user_id: targetUser.id, role: dbRole })

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    // Audit log
    await admin
      .from('audit_log')
      .insert({
        user_id: targetUser.id,
        action: 'assign_role',
        resource_type: 'user',
        resource_id: targetUser.id,
        details: { email, ui_role: uiRole, db_role: dbRole }
      })

    return NextResponse.json({ success: true, user_id: targetUser.id, role: dbRole })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error inesperado' }, { status: 500 })
  }
}

