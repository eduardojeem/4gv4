import { redirect } from 'next/navigation'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/superadmin/auth'
import { UsersDashboard, type UserRow } from '@/components/superadmin/UsersDashboard'
import { chunkValues, fetchAllRows } from '@/lib/superadmin/fetch-all-rows'

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

async function getUsersData(orgId: string | null) {
  const admin = createAdminSupabase()

  // Org info (when filtered)
  const orgInfoPromise = orgId
    ? admin.from('organizations').select('id, name, slug, plan').eq('id', orgId).maybeSingle()
    : Promise.resolve({ data: null, error: null })

  // Members
  type Member = {
    id: string; user_id: string; role: string; status: string | null; created_at: string | null; organization_id: string
  }
  const [{ data: orgData, error: orgError }, members] = await Promise.all([
    orgInfoPromise,
    fetchAllRows<Member>((from, to) => {
      let query = admin
        .from('organization_members')
        .select('id, user_id, role, status, created_at, organization_id')
        .order('created_at', { ascending: false })
      if (orgId) query = query.eq('organization_id', orgId)
      return query.range(from, to)
    }),
  ])
  if (orgError) throw new Error(orgError.message)

  // Fetch profiles + orgs in parallel
  const userIds = [...new Set(members.map((m) => m.user_id))]
  const orgIds = [...new Set(members.map((m) => m.organization_id))]

  const [profilesData, orgsData, subsData] = await Promise.all([
    userIds.length
      ? Promise.all(chunkValues(userIds).map(async (ids) => {
          const { data, error } = await admin.from('profiles').select('id, email, full_name, status').in('id', ids)
          if (error) throw new Error(error.message)
          return data ?? []
        })).then((chunks) => chunks.flat())
      : Promise.resolve([]),
    !orgId && orgIds.length
      ? Promise.all(chunkValues(orgIds).map(async (ids) => {
          const { data, error } = await admin.from('organizations').select('id, name, slug, plan').in('id', ids)
          if (error) throw new Error(error.message)
          return data ?? []
        })).then((chunks) => chunks.flat())
      : Promise.resolve([]),
    orgIds.length
      ? Promise.all(chunkValues(orgIds).map(async (ids) => {
          const { data } = await admin.from('subscriptions').select('organization_id, status').in('organization_id', ids)
          return data ?? []
        })).then((chunks) => chunks.flat())
      : Promise.resolve([]),
  ])

  const profilesById = new Map(
    (profilesData as Array<{ id: string; email: string | null; full_name: string | null; status: string | null }>)
      .map((p) => [p.id, p])
  )
  const orgsById = new Map(
    ((orgData ? [orgData] : orgsData) as Array<{ id: string; name: string; slug: string; plan?: string | null }>)
      .map((o) => [o.id, o])
  )
  const subsById = new Map(
    (subsData as Array<{ organization_id: string; status: string | null }>)
      .map((s) => [s.organization_id, s.status])
  )

  const rows: UserRow[] = members.map((m) => {
    const profile = profilesById.get(m.user_id)
    const org = orgsById.get(m.organization_id)
    const subStatus = subsById.get(m.organization_id)
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
      organizationStatus: subStatus || null,
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
  // 🔒 Sólo super admins pueden ver el directorio completo de usuarios
  const me = await requireSuperAdmin()
  if (!me) redirect('/dashboard')

  const params = await searchParams
  const orgId = params?.organization ?? null
  const { rows, filterOrg } = await getUsersData(orgId)

  return <UsersDashboard rows={rows} filterOrg={filterOrg} />
}
