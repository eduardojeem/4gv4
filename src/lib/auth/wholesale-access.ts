import { WHOLESALE_PRICE_PERMISSION } from '@/lib/auth/roles-permissions'

type WholesaleProfileRow = {
  role?: string | null
}

const LEGACY_WHOLESALE_ROLES = new Set(['mayorista', 'client_mayorista'])

export function isLegacyWholesaleRole(role: unknown): boolean {
  if (typeof role !== 'string') return false
  return LEGACY_WHOLESALE_ROLES.has(role.toLowerCase().trim())
}

async function hasExplicitWholesalePermission(
  supabase: any,
  userId: string
): Promise<boolean> {
  const withIsActive = await supabase
    .from('user_permissions')
    .select('permission', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('permission', WHOLESALE_PRICE_PERMISSION)
    .eq('is_active', true)

  if (!withIsActive.error) {
    return (withIsActive.count || 0) > 0
  }

  // Compatibility for legacy schema without user_permissions.is_active.
  if (withIsActive.error.message?.includes('is_active')) {
    const legacyQuery = await supabase
      .from('user_permissions')
      .select('permission', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('permission', WHOLESALE_PRICE_PERMISSION)

    if (!legacyQuery.error) {
      return (legacyQuery.count || 0) > 0
    }
  }

  return false
}

export async function resolveWholesaleAccessForUser(
  supabase: any,
  userId: string,
  fallbackRole?: unknown
): Promise<boolean> {
  if (!userId) return false

  let profile: WholesaleProfileRow | null = null
  const { data: profileRoleOnly, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (!profileError) {
    profile = profileRoleOnly as WholesaleProfileRow | null
  }

  const profileRole = profile?.role ?? undefined
  const hasLegacyRole = isLegacyWholesaleRole(profileRole) || isLegacyWholesaleRole(fallbackRole)

  const hasExplicitPermission = await hasExplicitWholesalePermission(supabase, userId)

  if (hasLegacyRole && !hasExplicitPermission) {
    return false
  }

  return hasExplicitPermission
}

export { WHOLESALE_PRICE_PERMISSION }
