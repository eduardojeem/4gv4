export type CustomerAccessReport = {
  total: number
  standardCustomers: number
  portalActive: number
  needsReview: number
  newInPeriod: number
  adoptionRate: number
}

type CustomerAccessRow = {
  profileId: string | null
  createdAt: string | null
}

type CustomerMembershipRow = {
  userId: string
  status: string | null
}

export function buildCustomerAccessReport(input: {
  customers: CustomerAccessRow[]
  memberships: CustomerMembershipRow[]
  from: Date
  to: Date
}): CustomerAccessReport {
  const activeMemberIds = new Set(
    input.memberships
      .filter((membership) => membership.status === 'active')
      .map((membership) => membership.userId),
  )

  let standardCustomers = 0
  let portalActive = 0
  let needsReview = 0
  let newInPeriod = 0

  for (const customer of input.customers) {
    if (!customer.profileId) standardCustomers += 1
    else if (activeMemberIds.has(customer.profileId)) portalActive += 1
    else needsReview += 1

    if (customer.createdAt) {
      const createdAt = new Date(customer.createdAt)
      if (createdAt >= input.from && createdAt <= input.to) newInPeriod += 1
    }
  }

  const total = input.customers.length
  return {
    total,
    standardCustomers,
    portalActive,
    needsReview,
    newInPeriod,
    adoptionRate: total > 0 ? Math.round((portalActive / total) * 1000) / 10 : 0,
  }
}
