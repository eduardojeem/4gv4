import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { getSubscriptionStatus } from '@/lib/saas/subscription-service'
import { SubscriptionStatusProvider } from '@/contexts/SubscriptionStatusContext'

const EMPTY: Parameters<typeof SubscriptionStatusProvider>[0]['value'] = {
  status: null, isBlocked: false, isTrialing: false, trialDaysLeft: null, periodDaysLeft: null,
}

export async function SubscriptionGate({ children }: { children: React.ReactNode }) {
  try {
    const auth = await resolveRequestAuthUser()
    if ('reason' in auth) {
      return <SubscriptionStatusProvider value={EMPTY}>{children}</SubscriptionStatusProvider>
    }

    const organization = await getCurrentOrganizationContext(auth.user.id)
    if (!organization) {
      return <SubscriptionStatusProvider value={EMPTY}>{children}</SubscriptionStatusProvider>
    }

    const sub = await getSubscriptionStatus(organization.id)
    return <SubscriptionStatusProvider value={sub}>{children}</SubscriptionStatusProvider>
  } catch {
    return <SubscriptionStatusProvider value={EMPTY}>{children}</SubscriptionStatusProvider>
  }
}
