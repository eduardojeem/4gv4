import { createAdminSupabase } from '@/lib/supabase/admin'
import { normalizePlanCode } from '@/lib/saas/subscription-service'
import { chunkValues, fetchAllRows } from '@/lib/superadmin/fetch-all-rows'
import {
  SubscriptionsDashboard,
  type SuperAdminSubscription,
} from '@/components/superadmin/subscriptions/subscriptions-dashboard'

type SubscriptionRow = {
  id: string
  organization_id: string
  plan: string | null
  status: string | null
  provider: string | null
  provider_customer_id: string | null
  provider_subscription_id: string | null
  trial_ends_at: string | null
  current_period_starts_at: string | null
  current_period_ends_at: string | null
  cancel_at_period_end: boolean | null
  created_at: string | null
  updated_at: string | null
}

type OrganizationRow = {
  id: string
  name: string
  slug: string
  plan: string | null
  owner_id: string | null
}

type ProfileRow = {
  id: string
  email: string | null
  full_name: string | null
}

type PlanRow = {
  code: string
  name: string
  limits: Record<string, unknown> | null
  modules: string[] | null
  is_active: boolean | null
}

type CommercialPlanRow = {
  tier: string
  name: string
  price: number | null
  is_active: boolean | null
}

export default async function SuperAdminSubscriptionsPage() {
  const admin = createAdminSupabase()

  const [subscriptionsResult, { data: plansData, error: plansError }, { data: commercialPlansData, error: commercialPlansError }] = await Promise.all([
    fetchAllRows<SubscriptionRow>((from, to) =>
      admin
        .from('subscriptions')
        .select(
          'id, organization_id, plan, status, provider, provider_customer_id, provider_subscription_id, trial_ends_at, current_period_starts_at, current_period_ends_at, cancel_at_period_end, created_at, updated_at'
        )
        .order('updated_at', { ascending: false })
        .range(from, to)
    ),
    admin
      .from('plans')
      .select('code, name, limits, modules, is_active')
      .order('code', { ascending: true }),
    admin
      .from('subscription_plans')
      .select('tier, name, price, is_active')
      .order('price', { ascending: true }),
  ])

  if (plansError || commercialPlansError) {
    throw new Error(plansError?.message || commercialPlansError?.message || 'No se pudieron cargar los planes.')
  }

  const subscriptions = subscriptionsResult
  const organizationIds = Array.from(new Set(subscriptions.map((subscription) => subscription.organization_id).filter(Boolean)))

  const organizationsData = organizationIds.length
    ? (await Promise.all(chunkValues(organizationIds).map(async (ids) => {
        const { data, error } = await admin
          .from('organizations')
          .select('id, name, slug, plan, owner_id')
          .in('id', ids)
        if (error) throw new Error(error.message)
        return data ?? []
      }))).flat()
    : []

  const organizations = (organizationsData ?? []) as OrganizationRow[]
  const ownerIds = Array.from(new Set(organizations.map((organization) => organization.owner_id).filter(Boolean))) as string[]

  const profilesData = ownerIds.length
    ? (await Promise.all(chunkValues(ownerIds).map(async (ids) => {
        const { data, error } = await admin
          .from('profiles')
          .select('id, email, full_name')
          .in('id', ids)
        if (error) throw new Error(error.message)
        return data ?? []
      }))).flat()
    : []

  // Load member counts and product counts per organization (using count queries for performance)
  const memberCountMap = new Map<string, number>()
  const productCountMap = new Map<string, number>()
  const salesCountMap = new Map<string, number>()

  if (organizationIds.length > 0) {
    // Use individual count queries per org is too slow for many orgs.
    // Instead, use a single grouped RPC or raw count approach.
    // For now, use lightweight select with head:true per batch.
    const { data: usageRows, error: usageError } = await admin.rpc('get_superadmin_org_usage_counts', {
      p_organization_ids: organizationIds,
    })
    if (usageError) throw new Error(usageError.message)

    for (const row of (usageRows ?? []) as Array<{
      organization_id: string
      members_count: number
      products_count: number
      sales_count: number
    }>) {
      memberCountMap.set(row.organization_id, Number(row.members_count) || 0)
      productCountMap.set(row.organization_id, Number(row.products_count) || 0)
      salesCountMap.set(row.organization_id, Number(row.sales_count) || 0)
    }
  }

  const organizationsById = new Map(organizations.map((organization) => [organization.id, organization]))
  const profilesById = new Map(((profilesData ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]))
  const plansByCode = new Map(((plansData ?? []) as PlanRow[]).map((plan) => [plan.code, plan]))
  const commercialPlansByCode = new Map(
    ((commercialPlansData ?? []) as CommercialPlanRow[]).map((plan) => [normalizePlanCode(plan.tier), plan])
  )
  const planOptions = Array.from(commercialPlansByCode.keys()).sort()

  const dashboardSubscriptions: SuperAdminSubscription[] = subscriptions.map((subscription) => {
    const organization = organizationsById.get(subscription.organization_id)
    const owner = organization?.owner_id ? profilesById.get(organization.owner_id) : null
    const plan = subscription.plan || organization?.plan || 'FREE'
    const planDetails = plansByCode.get(plan)
    const commercialPlan = commercialPlansByCode.get(normalizePlanCode(plan))

    return {
      id: subscription.id,
      organization_id: subscription.organization_id,
      organization_name: organization?.name || 'Organizacion sin nombre',
      organization_slug: organization?.slug || null,
      organization_plan: organization?.plan || null,
      owner_id: organization?.owner_id || null,
      owner_name: owner?.full_name || null,
      owner_email: owner?.email || null,
      plan,
      plan_details: planDetails
        ? {
            code: planDetails.code,
            name: commercialPlan?.name || planDetails.name,
            price_monthly: Number(commercialPlan?.price || 0),
            currency: 'PYG',
            limits: planDetails.limits || {},
            modules: planDetails.modules || [],
            is_active: planDetails.is_active !== false && commercialPlan?.is_active !== false,
          }
        : null,
      status: subscription.status || 'sin_estado',
      provider: subscription.provider || 'manual',
      provider_customer_id: subscription.provider_customer_id,
      provider_subscription_id: subscription.provider_subscription_id,
      trial_ends_at: subscription.trial_ends_at,
      current_period_starts_at: subscription.current_period_starts_at,
      current_period_ends_at: subscription.current_period_ends_at,
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
      created_at: subscription.created_at,
      updated_at: subscription.updated_at,
      members_count: memberCountMap.get(subscription.organization_id) ?? 0,
      products_count: productCountMap.get(subscription.organization_id) ?? 0,
      sales_count: salesCountMap.get(subscription.organization_id) ?? 0,
    }
  })

  return (
    <SubscriptionsDashboard
      subscriptions={dashboardSubscriptions}
      planOptions={planOptions}
      loadError={
        null
      }
    />
  )
}
