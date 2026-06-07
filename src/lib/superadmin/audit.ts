import { createAdminSupabase } from '@/lib/supabase/admin'
import { getClientIp } from '@/lib/rate-limiter'

export interface SuperAdminAuditEntry {
  /** The super_admin performing the action. */
  actorId: string
  actorEmail?: string | null
  /** create | update | delete | role_change | suspend | … */
  action: string
  /** Affected table/resource, e.g. 'organizations', 'subscriptions'. */
  resource: string
  resourceId?: string | null
  /** Tenant the action targets (for cross-tenant traceability). */
  organizationId?: string | null
  oldValues?: Record<string, unknown> | null
  newValues?: Record<string, unknown> | null
  /** Pass the request to capture IP and user-agent. */
  request?: Request
  /** Matches the superadmin audit-logs dashboard vocabulary. */
  severity?: 'low' | 'medium' | 'high' | 'critical'
}

/**
 * Central, fire-and-forget audit logger for super_admin (platform operator)
 * actions on tenants. Writes to `audit_log` so every cross-organization change
 * is traceable: who, what, which org, before/after, when, from where.
 *
 * Auditing must never break the action it records — failures are swallowed.
 */
export async function logSuperAdminAction(entry: SuperAdminAuditEntry): Promise<void> {
  try {
    const admin = createAdminSupabase()
    const ip = entry.request ? getClientIp(entry.request) : null
    const userAgent = entry.request?.headers.get('user-agent') ?? null

    await admin.from('audit_log').insert({
      user_id: entry.actorId,
      action: entry.action,
      resource: entry.resource,
      resource_id: entry.resourceId ?? null,
      old_values: (entry.oldValues ?? null) as never,
      new_values: (entry.newValues ?? null) as never,
      ip_address: ip,
      user_agent: userAgent,
      severity: entry.severity ?? 'medium',
      details: {
        context: 'superadmin',
        actor_email: entry.actorEmail ?? null,
        organization_id: entry.organizationId ?? null,
      } as never,
    })
  } catch (error) {
    console.warn(
      '[superadmin audit] failed to write entry:',
      error instanceof Error ? error.message : error
    )
  }
}
