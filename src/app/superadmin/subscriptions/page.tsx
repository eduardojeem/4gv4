import { createAdminSupabase } from '@/lib/supabase/admin'
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

export default async function SuperAdminSubscriptionsPage() {
  const admin = createAdminSupabase()

  const [{ data, error }, { data: plansData }] = await Promise.all([
    admin
      .from('subscriptions')
      .select(
        'id, organization_id, plan, status, provider, provider_customer_id, provider_subscription_id, trial_ends_at, current_period_starts_at, current_period_ends_at, cancel_at_period_end, created_at, updated_at'
      )
      .order('updated_at', { ascending: false })
      .limit(250),
    admin
      .from('plans')
      .select('code, name, limits, modules, is_active')
      .order('code', { ascending: true }),
  ])

  const subscriptions = error ? [] : ((data ?? []) as SubscriptionRow[])
  const organizationIds = Array.from(new Set(subscriptions.map((subscription) => subscription.organization_id).filter(Boolean)))

  const { data: organizationsData } = organizationIds.length
    ? await admin
        .from('organizations')
        .select('id, name, slug, plan, owner_id')
        .in('id', organizationIds)
    : { data: [] }

  const organizations = (organizationsData ?? []) as OrganizationRow[]
  const ownerIds = Array.from(new Set(organizations.map((organization) => organization.owner_id).filter(Boolean))) as string[]

  const { data: profilesData } = ownerIds.length
    ? await admin
        .from('profiles')
        .select('id, email, full_name')
        .in('id', ownerIds)
    : { data: [] }

  const organizationsById = new Map(organizations.map((organization) => [organization.id, organization]))
  const profilesById = new Map(((profilesData ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]))
  const plansByCode = new Map(((plansData ?? []) as PlanRow[]).map((plan) => [plan.code, plan]))

  const dashboardSubscriptions: SuperAdminSubscription[] = subscriptions.map((subscription) => {
    const organization = organizationsById.get(subscription.organization_id)
    const owner = organization?.owner_id ? profilesById.get(organization.owner_id) : null
    const plan = subscription.plan || organization?.plan || 'FREE'
    const planDetails = plansByCode.get(plan)

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
            name: planDetails.name,
            limits: planDetails.limits || {},
            modules: planDetails.modules || [],
            is_active: planDetails.is_active !== false,
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
    }
  })

  return (
    <SubscriptionsDashboard
      subscriptions={dashboardSubscriptions}
      loadError={
        error
          ? 'No se pudo cargar subscriptions. Verifica que la migracion SaaS este aplicada y que el esquema tenga current_period_ends_at.'
          : null
      }
    />
  )
}
