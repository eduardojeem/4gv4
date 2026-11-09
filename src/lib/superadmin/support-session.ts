import { cookies } from 'next/headers'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const SUPPORT_COOKIE = 'sa_support_session'
import { SUPPORT_REASON_MIN_LENGTH, SUPPORT_REASON_MAX_LENGTH, SUPPORT_SESSION_TTL_MINUTES } from './support-session-policy'
export { SUPPORT_SESSION_TTL_MINUTES } from './support-session-policy'

/** Reserved configuration: existing operational routes do not consume this flag.
 * A support session records assistance; it does not grant permissions or change tenant context.
 */
export const SUPPORT_MODE_ENFORCED = process.env.SUPPORT_MODE_ENFORCED === 'true'

export class SupportSessionsTableMissingError extends Error {
  constructor() {
    super('SUPPORT_SESSIONS_TABLE_MISSING')
    this.name = 'SupportSessionsTableMissingError'
  }
}

export interface ActiveSupportSession {
  id: string
  organizationId: string
  organizationName: string | null
  organizationSlug: string | null
  reason: string
  expiresAt: string
}

function isMissingTableError(message: string | undefined): boolean {
  const normalized = (message || '').toLowerCase()
  return (
    normalized.includes('support_sessions') &&
    (normalized.includes('does not exist') ||
      normalized.includes('could not find') ||
      normalized.includes('relation'))
  )
}

/**
 * Create a support session row. Returns the session id and expiry.
 * Throws {@link SupportSessionsTableMissingError} if the migration isn't applied.
 */
export async function createSupportSession(params: {
  superAdminId: string
  organizationId: string
  reason: string
  ip?: string | null
  userAgent?: string | null
}): Promise<{ id: string; expiresAt: string }> {
  if (!params.superAdminId || params.reason.trim().length < SUPPORT_REASON_MIN_LENGTH || params.reason.trim().length > SUPPORT_REASON_MAX_LENGTH) throw new Error('Datos de soporte inválidos.')
  const admin = createAdminSupabase()
  const expiresAt = new Date(Date.now() + SUPPORT_SESSION_TTL_MINUTES * 60 * 1000).toISOString()

  const { data, error } = await admin
    .from('support_sessions')
    .insert({
      super_admin_id: params.superAdminId,
      organization_id: params.organizationId,
      reason: params.reason.trim(),
      expires_at: expiresAt,
      ip_address: params.ip ?? null,
      user_agent: params.userAgent ?? null,
    })
    .select('id, expires_at')
    .single()

  if (error || !data) {
    if (isMissingTableError(error?.message)) {
      throw new SupportSessionsTableMissingError()
    }
    throw new Error(error?.message || 'No se pudo crear la sesión de soporte.')
  }

  return { id: data.id as string, expiresAt: data.expires_at as string }
}

/** End only this authenticated actor's session; failures must remain retryable. */
export async function endSupportSession(sessionId: string, superAdminId: string): Promise<void> {
  if (!superAdminId) throw new Error('Falta el actor de soporte.')
  const admin = createAdminSupabase()
  const { error } = await admin
    .from('support_sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('super_admin_id', superAdminId)
    .is('ended_at', null)
  if (error) throw new Error('No se pudo cerrar la sesión de soporte.')
}

/**
 * Resolve the currently-active support session from the cookie, validating it
 * against the DB (not ended, not expired). Returns null if none/invalid, or if
 * the table doesn't exist yet (graceful — never throws).
 */
export async function getActiveSupportSession(superAdminId: string): Promise<ActiveSupportSession | null> {
  if (!superAdminId) return null
  try {
    const cookieStore = await cookies()
    const sessionId = cookieStore.get(SUPPORT_COOKIE)?.value
    if (!sessionId) return null

    const admin = createAdminSupabase()
    const { data, error } = await admin
      .from('support_sessions')
      .select('id, super_admin_id, organization_id, reason, expires_at, ended_at, organization:organizations(name, slug)')
      .eq('id', sessionId)
      .eq('super_admin_id', superAdminId)
      .maybeSingle()

    if (error || !data || data.super_admin_id !== superAdminId) return null
    if (data.ended_at) return null
    const expiry = new Date(data.expires_at as string).getTime()
    if (!Number.isFinite(expiry) || expiry <= Date.now()) return null

    const organization = Array.isArray(data.organization) ? data.organization[0] : data.organization

    return {
      id: data.id as string,
      organizationId: data.organization_id as string,
      organizationName: (organization as { name?: string } | null)?.name ?? null,
      organizationSlug: (organization as { slug?: string } | null)?.slug ?? null,
      reason: data.reason as string,
      expiresAt: data.expires_at as string,
    }
  } catch {
    return null
  }
}

/**
 * Gate helper for org-scoped super_admin actions. Returns the active session for
 * the given org and authenticated actor (or null). This helper grants no permissions.
 */
export async function getSupportSessionForOrg(organizationId: string, superAdminId: string): Promise<ActiveSupportSession | null> {
  const session = await getActiveSupportSession(superAdminId)
  if (!session) return null
  return session.organizationId === organizationId ? session : null
}
