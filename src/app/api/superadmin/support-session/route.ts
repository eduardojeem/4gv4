import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getClientIp } from '@/lib/rate-limiter'
import { SUPPORT_REASON_MIN_LENGTH, SUPPORT_REASON_MAX_LENGTH } from '@/lib/superadmin/support-session-policy'
import {
  SUPPORT_COOKIE,
  SUPPORT_SESSION_TTL_MINUTES,
  createSupportSession,
  endSupportSession,
  getActiveSupportSession,
  SupportSessionsTableMissingError,
} from '@/lib/superadmin/support-session'

// GET — current active support session (for the client UI)
export async function GET() {
  const me = await getSuperAdminUser()
  if (!me) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })
  const session = await getActiveSupportSession(me.id)
  return NextResponse.json({ session }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST — start a support session against an organization
export async function POST(request: NextRequest) {
  const me = await getSuperAdminUser()
  if (!me) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })

  const payload: unknown = await request.json().catch(() => null)
  const body = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : {}
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId.trim() : ''
  const organizationSlug = typeof body.organizationSlug === 'string' ? body.organizationSlug.trim() : ''

  if (reason.length < SUPPORT_REASON_MIN_LENGTH || reason.length > SUPPORT_REASON_MAX_LENGTH) {
    return NextResponse.json({ error: `Indicá un motivo de entre ${SUPPORT_REASON_MIN_LENGTH} y ${SUPPORT_REASON_MAX_LENGTH} caracteres.` }, { status: 400 })
  }
  if (!organizationId && !organizationSlug) {
    return NextResponse.json({ error: 'Falta la organización.' }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const { data: organization, error: orgError } = await admin
    .from('organizations')
    .select('id, name, slug')
    .eq(organizationId ? 'id' : 'slug', organizationId || organizationSlug)
    .maybeSingle()

  if (orgError || !organization) {
    return NextResponse.json({ error: 'Organización no encontrada.' }, { status: 404 })
  }

  try {
    const { id, expiresAt } = await createSupportSession({
      superAdminId: me.id,
      organizationId: organization.id,
      reason,
      ip: getClientIp(request),
      userAgent: request.headers.get('user-agent'),
    })

    const cookieStore = await cookies()
    cookieStore.set(SUPPORT_COOKIE, id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SUPPORT_SESSION_TTL_MINUTES * 60,
    })

    await logSuperAdminAction({
      actorId: me.id,
      actorEmail: me.email,
      action: 'support.started',
      resource: 'support_sessions',
      resourceId: id,
      organizationId: organization.id,
      newValues: { reason, organization_slug: organization.slug, expires_at: expiresAt },
      request,
      severity: 'high',
    })

    return NextResponse.json({
      session: {
        id,
        organizationId: organization.id,
        organizationName: organization.name,
        organizationSlug: organization.slug,
        reason,
        expiresAt,
      },
    }, { status: 201 })
  } catch (error) {
    if (error instanceof SupportSessionsTableMissingError) {
      return NextResponse.json(
        { error: 'El registro de soporte no está disponible. Revisá las migraciones del sistema.', code: 'support_sessions_table_missing' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'No se pudo iniciar el modo soporte. Volvé a intentar.' },
      { status: 500 }
    )
  }
}

// DELETE — end the current support session
export async function DELETE(request: NextRequest) {
  const me = await getSuperAdminUser()
  if (!me) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })

  const cookieStore = await cookies()
  const sessionId = cookieStore.get(SUPPORT_COOKIE)?.value
  const active = await getActiveSupportSession(me.id)

  if (sessionId) {
    try {
      await endSupportSession(sessionId, me.id)
    } catch {
      return NextResponse.json({ error: 'No se pudo cerrar el modo soporte. La sesión se conserva para que puedas reintentar.' }, { status: 500 })
    }
    cookieStore.delete(SUPPORT_COOKIE)
  }

  if (active) {
    await logSuperAdminAction({
      actorId: me.id,
      actorEmail: me.email,
      action: 'support.ended',
      resource: 'support_sessions',
      resourceId: active.id,
      organizationId: active.organizationId,
      request,
    })
  }

  return NextResponse.json({ success: true })
}
