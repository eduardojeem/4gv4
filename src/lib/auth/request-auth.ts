import { createClient as createServerSupabase, getRequestBearerToken } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { normalizeRole, type AppRole } from '@/lib/auth/role-utils'
import { MFA_REQUIRED_AUTH_ERROR, readTokenAal, type AssuranceLevel } from '@/lib/auth/mfa'

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
  /** Nivel de verificación de la sesión: `aal2` ya pasó el código de la app autenticadora. */
  aal: AssuranceLevel | null
}

export type RequestAuthResolution =
  | { authenticated: true; user: RequestAuthUser }
  | { authenticated: false; reason: 'unauthenticated' | 'inactive' | 'mfa_required' }

function normalizeProfileStatus(value: unknown): ProfileStatus {
  if (value === 'active' || value === 'inactive' || value === 'suspended') {
    return value
  }
  return null
}

async function loadRoleRow(
  userId: string
): Promise<RoleRow | null> {
  const supabase = createAdminSupabase()
  const { data: roleWithStatus, error: roleWithStatusError } = await supabase
    .from('user_roles')
    .select('role,is_active')
    .eq('user_id', userId)
    .maybeSingle()

  if (!roleWithStatusError) {
    return roleWithStatus as RoleRow | null
  }

  throw new Error('No se pudo verificar el estado del rol del usuario')
}

async function loadProfileRow(
  userId: string
): Promise<ProfileRow | null> {
  const supabase = createAdminSupabase()
  const { data: profileWithStatus, error: profileWithStatusError } = await supabase
    .from('profiles')
    .select('role,status')
    .eq('id', userId)
    .maybeSingle()

  if (!profileWithStatusError) {
    return profileWithStatus as ProfileRow | null
  }

  throw new Error('No se pudo verificar el estado del perfil del usuario')
}

async function readSessionAal(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>
): Promise<AssuranceLevel | null> {
  try {
    const bearer = await getRequestBearerToken()
    if (bearer) return readTokenAal(bearer)
    const { data } = await supabase.auth.getSession()
    return readTokenAal(data.session?.access_token)
  } catch {
    return null
  }
}

export async function resolveRequestAuthUser(): Promise<RequestAuthResolution> {
  const supabase = await createServerSupabase()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error?.code === MFA_REQUIRED_AUTH_ERROR) {
    return {
      authenticated: false,
      reason: 'mfa_required',
    }
  }

  if (error || !user) {
    return {
      authenticated: false,
      reason: 'unauthenticated',
    }
  }

  const [roleRow, profileRow] = await Promise.all([
    loadRoleRow(user.id),
    loadProfileRow(user.id),
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
      aal: await readSessionAal(supabase),
    },
  }
}
