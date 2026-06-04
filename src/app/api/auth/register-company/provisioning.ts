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
  identities?: unknown[] | null
}

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
