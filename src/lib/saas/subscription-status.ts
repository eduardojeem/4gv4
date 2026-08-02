const HARD_BLOCKED_STATUSES = new Set(['suspended', 'cancelled', 'canceled'])
const EXPIRED_STATUSES = new Set(['past_due', 'expired', 'unpaid'])

type SubscriptionStatusInput = {
  status?: string | null
  paymentStatus?: string | null
  periodEndsAt?: string | null
  trialEndsAt?: string | null
}

function timestamp(value?: string | null) {
  if (!value) return null
  const result = new Date(value).getTime()
  return Number.isFinite(result) ? result : null
}

export function evaluateSubscriptionStatus(
  input: SubscriptionStatusInput,
  now = new Date()
) {
  const status = input.status?.toLowerCase() ?? null
  const paymentStatus = input.paymentStatus?.toLowerCase() ?? null
  const nowTime = now.getTime()
  const periodEndsAt = timestamp(input.periodEndsAt)
  const trialEndsAt = timestamp(input.trialEndsAt)
  const isBlocked = status ? HARD_BLOCKED_STATUSES.has(status) : false
  const isTrialing = status === 'trialing'
  const hasActivePaidPeriod = status === 'active'
    && periodEndsAt !== null
    && periodEndsAt > nowTime
  const isExpired = Boolean(
    (status && EXPIRED_STATUSES.has(status))
    || (paymentStatus === 'unpaid' && !hasActivePaidPeriod)
    || (status === 'active' && periodEndsAt !== null && periodEndsAt <= nowTime)
  )

  const daysLeft = (target: number | null) => target === null
    ? null
    : Math.max(0, Math.ceil((target - nowTime) / 86_400_000))

  return {
    status,
    isBlocked,
    isExpired,
    isTrialing,
    trialDaysLeft: isTrialing ? daysLeft(trialEndsAt) : null,
    periodDaysLeft: status === 'active' ? daysLeft(periodEndsAt) : null,
  }
}
