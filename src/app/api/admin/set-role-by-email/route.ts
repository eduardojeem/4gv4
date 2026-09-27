import { NextResponse } from 'next/server'
import { createAdminSupabase, mapUiRoleToDbRole } from '@/lib/supabase/admin'
import { withSuperAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import { isValidEmail } from '@/lib/auth/password-validation'

async function handler(request: Request, context: AdminAuthContext) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body?.email === 'string' ? body.email.trim() : ''
    const uiRole = (typeof body?.role === 'string' ? body.role : 'cliente')
      .trim()
      .toLowerCase()

    if (!email || !isValidEmail(email)) {
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

    // `user_roles` tiene la clave primaria en `id` y un UNIQUE sobre `user_id`.
    // Sin declarar el conflicto, el upsert apunta a la primaria, genera un id
    // nuevo y termina siendo un INSERT que choca contra ese unico: fallaba para
    // todo usuario que ya tuviera un rol, es decir para casi todos.
    const { error: upsertError } = await admin
      .from('user_roles')
      .upsert({ user_id: targetUser.id, role: dbRole }, { onConflict: 'user_id' })

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    await admin
      .from('profiles')
      .update({ role: dbRole, updated_at: new Date().toISOString() })
      .eq('id', targetUser.id)

    // Audit log
    await admin.from('audit_log').insert({
      user_id: context.user.id,
      action: 'assign_role_by_email',
      // Era `resource_type`, que existe pero no es la que lee la pantalla: el
      // evento salia como "unknown" porque `resource` tomaba su valor por
      // defecto. Los otros 46 usos del proyecto escriben `resource`.
      resource: 'user',
      resource_id: targetUser.id,
      // Sin organizacion a proposito: cambia el rol global de una persona, que
      // puede pertenecer a varias tiendas o a ninguna. Atribuirlo a una seria
      // inventar. Queda como evento de plataforma.
      severity: 'high',
      details: {
        email,
        ui_role: uiRole,
        db_role: dbRole,
        assigned_by: context.user.email,
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

export const POST = withSuperAdminAuth(handler)
