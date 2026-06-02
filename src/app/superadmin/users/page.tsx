import { createAdminSupabase } from '@/lib/supabase/admin'
import { UsersDashboard, type UserRow } from '@/components/superadmin/UsersDashboard'

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

async function getUsersData(orgId: string | null) {
  const admin = createAdminSupabase()

  // Org info (when filtered)
  const orgInfoPromise = orgId
    ? admin.from('organizations').select('id, name, slug, plan').eq('id', orgId).maybeSingle()
    : Promise.resolve({ data: null })

  // Members
  const membersQuery = orgId
    ? admin.from('organization_members').select('id, user_id, role, status, created_at, organization_id').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(500)
    : admin.from('organization_members').select('id, user_id, role, status, created_at, organization_id').order('created_at', { ascending: false }).limit(300)

  const [{ data: orgData }, { data: membersData }] = await Promise.all([orgInfoPromise, membersQuery])

  const members = (membersData ?? []) as Array<{
    id: string; user_id: string; role: string; status: string | null; created_at: string | null; organization_id: string
  }>

  // Fetch profiles + orgs in parallel
  const userIds = [...new Set(members.map((m) => m.user_id))]
  const orgIds = [...new Set(members.map((m) => m.organization_id))]

  const [{ data: profilesData }, { data: orgsData }] = await Promise.all([
    userIds.length
      ? admin.from('profiles').select('id, email, full_name, status').in('id', userIds)
      : Promise.resolve({ data: [] }),
    !orgId && orgIds.length
      ? admin.from('organizations').select('id, name, slug, plan').in('id', orgIds)
      : Promise.resolve({ data: [] }),
  ])

  const profilesById = new Map(
    ((profilesData ?? []) as Array<{ id: string; email: string | null; full_name: string | null; status: string | null }>)
      .map((p) => [p.id, p])
  )
  const orgsById = new Map(
    ((orgData ? [orgData] : (orgsData ?? [])) as Array<{ id: string; name: string; slug: string; plan?: string | null }>)
      .map((o) => [o.id, o])
  )

  const rows: UserRow[] = members.map((m) => {
    const profile = profilesById.get(m.user_id)
    const org = orgsById.get(m.organization_id)
    return {
      memberId: m.id,
      userId: m.user_id,
      name: profile?.full_name || null,
      email: profile?.email || null,
      profileStatus: profile?.status || null,
      memberRole: m.role,
      memberStatus: m.status,
      memberSince: m.created_at,
      organizationId: m.organization_id,
      organizationName: org?.name || null,
      organizationSlug: org?.slug || null,
      organizationPlan: org?.plan || null,
    }
  })

  const filterOrg = orgData ? { id: orgData.id, name: orgData.name, slug: orgData.slug, plan: orgData.plan } : null

  return { rows, filterOrg }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Props = { searchParams?: Promise<{ organization?: string }> }

export default async function SuperAdminUsersPage({ searchParams }: Props) {
  const params = await searchParams
  const orgId = params?.organization ?? null
  const { rows, filterOrg } = await getUsersData(orgId)

  return <UsersDashboard rows={rows} filterOrg={filterOrg} />
}
