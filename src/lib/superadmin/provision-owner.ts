import type { SupabaseClient } from '@supabase/supabase-js'

import { findAuthUserByEmail } from './find-auth-user'
import { OWNER_FAILURE_MESSAGES, type OwnerFailureReason, type OwnerOutcome } from './create-organization'

type AdminClient = Pick<SupabaseClient, 'from' | 'auth' | 'rpc'>

export interface ProvisionOwnerParams {
  organizationId: string
  organizationName: string
  organizationSlug: string
  plan: string
  email: string
  fullName: string | null
  redirectTo: string
}

const fallo = (email: string, reason: OwnerFailureReason): OwnerOutcome => ({
  status: 'failed',
  email,
  reason,
  message: OWNER_FAILURE_MESSAGES[reason],
})

const YA_REGISTRADO = /already (been )?registered|already exists|email_exists/i

/**
 * Deja a una persona como propietaria de la organizacion.
 *
 * Antes siempre se llamaba a `inviteUserByEmail`. Con una cuenta existente
 * —el caso comun: un cliente que abre su segunda empresa— Supabase responde
 * «A user with this email address has already been registered», la
 * organizacion quedaba sin propietario y la pantalla mostraba ese texto en
 * ingles. Ahora se busca primero: si la cuenta existe se asigna sin invitar, y
 * si no existe se invita.
 */
export async function provisionOrganizationOwner(
  admin: AdminClient,
  params: ProvisionOwnerParams
): Promise<{ outcome: OwnerOutcome; userId: string | null }> {
  const email = params.email.trim().toLowerCase()
  const fullName = params.fullName?.trim() || email.split('@')[0]

  let lookup: Awaited<ReturnType<typeof findAuthUserByEmail>>
  try {
    lookup = await findAuthUserByEmail(admin, email)
  } catch {
    return { outcome: fallo(email, 'lookup_incomplete'), userId: null }
  }

  const asignar = async (userId: string, status: 'invited' | 'assigned_existing') => {
    const { error } = await admin.rpc('assign_superadmin_organization_owner', {
      p_organization_id: params.organizationId,
      p_user_id: userId,
      p_email: email,
      p_full_name: fullName,
    })
    if (error) {
      const reason: OwnerFailureReason = /OWNER_SUSPENDED/.test(error.message ?? '') ? 'suspended' : 'assign_failed'
      return { outcome: fallo(email, reason), userId }
    }
    return { outcome: { status, email } as OwnerOutcome, userId }
  }

  if (lookup.user) {
    return asignar(lookup.user.id, 'assigned_existing')
  }

  // Sin haber recorrido todas las cuentas no se puede saber si existe, e
  // invitar a una existente falla igual: se dice, en vez de intentarlo a ciegas.
  if (lookup.scanTruncated) {
    return { outcome: fallo(email, 'lookup_incomplete'), userId: null }
  }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: {
      full_name: fullName,
      company_name: params.organizationName,
      company_slug: params.organizationSlug,
      selected_plan: params.plan,
      registration_type: 'company_owner',
    },
    redirectTo: params.redirectTo,
  })

  if (error || !data?.user) {
    const reason: OwnerFailureReason = YA_REGISTRADO.test(`${error?.message ?? ''} ${(error as { code?: string } | null)?.code ?? ''}`)
      ? 'already_registered'
      : 'invite_failed'
    return { outcome: fallo(email, reason), userId: null }
  }

  return asignar(data.user.id, 'invited')
}
