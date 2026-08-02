type MemberLike = {
  role: string | null
  status: string | null
}

type SubscriptionLike = {
  subscription_status: string | null
}

export function getEffectiveOrganizationPlan(
  organizationPlan: string | null,
  subscriptionPlan: string | null
) {
  return subscriptionPlan || organizationPlan || 'FREE'
}

export function countOrganizationsWithoutSubscription(organizations: SubscriptionLike[]) {
  return organizations.filter((organization) => !organization.subscription_status).length
}

export function summarizeOrganizationMembers(members: MemberLike[]) {
  const staff = members.filter((member) => member.role !== 'customer')
  return {
    staffTotal: staff.length,
    staffActive: staff.filter((member) => member.status === 'active').length,
    staffInvited: staff.filter((member) => member.status === 'invited').length,
    staffSuspended: staff.filter((member) => member.status === 'suspended').length,
    customersTotal: members.filter((member) => member.role === 'customer').length,
  }
}

export function getSubscriptionTiming(
  status: string | null,
  trialEndsAt: string | null,
  periodEndsAt: string | null,
  now = new Date()
): { label: string; urgent: boolean } | null {
  const targetValue = status === 'trialing'
    ? trialEndsAt
    : status === 'active'
      ? periodEndsAt
      : null

  if (!targetValue) return null
  const target = new Date(targetValue)
  if (Number.isNaN(target.getTime())) return null

  const differenceMs = target.getTime() - now.getTime()
  if (differenceMs < 0) {
    const days = Math.max(1, Math.ceil(Math.abs(differenceMs) / 86400000))
    return { label: `Venció hace ${days} día${days === 1 ? '' : 's'}`, urgent: true }
  }

  const days = Math.ceil(differenceMs / 86400000)
  if (days === 0) return { label: status === 'trialing' ? 'Prueba vence hoy' : 'Renueva hoy', urgent: true }
  if (status === 'trialing') return { label: `${days}d de prueba restantes`, urgent: days <= 3 }
  return { label: `Renueva en ${days}d`, urgent: days <= 7 }
}
