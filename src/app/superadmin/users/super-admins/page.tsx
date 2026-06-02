import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/superadmin/auth'
import { redirect } from 'next/navigation'
import { SuperAdminsManager, type SuperAdminRow } from '@/components/superadmin/SuperAdminsManager'

async function getSuperAdmins() {
  const admin = createAdminSupabase()

  // 1. Get all super_admin roles
  const { data: roleRows } = await admin
    .from('user_roles')
    .select('user_id, role, is_active, created_at, updated_at')
    .eq('role', 'super_admin')

  const userIds = (roleRows ?? []).map((r) => r.user_id)
  if (!userIds.length) return []

  // 2. Get profiles + last sign-in from auth.users
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, email, full_name, status, created_at')
    .in('id', userIds)

  const profilesById = new Map(
    (profiles ?? []).map((p) => [p.id, p as { id: string; email: string | null; full_name: string | null; status: string | null; created_at: string | null }])
  )

  // 3. Get auth.users data for last_sign_in_at (paginated)
  type AuthUser = { id: string; last_sign_in_at?: string | null }
  const lastSignInById = new Map<string, string | null>()
  try {
    for (let page = 1; page <= 5; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
      if (error || !data) break
      const users = (data.users ?? []) as AuthUser[]
      users.forEach((u) => {
        if (userIds.includes(u.id)) lastSignInById.set(u.id, u.last_sign_in_at ?? null)
      })
      if (users.length < 200) break
    }
  } catch {
    // best-effort
  }

  const rows: SuperAdminRow[] = (roleRows ?? []).map((r) => {
    const profile = profilesById.get(r.user_id)
    return {
      userId: r.user_id,
      email: profile?.email ?? null,
      name: profile?.full_name ?? null,
      profileStatus: profile?.status ?? null,
      roleActive: r.is_active !== false,
      roleSince: r.created_at ?? null,
      lastSignIn: lastSignInById.get(r.user_id) ?? null,
    }
  })

  // Sort: active first, then by last_sign_in desc
  rows.sort((a, b) => {
    if (a.roleActive !== b.roleActive) return a.roleActive ? -1 : 1
    return (b.lastSignIn ?? '').localeCompare(a.lastSignIn ?? '')
  })

  return rows
}

export default async function SuperAdminsPage() {
  const me = await requireSuperAdmin()
  if (!me) redirect('/dashboard')

  const rows = await getSuperAdmins()

  return <SuperAdminsManager rows={rows} currentUserId={me.id} />
}
