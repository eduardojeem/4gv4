import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { getSubscriptionStatus, getOrganizationPlanInfo } from '@/lib/saas/subscription-service'
import { SubscriptionStatusProvider, type SubscriptionStatusData } from '@/contexts/SubscriptionStatusContext'

const EMPTY: SubscriptionStatusData = {
  status: null, isBlocked: false, isTrialing: false, trialDaysLeft: null, periodDaysLeft: null,
  planCode: 'FREE', planName: 'Free', modules: [], downgradedFromExpiry: false,
  entitledModules: [], enabledModules: null, effectiveModules: [],
  businessVertical: 'general', operatingModel: 'retail',
  moduleTrials: [], trialedModules: [],
  organizationName: null, organizationLogoUrl: null,
}

export async function SubscriptionGate({ children }: { children: React.ReactNode }) {
  let value: SubscriptionStatusData = EMPTY

  try {
    const auth = await resolveRequestAuthUser()
    if (!('reason' in auth)) {
      const organization = await getCurrentOrganizationContext(auth.user.id)
      if (organization) {
        const [sub, planInfo] = await Promise.all([
          getSubscriptionStatus(organization.id),
          getOrganizationPlanInfo(organization.id),
        ])
        value = {
          ...sub,
          planCode: planInfo.code,
          planName: planInfo.name,
          modules: planInfo.modules,
          modulePlanAvailability: planInfo.modulePlanAvailability,
          entitledModules: planInfo.entitledModules,
          enabledModules: planInfo.enabledModules,
          effectiveModules: planInfo.effectiveModules,
          businessVertical: planInfo.businessVertical,
          operatingModel: planInfo.operatingModel,
          downgradedFromExpiry: planInfo.downgradedFromExpiry,
          moduleTrials: planInfo.moduleTrials,
          trialedModules: planInfo.trialedModules,
          organizationName: organization.name,
          organizationLogoUrl: organization.logoUrl,
        }
      }
    }
  } catch {
    value = EMPTY
  }

  return <SubscriptionStatusProvider value={value}>{children}</SubscriptionStatusProvider>
}
