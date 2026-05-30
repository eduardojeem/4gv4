import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'

export type SuperAdminUser = {
  id: string
  email: string | null
  role: 'super_admin'
}

export async function getSuperAdminUser(): Promise<SuperAdminUser | null> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  const admin = createAdminSupabase()

  const { data: userRole } = await admin
    .from('user_roles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .maybeSingle()

  if (userRole?.role === 'super_admin' && userRole?.is_active !== false) {
    return {
      id: user.id,
      email: user.email ?? null,
      role: 'super_admin',
    }
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role === 'super_admin' && profile?.status !== 'inactive' && profile?.status !== 'suspended') {
    return {
      id: user.id,
      email: user.email ?? null,
      role: 'super_admin',
    }
  }

  const appRole = typeof user.app_metadata?.role === 'string'
    ? user.app_metadata.role.toLowerCase()
    : ''

  if (appRole === 'super_admin') {
    return {
      id: user.id,
      email: user.email ?? null,
      role: 'super_admin',
    }
  }

  return null
}

export async function requireSuperAdmin() {
  const user = await getSuperAdminUser()

  if (!user) {
    redirect('/dashboard')
  }

  return user
}
