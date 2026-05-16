import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { normalizeRole, type AppRole } from '@/lib/auth/role-utils'

type ProfileStatus = 'active' | 'inactive' | 'suspended' | null

interface RoleRow {
  role?: string | null
  is_active?: boolean | null
}

interface ProfileRow {
  role?: string | null
  status?: string | null
}

export interface RequestAuthUser {
  id: string
  email?: string
  role: AppRole
  roleIsActive: boolean
  profileStatus: ProfileStatus
}

export type RequestAuthResolution =
  | { authenticated: true; user: RequestAuthUser }
  | { authenticated: false; reason: 'unauthenticated' | 'inactive' }

function normalizeProfileStatus(value: unknown): ProfileStatus {
  if (value === 'active' || value === 'inactive' || value === 'suspended') {
    return value
  }
  return null
}

async function loadRoleRow(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  userId: string
): Promise<RoleRow | null> {
  const { data: roleWithStatus, error: roleWithStatusError } = await supabase
    .from('user_roles')
    .select('role,is_active')
    .eq('user_id', userId)
    .maybeSingle()

  if (!roleWithStatusError) {
    return roleWithStatus as RoleRow | null
  }

  if (roleWithStatusError.message?.includes('is_active')) {
    const { data: roleOnly, error: roleOnlyError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle()

    if (!roleOnlyError) {
      return roleOnly ? { role: roleOnly.role, is_active: true } : null
    }
  }

  return null
}

async function loadProfileRow(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  userId: string
): Promise<ProfileRow | null> {
  const { data: profileWithStatus, error: profileWithStatusError } = await supabase
    .from('profiles')
    .select('role,status')
    .eq('id', userId)
    .maybeSingle()

  if (!profileWithStatusError) {
    return profileWithStatus as ProfileRow | null
  }

  if (profileWithStatusError.message?.includes('status')) {
    const { data: profileRoleOnly, error: profileRoleOnlyError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()

    if (!profileRoleOnlyError) {
      return profileRoleOnly ? { role: profileRoleOnly.role } : null
    }
  }

  return null
}

export async function resolveRequestAuthUser(): Promise<RequestAuthResolution> {
  const supabase = await createServerSupabase()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      authenticated: false,
      reason: 'unauthenticated',
    }
  }

  const [roleRow, profileRow] = await Promise.all([
    loadRoleRow(supabase, user.id),
    loadProfileRow(supabase, user.id),
  ])

  const role = normalizeRole(roleRow?.role ?? profileRow?.role ?? undefined) ?? 'cliente'
  const roleIsActive = roleRow?.is_active !== false
  const profileStatus = normalizeProfileStatus(profileRow?.status)
  const isActiveUser = roleIsActive && (profileStatus === null || profileStatus === 'active')

  if (!isActiveUser) {
    return {
      authenticated: false,
      reason: 'inactive',
    }
  }

  return {
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      role,
      roleIsActive,
      profileStatus,
    },
  }
}
