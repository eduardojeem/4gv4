import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import { findAuthUserByEmail } from '@/lib/superadmin/find-auth-user'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// ---------------------------------------------------------------------------
// POST: dar el rol de super administrador a un usuario, por correo
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const me = await getSuperAdminUser()
  if (!me) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Escribí un correo válido.' }, { status: 400 })
  }

  const admin = createAdminSupabase()

  let lookup
  try {
    lookup = await findAuthUserByEmail(admin, email)
  } catch {
    return NextResponse.json({ error: 'No se pudo consultar los usuarios.' }, { status: 500 })
  }

  // No es lo mismo «no existe» que «no lo encontre»: afirmar lo primero cuando
  // lo unico que paso es que se agoto el barrido es decirle al usuario algo
  // falso sobre su propia plataforma.
  if (!lookup.user) {
    return lookup.scanTruncated
      ? NextResponse.json({
          error: `No se pudo confirmar si existe una cuenta con ${email}. Pedile que inicie sesión una vez y volvé a intentar.`,
          code: 'LOOKUP_INCOMPLETE',
        }, { status: 503 })
      : NextResponse.json({
          error: `No hay ninguna cuenta registrada con ${email}.`,
          code: 'USER_NOT_FOUND',
        }, { status: 404 })
  }

  const targetUser = lookup.user

  // Ya lo era: el RPC hace `upsert` y devolvia exito, asi que la pantalla
  // anunciaba una promocion que no ocurrio.
  const { data: existingRole } = await admin
    .from('user_roles')
    .select('is_active')
    .eq('user_id', targetUser.id)
    .eq('role', 'super_admin')
    .maybeSingle()

  const wasActive = existingRole?.is_active === true

  const { error: roleError } = await admin.rpc('set_super_admin_role', {
    p_target_user_id: targetUser.id,
    p_email: targetUser.email ?? email,
    p_grant: true,
  })

  if (roleError) {
    // El mensaje crudo de Postgres no le sirve a nadie y puede filtrar detalle
    // interno; los casos conocidos se traducen.
    if (roleError.message?.includes('USER_NOT_FOUND')) {
      return NextResponse.json({ error: `La cuenta de ${email} ya no existe.` }, { status: 404 })
    }
    return NextResponse.json({ error: 'No se pudo asignar el rol.' }, { status: 500 })
  }

  await logSuperAdminAction({
    actorId: me.id,
    actorEmail: me.email,
    action: 'role_change',
    resource: 'user_roles',
    resourceId: targetUser.id,
    newValues: { role: 'super_admin', target_email: email, reactivated: existingRole ? !wasActive : false },
    request,
    severity: 'critical',
  })

  return NextResponse.json({
    success: true,
    userId: targetUser.id,
    email: targetUser.email,
    // Para que la pantalla diga lo que efectivamente paso.
    outcome: wasActive ? 'already_active' : existingRole ? 'reactivated' : 'granted',
  })
}

// ---------------------------------------------------------------------------
// DELETE: quitar el rol de super administrador
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  const me = await getSuperAdminUser()
  if (!me) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })

  const userId = request.nextUrl.searchParams.get('userId')
  if (!userId || !UUID.test(userId)) {
    return NextResponse.json({ error: 'Falta indicar a quién quitarle el rol.' }, { status: 400 })
  }

  if (userId === me.id) {
    return NextResponse.json({ error: 'No podés quitarte el rol a vos mismo.' }, { status: 400 })
  }

  const admin = createAdminSupabase()

  const { error: roleError } = await admin.rpc('set_super_admin_role', {
    p_target_user_id: userId,
    p_email: '',
    p_grant: false,
  })

  if (roleError) {
    if (roleError.message?.includes('LAST_SUPER_ADMIN')) {
      return NextResponse.json({
        error: 'Tiene que quedar al menos un super administrador activo.',
      }, { status: 400 })
    }
    if (roleError.message?.includes('SUPER_ADMIN_NOT_FOUND')) {
      return NextResponse.json({
        error: 'Esta cuenta ya no tiene el rol activo.',
      }, { status: 404 })
    }
    if (roleError.message?.includes('USER_NOT_FOUND')) {
      return NextResponse.json({ error: 'La cuenta ya no existe.' }, { status: 404 })
    }
    return NextResponse.json({ error: 'No se pudo quitar el rol.' }, { status: 500 })
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
