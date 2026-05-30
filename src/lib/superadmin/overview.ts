import { createAdminSupabase } from '@/lib/supabase/admin'

type TableCount = {
  key: string
  label: string
  table: string
}

const PLATFORM_COUNTS: TableCount[] = [
  { key: 'organizations', label: 'Empresas', table: 'organizations' },
  { key: 'members', label: 'Miembros', table: 'organization_members' },
  { key: 'products', label: 'Productos', table: 'products' },
  { key: 'sales', label: 'Ventas', table: 'sales' },
  { key: 'repairs', label: 'Reparaciones', table: 'repairs' },
  { key: 'customers', label: 'Clientes', table: 'customers' },
]

export type SuperAdminOverview = {
  counts: Array<{
    key: string
    label: string
    value: number
    available: boolean
  }>
  recentOrganizations: Array<{
    id: string
    name: string
    slug: string
    plan: string | null
    created_at: string | null
  }>
  planDistribution: Array<{
    plan: string
    count: number
  }>
  subscriptionHealth: {
    total: number
    active: number
    trialing: number
    atRisk: number
    canceled: number
    canceling: number
    renewalsSoon: number
    estimatedMrr: number
  }
  attentionItems: Array<{
    id: string
    organization_id: string
    organization_name: string
    organization_slug: string | null
    plan: string
    status: string
    current_period_ends_at: string | null
    trial_ends_at: string | null
    cancel_at_period_end: boolean
    reason: string
  }>
}

type SubscriptionRow = {
  id: string
  organization_id: string
  plan: string | null
  status: string | null
  current_period_ends_at: string | null
  trial_ends_at: string | null
  cancel_at_period_end: boolean | null
}

type OrganizationLookupRow = {
  id: string
  name: string
  slug: string
}

const ESTIMATED_MONTHLY_PRICES: Record<string, number> = {
  FREE: 0,
  BASIC: 29,
  PRO: 79,
  ENTERPRISE: 199,
}

function daysUntil(value: string | null) {
  if (!value) return null
  const today = new Date()
  const target = new Date(value)
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

function getAttentionReason(subscription: SubscriptionRow) {
  const renewalDays = daysUntil(subscription.current_period_ends_at)
  const trialDays = daysUntil(subscription.trial_ends_at)

  if (subscription.status === 'past_due' || subscription.status === 'unpaid') return 'Pago pendiente'
  if (subscription.cancel_at_period_end) return 'Cancela al cierre'
  if (trialDays !== null && trialDays >= 0 && trialDays <= 7) return 'Trial por terminar'
  if (renewalDays !== null && renewalDays >= 0 && renewalDays <= 7) return 'Renovacion proxima'
  if (renewalDays !== null && renewalDays < 0) return 'Periodo vencido'
  return 'Revisar'
}

export async function getSuperAdminOverview(): Promise<SuperAdminOverview> {
  const admin = createAdminSupabase()

  const countsPromise = Promise.all(
    PLATFORM_COUNTS.map(async (item) => {
      const { count, error } = await admin
        .from(item.table)
        .select('id', { count: 'exact', head: true })

      return {
        key: item.key,
        label: item.label,
        value: error ? 0 : count ?? 0,
        available: !error,
      }
    })
  )

  const recentOrganizationsPromise = admin
    .from('organizations')
    .select('id, name, slug, plan, created_at')
    .order('created_at', { ascending: false })
    .limit(8)

  const organizationsForPlansPromise = admin
    .from('organizations')
    .select('id, name, slug, plan')

  const subscriptionsPromise = admin
    .from('subscriptions')
    .select('id, organization_id, plan, status, current_period_ends_at, trial_ends_at, cancel_at_period_end')

  const [
    counts,
    { data: recentOrganizations },
    { data: organizationsForPlans },
    { data: subscriptionsData },
  ] = await Promise.all([
    countsPromise,
    recentOrganizationsPromise,
    organizationsForPlansPromise,
    subscriptionsPromise,
  ])

  const planCounts = new Map<string, number>()
  ;(organizationsForPlans ?? []).forEach((row: { plan?: string | null }) => {
    const plan = row.plan || 'FREE'
    planCounts.set(plan, (planCounts.get(plan) ?? 0) + 1)
  })

  const subscriptions = (subscriptionsData ?? []) as SubscriptionRow[]
  const organizationLookup = new Map(
    ((organizationsForPlans ?? []) as OrganizationLookupRow[]).map((organization) => [organization.id, organization])
  )
  const active = subscriptions.filter((subscription) => subscription.status === 'active').length
  const trialing = subscriptions.filter((subscription) => subscription.status === 'trialing').length
  const atRisk = subscriptions.filter((subscription) => subscription.status === 'past_due' || subscription.status === 'unpaid').length
  const canceled = subscriptions.filter((subscription) => subscription.status === 'canceled').length
  const canceling = subscriptions.filter((subscription) => subscription.cancel_at_period_end).length
  const renewalsSoon = subscriptions.filter((subscription) => {
    const renewalDays = daysUntil(subscription.current_period_ends_at)
    return renewalDays !== null && renewalDays >= 0 && renewalDays <= 14
  }).length
  const estimatedMrr = subscriptions
    .filter((subscription) => subscription.status === 'active' || subscription.status === 'trialing')
    .reduce((sum, subscription) => sum + (ESTIMATED_MONTHLY_PRICES[(subscription.plan || 'FREE').toUpperCase()] ?? 0), 0)

  const attentionItems = subscriptions
    .filter((subscription) => {
      const renewalDays = daysUntil(subscription.current_period_ends_at)
      const trialDays = daysUntil(subscription.trial_ends_at)
      return (
        subscription.status === 'past_due' ||
        subscription.status === 'unpaid' ||
        Boolean(subscription.cancel_at_period_end) ||
        (renewalDays !== null && renewalDays <= 14) ||
        (trialDays !== null && trialDays >= 0 && trialDays <= 14)
      )
    })
    .slice(0, 6)
    .map((subscription) => {
      const organization = organizationLookup.get(subscription.organization_id)
      return {
        id: subscription.id,
        organization_id: subscription.organization_id,
        organization_name: organization?.name || 'Organizacion sin nombre',
        organization_slug: organization?.slug || null,
        plan: subscription.plan || 'FREE',
        status: subscription.status || 'sin_estado',
        current_period_ends_at: subscription.current_period_ends_at,
        trial_ends_at: subscription.trial_ends_at,
        cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
        reason: getAttentionReason(subscription),
      }
    })

  return {
    counts,
    recentOrganizations: (recentOrganizations ?? []) as SuperAdminOverview['recentOrganizations'],
    planDistribution: Array.from(planCounts.entries())
      .map(([plan, count]) => ({ plan, count }))
      .sort((a, b) => b.count - a.count),
    subscriptionHealth: {
      total: subscriptions.length,
      active,
      trialing,
      atRisk,
      canceled,
      canceling,
      renewalsSoon,
      estimatedMrr,
    },
    attentionItems,
  }
}
