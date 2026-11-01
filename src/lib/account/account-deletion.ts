import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/resend'
import { renderAccountDeletionRequestedEmail } from '@/lib/email/templates'

/**
 * Eliminación de cuenta a pedido del usuario (requisito de Google Play).
 *
 * Al pedirla, la cuenta se bloquea en el momento y, si era el único
 * administrador de un negocio, el negocio se cierra. A los 30 días la tarea
 * diaria anonimiza los datos personales. El usuario de Auth no se borra:
 * ventas, caja y finanzas lo referencian, y esos registros se conservan sin
 * datos personales.
 */

export const ACCOUNT_DELETION_GRACE_DAYS = 30
export const ACCOUNT_DELETION_CONFIRM_WORD = 'ELIMINAR'
const BAN_DURATION = '876000h'

export function accountSupportEmail() {
  return process.env.SUPPORT_EMAIL?.trim() || process.env.EMAIL_REPLY_TO?.trim() || 'soporte@mitiendapy.com'
}

export class AccountDeletionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

export type AccountDeletionImpact = {
  email: string | null
  pending: { scheduledFor: string } | null
  closesOrganizations: Array<{ id: string; name: string }>
}

type DeletionRequestRow = {
  id: string
  user_id: string
  scheduled_for: string
  closed_organization_ids: string[] | null
}

/** Qué pasa si esta cuenta se elimina: negocios que se cierran y si ya hay un pedido. */
export async function getAccountDeletionImpact(userId: string, email: string | null): Promise<AccountDeletionImpact> {
  const admin = createAdminSupabase()
  const [{ data: pending }, { data: memberships }] = await Promise.all([
    admin.from('account_deletion_requests').select('scheduled_for').eq('user_id', userId).eq('status', 'pending').maybeSingle(),
    admin.from('organization_members').select('organization_id').eq('user_id', userId).eq('status', 'active').in('role', ['owner', 'admin']),
  ])

  const organizationIds = (memberships ?? []).map((row) => row.organization_id as string)
  let closesOrganizations: AccountDeletionImpact['closesOrganizations'] = []
  if (organizationIds.length) {
    const [{ data: others }, { data: organizations }] = await Promise.all([
      admin.from('organization_members').select('organization_id').in('organization_id', organizationIds)
        .neq('user_id', userId).eq('status', 'active').in('role', ['owner', 'admin']),
      admin.from('organizations').select('id, name').in('id', organizationIds),
    ])
    const shared = new Set((others ?? []).map((row) => row.organization_id as string))
    closesOrganizations = (organizations ?? [])
      .filter((row) => !shared.has(row.id as string))
      .map((row) => ({ id: row.id as string, name: (row.name as string) || 'Negocio' }))
  }

  return {
    email,
    pending: pending ? { scheduledFor: pending.scheduled_for as string } : null,
    closesOrganizations,
  }
}

/** Confirma la contraseña sin tocar la sesión del usuario. */
async function verifyPassword(email: string, password: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new AccountDeletionError('El servidor no está configurado para verificar la contraseña.', 500)
  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.session) return false
  // Esa sesión de verificación no se usa: se cierra en el acto.
  await client.auth.signOut({ scope: 'local' }).catch(() => {})
  return true
}

export async function requestAccountDeletion(params: {
  userId: string
  email: string | null
  password: string
  source: 'app' | 'web'
  reason?: string | null
}) {
  if (!params.email) throw new AccountDeletionError('La cuenta no tiene correo para confirmar la contraseña. Escribinos a soporte.', 400)
  if (!(await verifyPassword(params.email, params.password))) {
    throw new AccountDeletionError('La contraseña no es correcta.', 403)
  }

  const admin = createAdminSupabase()
  const { data, error } = await admin.rpc('request_account_deletion', {
    p_user_id: params.userId,
    p_source: params.source,
    p_reason: params.reason ?? null,
  })
  if (error || !data) throw new AccountDeletionError('No se pudo registrar el pedido. Probá de nuevo.', 500)
  const request = data as DeletionRequestRow

  // Bloquea el inicio de sesión y la renovación de los tokens que ya tenga.
  const { error: banError } = await admin.auth.admin.updateUserById(params.userId, { ban_duration: BAN_DURATION })
  if (banError) console.error('[account-deletion] No se pudo bloquear el usuario', { userId: params.userId, code: banError.code })

  const closedIds = request.closed_organization_ids ?? []
  // El pedido ya quedó registrado: si falla el correo, no se informa como error.
  try {
    const { data: closed } = closedIds.length
      ? await admin.from('organizations').select('name').in('id', closedIds)
      : { data: [] as Array<{ name: string }> }
    await sendEmail({
      to: params.email,
      subject: 'Recibimos tu pedido de eliminar la cuenta',
      html: renderAccountDeletionRequestedEmail({
        scheduledFor: request.scheduled_for,
        closedOrganizations: (closed ?? []).map((row) => row.name),
        supportEmail: accountSupportEmail(),
      }),
    })
  } catch (sendError) {
    console.error('[account-deletion] No se pudo mandar la confirmación', { sendError })
  }

  return { scheduledFor: request.scheduled_for, closedOrganizations: closedIds.length }
}

/** Tarea diaria: anonimiza las cuentas cuyo plazo de 30 días ya venció. */
export async function completeDueAccountDeletions(now = new Date()) {
  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('account_deletion_requests')
    .select('id, user_id')
    .eq('status', 'pending')
    .lte('scheduled_for', now.toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(50)
  if (error) throw new Error(`No se pudieron leer los pedidos de eliminación: ${error.message}`)

  const result = { completed: 0, failed: 0 }
  for (const row of data ?? []) {
    try {
      // Primero Auth: si falla, el pedido sigue pendiente y se reintenta mañana.
      const { error: authError } = await admin.auth.admin.updateUserById(row.user_id as string, {
        email: `eliminada-${row.id}@cuentas-eliminadas.invalid`,
        email_confirm: true,
        phone: '',
        user_metadata: {},
        ban_duration: BAN_DURATION,
      })
      if (authError) throw new Error(authError.message)
      const { error: rpcError } = await admin.rpc('complete_account_deletion', { p_request_id: row.id })
      if (rpcError) throw new Error(rpcError.message)
      result.completed += 1
    } catch (completeError) {
      console.error('[account-deletion] No se pudo completar la eliminación', { requestId: row.id, completeError })
      result.failed += 1
    }
  }
  return result
}
