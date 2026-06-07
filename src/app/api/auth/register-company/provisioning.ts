const ONBOARDING_REDIRECT_PATH = '/auth/callback?next=/dashboard/onboarding'

type SupabaseLikeResult = {
  error?: {
    message?: string
  } | null
}

export type ProvisioningStepResult = {
  name: string
  result: PromiseSettledResult<SupabaseLikeResult>
}

type AuthUserWithIdentities = {
  id: string
  identities?: unknown[] | null
}

// Minimal admin client type — enough to do DB + auth admin ops.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any

function getConfiguredAppOrigin() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL

  if (configuredUrl) {
    try {
      return new URL(configuredUrl).origin
    } catch {
      // Ignore invalid env configuration and fall back to request URL below.
    }
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}`
  }

  return null
}

export function buildCompanyRegistrationRedirectUrl(request: Request) {
  const origin = getConfiguredAppOrigin() ?? new URL(request.url).origin
  return `${origin}${ONBOARDING_REDIRECT_PATH}`
}

export function isExistingConfirmedAuthUser(user: AuthUserWithIdentities) {
  return Array.isArray(user.identities) && user.identities.length === 0
}

function messageFromUnknown(value: unknown) {
  if (value instanceof Error) return value.message
  if (typeof value === 'object' && value && 'message' in value) {
    const message = (value as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return 'Error desconocido'
}

export function getProvisioningFailures(steps: ProvisioningStepResult[]) {
  return steps.flatMap(({ name, result }) => {
    if (result.status === 'rejected') {
      return [{ name, message: messageFromUnknown(result.reason) }]
    }

    if (result.value.error) {
      return [{ name, message: result.value.error.message || 'Error desconocido' }]
    }

    return []
  })
}

/**
 * Cleans up all rows created during a failed provisioning attempt.
 *
 * Order matters:
 * 1. Delete org-scoped rows that have FK references to `organizations` (so the
 *    org row itself can be deleted without FK violations).
 * 2. Delete the organization row.
 * 3. Delete user-level rows (profiles, user_roles) — only for brand-new users
 *    (identities.length > 0) to avoid wiping a pre-existing account.
 * 4. Delete the auth user last (depends on nothing else).
 *
 * All deletions run with `Promise.allSettled` to ensure we attempt every
 * cleanup even if one fails. Errors are logged but never rethrown — cleanup is
 * best-effort and must not mask the original failure.
 */
export async function cleanupPartialProvisioning(
  admin: AdminClient,
  user: AuthUserWithIdentities,
  organizationId: string,
  context: Record<string, unknown>,
  logger: { error: (msg: string, meta?: Record<string, unknown>) => void },
) {
  const userId = user.id
  const isNewUser = Array.isArray(user.identities) && user.identities.length > 0

  // Step 1: remove org-scoped rows in parallel
  await Promise.allSettled([
    admin.from('branches').delete().eq('organization_id', organizationId),
    admin.from('organization_members').delete().eq('organization_id', organizationId),
    admin.from('organization_settings').delete().eq('organization_id', organizationId),
    admin.from('subscriptions').delete().eq('organization_id', organizationId),
  ])

  // Step 2: delete the organization row
  const { error: orgDeleteError } = await admin
    .from('organizations')
    .delete()
    .eq('id', organizationId)

  if (orgDeleteError) {
    logger.error('Failed to cleanup organization after provisioning failure', {
      ...context,
      organizationId,
      error: orgDeleteError.message,
    })
  }

  // Step 3 + 4: user-level rows + auth user (only for brand-new registrations)
  if (isNewUser) {
    await Promise.allSettled([
      admin.from('profiles').delete().eq('id', userId),
      admin.from('user_roles').delete().eq('user_id', userId),
    ])

    const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId)
    if (authDeleteError) {
      logger.error('Failed to cleanup auth user after provisioning failure', {
        ...context,
        userId,
        error: authDeleteError.message,
      })
    }
  }
}
