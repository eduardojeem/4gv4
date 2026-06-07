import { cookies } from 'next/headers'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const SUPPORT_COOKIE = 'sa_support_session'
export const SUPPORT_SESSION_TTL_MINUTES = 30

/**
 * Hard enforcement is opt-in via env so the feature can be rolled out safely:
 * before the migration is applied (and you're ready), cross-tenant actions still
 * work but are flagged; once you set SUPPORT_MODE_ENFORCED=true they're blocked
 * unless a support session is active.
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
  const admin = createAdminSupabase()
  const expiresAt = new Date(Date.now() + SUPPORT_SESSION_TTL_MINUTES * 60 * 1000).toISOString()

  const { data, error } = await admin
    .from('support_sessions')
    .insert({
      super_admin_id: params.superAdminId,
      organization_id: params.organizationId,
      reason: params.reason,
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

/** Mark a support session as ended (best-effort). */
export async function endSupportSession(sessionId: string): Promise<void> {
  try {
    const admin = createAdminSupabase()
    await admin
      .from('support_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sessionId)
      .is('ended_at', null)
  } catch {
    // best-effort
  }
}

/**
 * Resolve the currently-active support session from the cookie, validating it
 * against the DB (not ended, not expired). Returns null if none/invalid, or if
 * the table doesn't exist yet (graceful — never throws).
 */
export async function getActiveSupportSession(): Promise<ActiveSupportSession | null> {
  try {
    const cookieStore = await cookies()
    const sessionId = cookieStore.get(SUPPORT_COOKIE)?.value
    if (!sessionId) return null

    const admin = createAdminSupabase()
    const { data, error } = await admin
      .from('support_sessions')
      .select('id, organization_id, reason, expires_at, ended_at, organization:organizations(name, slug)')
      .eq('id', sessionId)
      .maybeSingle()

    if (error || !data) return null
    if (data.ended_at) return null
    if (new Date(data.expires_at as string).getTime() <= Date.now()) return null

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
 * the given org (or null). When SUPPORT_MODE_ENFORCED is on, callers should deny
 * the action if this returns null.
 */
export async function getSupportSessionForOrg(organizationId: string): Promise<ActiveSupportSession | null> {
  const session = await getActiveSupportSession()
  if (!session) return null
  return session.organizationId === organizationId ? session : null
}
