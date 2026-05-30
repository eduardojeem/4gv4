import { createAdminSupabase } from '@/lib/supabase/admin'
import { OrganizationsDashboard, type SuperAdminOrganization } from '@/components/superadmin/organizations/organizations-dashboard'

type OrganizationRow = {
  id: string
  name: string
  slug: string
  plan: string | null
  logo_url: string | null
  owner_id: string | null
  created_at: string | null
  updated_at: string | null
}

type MemberRow = {
  organization_id: string
  role: string
  status: string
}

type SubscriptionRow = {
  organization_id: string
  status: string | null
  trial_ends_at: string | null
  current_period_ends_at: string | null
}

type ProfileRow = {
  id: string
  email: string | null
  full_name: string | null
}

export default async function SuperAdminOrganizationsPage() {
  const admin = createAdminSupabase()

  const { data: organizationsData } = await admin
    .from('organizations')
    .select('id, name, slug, plan, logo_url, owner_id, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(250)

  const organizations = (organizationsData ?? []) as OrganizationRow[]
  const organizationIds = organizations.map((organization) => organization.id)
  const ownerIds = organizations.map((organization) => organization.owner_id).filter(Boolean) as string[]

  const [membersResult, subscriptionsResult, profilesResult] = await Promise.all([
    organizationIds.length
      ? admin
          .from('organization_members')
          .select('organization_id, role, status')
          .in('organization_id', organizationIds)
      : Promise.resolve({ data: [] }),
    organizationIds.length
      ? admin
          .from('subscriptions')
          .select('organization_id, status, trial_ends_at, current_period_ends_at')
          .in('organization_id', organizationIds)
      : Promise.resolve({ data: [] }),
    ownerIds.length
      ? admin
          .from('profiles')
          .select('id, email, full_name')
          .in('id', ownerIds)
      : Promise.resolve({ data: [] }),
  ])

  const members = (membersResult.data ?? []) as MemberRow[]
  const subscriptions = (subscriptionsResult.data ?? []) as SubscriptionRow[]
  const profiles = (profilesResult.data ?? []) as ProfileRow[]

  const membersByOrganization = new Map<string, MemberRow[]>()
  members.forEach((member) => {
    const current = membersByOrganization.get(member.organization_id) ?? []
    current.push(member)
    membersByOrganization.set(member.organization_id, current)
  })

  const subscriptionsByOrganization = new Map(subscriptions.map((subscription) => [subscription.organization_id, subscription]))
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]))

  const dashboardOrganizations: SuperAdminOrganization[] = organizations.map((organization) => {
    const orgMembers = membersByOrganization.get(organization.id) ?? []
    const subscription = subscriptionsByOrganization.get(organization.id)
    const ownerProfile = organization.owner_id ? profilesById.get(organization.owner_id) : null

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      plan: organization.plan || 'FREE',
      logo_url: organization.logo_url,
      owner_id: organization.owner_id,
      owner_name: ownerProfile?.full_name || null,
      owner_email: ownerProfile?.email || null,
      created_at: organization.created_at,
      updated_at: organization.updated_at,
      subscription_status: subscription?.status || null,
      trial_ends_at: subscription?.trial_ends_at || null,
      current_period_ends_at: subscription?.current_period_ends_at || null,
      members_total: orgMembers.length,
      members_active: orgMembers.filter((member) => member.status === 'active').length,
      members_invited: orgMembers.filter((member) => member.status === 'invited').length,
      members_suspended: orgMembers.filter((member) => member.status === 'suspended').length,
    }
  })

  return <OrganizationsDashboard organizations={dashboardOrganizations} />
}
