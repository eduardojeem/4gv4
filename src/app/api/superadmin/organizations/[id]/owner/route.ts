import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import { siteUrl } from '@/lib/site-url'
import { provisionOrganizationOwner } from '@/lib/superadmin/provision-owner'
import { parseOwnerInput } from '@/lib/superadmin/create-organization'

const OWNER_INVITE_REDIRECT = '/auth/confirm?next=/dashboard/onboarding'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Asignar el propietario de una organizacion que quedo sin uno.
 *
 * El alta crea la organizacion y despues invita al propietario: son dos pasos
 * y el segundo depende del servicio de correo. Si fallaba, la pantalla de exito
 * mostraba el error y no ofrecia nada: la organizacion quedaba sin nadie que
 * pudiera entrar y no habia desde donde corregirlo.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const superAdmin = await getSuperAdminUser()
  if (!superAdmin) {
    return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })
  }

  const { id } = await params
  if (!UUID.test(id)) {
    return NextResponse.json({ error: 'Identificador de organización inválido.' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const owner = parseOwnerInput(body)
  if (owner.ok === false) {
    return NextResponse.json({ error: owner.message, field: owner.field }, { status: 400 })
  }
  if (!owner.email) {
    return NextResponse.json({ error: 'Ingresá el correo del propietario.', field: 'ownerEmail' }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const { data: org, error } = await admin
    .from('organizations')
    .select('id, name, slug, plan, owner_id')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'No se pudo cargar la organización.' }, { status: 500 })
  }
  if (!org) {
    return NextResponse.json({ error: 'La organización no existe.' }, { status: 404 })
  }
  // Esta ruta completa un alta; no cambia de manos una organizacion que ya
  // tiene dueño.
  if (org.owner_id) {
    return NextResponse.json({ error: 'La organización ya tiene propietario.' }, { status: 409 })
  }

  const provisioned = await provisionOrganizationOwner(admin, {
    organizationId: org.id,
    organizationName: org.name,
    organizationSlug: org.slug,
    plan: org.plan,
    email: owner.email,
    fullName: owner.name,
    redirectTo: siteUrl(OWNER_INVITE_REDIRECT),
  })

  await logSuperAdminAction({
    actorId: superAdmin.id,
    actorEmail: superAdmin.email,
    action:
      provisioned.outcome.status === 'invited'
        ? 'invite_owner'
        : provisioned.outcome.status === 'assigned_existing'
          ? 'assign_owner'
          : 'assign_owner_failed',
    resource: 'organizations',
    resourceId: org.id,
    organizationId: org.id,
    newValues: {
      owner_email: owner.email,
      owner_user_id: provisioned.userId,
      outcome: provisioned.outcome.status,
    },
    request,
    severity: 'high',
  })

  return NextResponse.json({ owner: provisioned.outcome })
}
