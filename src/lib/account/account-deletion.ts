import 'server-only'
import { createHash, randomInt, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/resend'
import { renderAccountDeletionCodeEmail, renderAccountDeletionRequestedEmail } from '@/lib/email/templates'
import { resolveSupportEmail } from '@/lib/platform/support-contact'

/**
 * Eliminación de cuenta a pedido del usuario (requisito de Google Play).
 *
 * Al pedirla, la cuenta se bloquea en el momento y, si era el único
 * administrador de un negocio, el negocio se cierra. A los 30 días la tarea
 * diaria anonimiza los datos personales y borra la foto. El usuario de Auth no
 * se borra: ventas, caja y finanzas lo referencian, y esos registros se
 * conservan sin datos personales. Soporte puede cancelar el pedido antes.
 *
 * La identidad se confirma con la contraseña o, para quien entra con Google y
 * no tiene, con un código que se manda al correo de la cuenta.
 */

export const ACCOUNT_DELETION_GRACE_DAYS = 30
export const ACCOUNT_DELETION_CONFIRM_WORD = 'ELIMINAR'
/** Años que se conservan ventas, caja y comprobantes (prescripción tributaria). */
export const ACCOUNT_RECORDS_RETENTION_YEARS = 5
export const ACCOUNT_DELETION_CODE_TTL_MINUTES = 10
export const ACCOUNT_DELETION_CODE_MAX_ATTEMPTS = 5
const CODE_RESEND_SECONDS = 60
const BAN_DURATION = '876000h'
const AVATAR_BUCKET = 'avatars'

/**
 * Correo de soporte: el que cargó el superadmin en Marca SaaS, si no
 * SUPPORT_EMAIL / EMAIL_REPLY_TO y por último soporte@mitiendapy.com.
 * La marca se importa al usarla para que leerla no sea obligatorio al cargar el
 * módulo; si la base no responde, se sigue con las variables de entorno.
 */
export async function accountSupportEmail() {
  let brandingEmail = ''
  try {
    const { getPlatformBranding } = await import('@/lib/platform/branding')
    brandingEmail = (await getPlatformBranding()).supportEmail
  } catch (error) {
    console.error('[account-deletion] No se pudo leer el correo de soporte de la marca', { error })
  }
  return resolveSupportEmail(brandingEmail)
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
  /** false si entra solo con Google: confirma con un código por correo. */
  hasPassword: boolean
  graceDays: number
  /** A quién escribir antes de eliminar (la app lo ofrece como alternativa). */
  supportEmail: string
}

type DeletionRequestRow = {
  id: string
  user_id: string
  scheduled_for: string
  closed_organization_ids: string[] | null
}

export type AccountDeletionConfirmation = { method: 'password'; password: string } | { method: 'code'; code: string }

/** Si la cuenta tiene contraseña (identidad de correo) o solo entra con Google u otro proveedor. */
async function userHasPassword(userId: string) {
  const { data, error } = await createAdminSupabase().auth.admin.getUserById(userId)
  if (error || !data?.user) return true
  const identities = data.user.identities ?? []
  return identities.length === 0 || identities.some((identity) => identity.provider === 'email')
}

/** Qué pasa si esta cuenta se elimina: negocios que se cierran y si ya hay un pedido. */
export async function getAccountDeletionImpact(userId: string, email: string | null): Promise<AccountDeletionImpact> {
  const admin = createAdminSupabase()
  const [{ data: pending }, { data: memberships }, hasPassword, supportEmail] = await Promise.all([
    admin.from('account_deletion_requests').select('scheduled_for').eq('user_id', userId).eq('status', 'pending').maybeSingle(),
    admin.from('organization_members').select('organization_id').eq('user_id', userId).eq('status', 'active').in('role', ['owner', 'admin']),
    userHasPassword(userId),
    accountSupportEmail(),
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
    hasPassword,
    graceDays: ACCOUNT_DELETION_GRACE_DAYS,
    supportEmail,
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

function hashCode(userId: string, code: string) {
  return createHash('sha256').update(`${userId}:${code}`).digest('hex')
}

/** Manda al correo de la cuenta un código de 6 dígitos para confirmar la eliminación. */
export async function sendAccountDeletionCode(params: { userId: string; email: string | null }, now = new Date()) {
  if (!params.email) throw new AccountDeletionError('La cuenta no tiene correo. Escribinos a soporte.', 400)
  const admin = createAdminSupabase()

  const { data: existing } = await admin.from('account_deletion_codes').select('created_at').eq('user_id', params.userId).maybeSingle()
  if (existing && now.getTime() - Date.parse(existing.created_at as string) < CODE_RESEND_SECONDS * 1000) {
    throw new AccountDeletionError('Ya te mandamos un código. Esperá un minuto para pedir otro.', 429)
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const { error } = await admin.from('account_deletion_codes').upsert({
    user_id: params.userId,
    code_hash: hashCode(params.userId, code),
    expires_at: new Date(now.getTime() + ACCOUNT_DELETION_CODE_TTL_MINUTES * 60_000).toISOString(),
    attempts: 0,
    created_at: now.toISOString(),
  })
  if (error) throw new AccountDeletionError('No se pudo generar el código. Probá de nuevo.', 500)

  const sent = await sendEmail({
    to: params.email,
    subject: 'Tu código para eliminar la cuenta',
    html: renderAccountDeletionCodeEmail({ code, minutes: ACCOUNT_DELETION_CODE_TTL_MINUTES, supportEmail: await accountSupportEmail() }),
  })
  if (!sent.ok || sent.skipped) {
    await admin.from('account_deletion_codes').delete().eq('user_id', params.userId)
    throw new AccountDeletionError('No se pudo mandar el correo con el código. Probá de nuevo más tarde.', 502)
  }
  return { expiresInMinutes: ACCOUNT_DELETION_CODE_TTL_MINUTES }
}

/** Verifica el código: vence, admite pocos intentos y sirve una sola vez. */
async function verifyCode(userId: string, code: string, now = new Date()) {
  const admin = createAdminSupabase()
  const { data } = await admin.from('account_deletion_codes').select('code_hash, expires_at, attempts').eq('user_id', userId).maybeSingle()
  if (!data || Date.parse(data.expires_at as string) <= now.getTime()) {
    throw new AccountDeletionError('El código venció o no existe. Pedí uno nuevo.', 403)
  }
  const attempts = Number(data.attempts) || 0
  if (attempts >= ACCOUNT_DELETION_CODE_MAX_ATTEMPTS) {
    throw new AccountDeletionError('Probaste demasiadas veces. Pedí un código nuevo.', 429)
  }
  const expected = Buffer.from(data.code_hash as string, 'hex')
  const received = Buffer.from(hashCode(userId, code.trim()), 'hex')
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    await admin.from('account_deletion_codes').update({ attempts: attempts + 1 }).eq('user_id', userId)
    throw new AccountDeletionError('El código no es correcto.', 403)
  }
  await admin.from('account_deletion_codes').delete().eq('user_id', userId)
}

export async function requestAccountDeletion(params: {
  userId: string
  email: string | null
  confirmation: AccountDeletionConfirmation
  source: 'app' | 'web'
  reason?: string | null
}) {
  if (!params.email) throw new AccountDeletionError('La cuenta no tiene correo para confirmar. Escribinos a soporte.', 400)
  if (params.confirmation.method === 'password') {
    if (!(await verifyPassword(params.email, params.confirmation.password))) {
      throw new AccountDeletionError('La contraseña no es correcta.', 403)
    }
  } else {
    await verifyCode(params.userId, params.confirmation.code)
  }

  const admin = createAdminSupabase()

  // Primero se bloquea el inicio de sesión: si eso falla, no se cambia nada más
  // y no se le dice a la persona que su cuenta quedó bloqueada.
  const { error: banError } = await admin.auth.admin.updateUserById(params.userId, { ban_duration: BAN_DURATION })
  if (banError) {
    console.error('[account-deletion] No se pudo bloquear el usuario', { userId: params.userId, code: banError.code })
    throw new AccountDeletionError('No se pudo bloquear la cuenta. No se hizo ningún cambio; probá de nuevo.', 500)
  }

  const { data, error } = await admin.rpc('request_account_deletion', {
    p_user_id: params.userId,
    p_source: params.source,
    p_reason: params.reason ?? null,
  })
  if (error || !data) {
    // Sin pedido registrado, la cuenta no queda bloqueada a medias.
    await admin.auth.admin.updateUserById(params.userId, { ban_duration: 'none' }).catch(() => undefined)
    throw new AccountDeletionError('No se pudo registrar el pedido. Probá de nuevo.', 500)
  }
  const request = data as DeletionRequestRow

  const closedIds = request.closed_organization_ids ?? []
  // El pedido ya quedó registrado: si falla el correo, no se informa como error.
  let emailSent = false
  try {
    const { data: closed } = closedIds.length
      ? await admin.from('organizations').select('name').in('id', closedIds)
      : { data: [] as Array<{ name: string }> }
    const sent = await sendEmail({
      to: params.email,
      subject: 'Recibimos tu pedido de eliminar la cuenta',
      html: renderAccountDeletionRequestedEmail({
        scheduledFor: request.scheduled_for,
        closedOrganizations: (closed ?? []).map((row) => row.name),
        supportEmail: await accountSupportEmail(),
        retentionYears: ACCOUNT_RECORDS_RETENTION_YEARS,
      }),
    })
    emailSent = Boolean(sent?.ok && !sent.skipped)
  } catch (sendError) {
    console.error('[account-deletion] No se pudo mandar la confirmación', { sendError })
  }

  return { scheduledFor: request.scheduled_for, closedOrganizations: closedIds.length, emailSent }
}

export type PendingAccountDeletion = {
  id: string
  email: string | null
  source: string
  requestedAt: string
  scheduledFor: string
  closedOrganizations: number
}

/** Pedidos pendientes, para que soporte los vea y pueda cancelarlos. */
export async function listPendingAccountDeletions(): Promise<PendingAccountDeletion[]> {
  const { data, error } = await createAdminSupabase()
    .from('account_deletion_requests')
    .select('id, email, source, requested_at, scheduled_for, closed_organization_ids')
    .eq('status', 'pending')
    .order('scheduled_for', { ascending: true })
    .limit(200)
  if (error) throw new Error('No se pudieron leer los pedidos de eliminación')
  return (data ?? []).map((row) => ({
    id: row.id as string,
    email: (row.email as string | null) ?? null,
    source: row.source as string,
    requestedAt: row.requested_at as string,
    scheduledFor: row.scheduled_for as string,
    closedOrganizations: ((row.closed_organization_ids as string[] | null) ?? []).length,
  }))
}

/**
 * Cancela un pedido pendiente: desbloquea el usuario y restaura perfil,
 * membresías, suscripción y tienda como estaban.
 */
export async function cancelAccountDeletion(requestId: string, actorId: string) {
  const admin = createAdminSupabase()
  const { data: row, error: readError } = await admin
    .from('account_deletion_requests').select('id, user_id, status').eq('id', requestId).maybeSingle()
  if (readError) throw new AccountDeletionError('No se pudo leer el pedido.', 500)
  if (!row || row.status !== 'pending') throw new AccountDeletionError('El pedido ya no está pendiente.', 409)
  const userId = row.user_id as string

  // Desbloquear primero no expone nada: el perfil sigue inactivo y las
  // membresías suspendidas hasta que la base restaure el estado.
  const { error: unbanError } = await admin.auth.admin.updateUserById(userId, { ban_duration: 'none' })
  if (unbanError) throw new AccountDeletionError('No se pudo desbloquear el usuario. No se hizo ningún cambio.', 500)

  const { error } = await admin.rpc('cancel_account_deletion', { p_request_id: requestId, p_actor_id: actorId })
  if (error) {
    await admin.auth.admin.updateUserById(userId, { ban_duration: BAN_DURATION }).catch(() => undefined)
    throw new AccountDeletionError('No se pudo cancelar el pedido. Probá de nuevo.', 500)
  }
  return { userId }
}

/** Borra las fotos de perfil del usuario (carpeta avatars/<user_id>/). */
async function removeAvatarFiles(userId: string) {
  const storage = createAdminSupabase().storage.from(AVATAR_BUCKET)
  const { data, error } = await storage.list(userId, { limit: 1000 })
  if (error) throw new Error(`No se pudieron listar las fotos: ${error.message}`)
  const paths = (data ?? []).filter((file) => file.name).map((file) => `${userId}/${file.name}`)
  if (!paths.length) return
  const { error: removeError } = await storage.remove(paths)
  if (removeError) throw new Error(`No se pudieron borrar las fotos: ${removeError.message}`)
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
      // Primero Auth y la foto: si falla, el pedido sigue pendiente y se reintenta mañana.
      const { error: authError } = await admin.auth.admin.updateUserById(row.user_id as string, {
        email: `eliminada-${row.id}@cuentas-eliminadas.invalid`,
        email_confirm: true,
        phone: '',
        user_metadata: {},
        ban_duration: BAN_DURATION,
      })
      if (authError) throw new Error(authError.message)
      await removeAvatarFiles(row.user_id as string)
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
