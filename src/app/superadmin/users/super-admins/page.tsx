import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/superadmin/auth'
import { redirect } from 'next/navigation'
import { SuperAdminsManager, type SuperAdminRow } from '@/components/superadmin/SuperAdminsManager'
import { getLastSignIns } from '@/lib/superadmin/find-auth-user'

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

  // 3. Ultimo acceso, preguntando por cada superadmin.
  //
  // Antes se recorrian cinco paginas de 200 usuarios y se cruzaba: pasados los
  // mil usuarios, el ultimo acceso quedaba en `null` para los que caian fuera,
  // y la pantalla pinta ese `null` como «Nunca». Un superadmin que entro hoy
  // figuraba como que nunca entro. Son un puñado: preguntar por cada uno es
  // exacto y no depende del tamaño de la plataforma.
  const lastSignInById = await getLastSignIns(admin, userIds)

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
      // Un rol de superadmin sin fila en `profiles` es una anomalia: la
      // pantalla lo mostraba como «Usuario» sin correo, indistinguible de un
      // perfil incompleto.
      missingProfile: !profile,
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
