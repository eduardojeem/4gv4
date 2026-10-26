import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth, type TenantAuthContext } from '@/lib/api/withTenantAuth'
import { invalidateAdminMfaPolicy } from '@/lib/auth/admin-mfa-policy'
import { MFA_REQUIRED_CODE } from '@/lib/auth/mfa'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/**
 * «Exigir verificación en dos pasos a los administradores» de la organización
 * activa. Leerla y cambiarla requiere `settings.manage` (dueño o administrador).
 *
 * Cambiarla requiere además una sesión que ya pasó el código (`aal2`): así nadie
 * la apaga con sólo la contraseña de un administrador, y quien la prende ya
 * tiene 2FA y no se deja afuera a sí mismo. La base lo vuelve a exigir con un
 * trigger aunque se escriba directo con la API de datos.
 */

const bodySchema = z.object({ requireAdminMfa: z.boolean() }).strict()

async function getPolicy(_request: NextRequest, { user, organization }: TenantAuthContext) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('organization_settings')
    .select('require_admin_mfa')
    .eq('organization_id', organization.id)
    .maybeSingle()

  if (error) {
    logger.error('[mfa-policy] No se pudo leer la configuración', { organizationId: organization.id, error })
    return NextResponse.json({ error: 'No se pudo leer la configuración de seguridad.' }, { status: 500 })
  }

  return NextResponse.json({
    requireAdminMfa: data?.require_admin_mfa === true,
    canChange: user.aal === 'aal2',
  })
}

async function updatePolicy(request: NextRequest, { user, organization }: TenantAuthContext) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 })
  }

  if (user.aal !== 'aal2') {
    return NextResponse.json(
      {
        error: 'Activá la verificación en dos pasos en tu perfil y volvé a iniciar sesión con el código para cambiar esta opción.',
        code: MFA_REQUIRED_CODE,
      },
      { status: 403 }
    )
  }

  const { requireAdminMfa } = parsed.data
  // Con la sesión del usuario: RLS (settings.manage) y el trigger de aal2 aplican igual que en la base.
  const supabase = await createClient()
  const { data: updated, error } = await supabase
    .from('organization_settings')
    .update({ require_admin_mfa: requireAdminMfa })
    .eq('organization_id', organization.id)
    .select('organization_id')

  if (error) {
    logger.error('[mfa-policy] No se pudo guardar', { organizationId: organization.id, error })
    return NextResponse.json({ error: 'No se pudo guardar la configuración de seguridad.' }, { status: 500 })
  }

  if (!updated || updated.length === 0) {
    // La organización todavía no tiene fila de configuración y RLS no deja crearla
    // con la sesión del usuario. El permiso y el aal2 ya se verificaron arriba.
    const { error: insertError } = await createAdminSupabase()
      .from('organization_settings')
      .upsert(
        { organization_id: organization.id, require_admin_mfa: requireAdminMfa },
        { onConflict: 'organization_id' }
      )
    if (insertError) {
      logger.error('[mfa-policy] No se pudo crear la configuración', { organizationId: organization.id, error: insertError })
      return NextResponse.json({ error: 'No se pudo guardar la configuración de seguridad.' }, { status: 500 })
    }
  }

  invalidateAdminMfaPolicy(organization.id)
  logger.info('[mfa-policy] Exigencia de 2FA para administradores cambiada', {
    organizationId: organization.id,
    userId: user.id,
    requireAdminMfa,
  })

  return NextResponse.json({ requireAdminMfa, canChange: true })
}

export const GET = withTenantAuth({ permission: 'settings.manage' }, getPolicy)
export const PUT = withTenantAuth({ permission: 'settings.manage' }, updatePolicy)
