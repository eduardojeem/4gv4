import { WHOLESALE_PRICE_PERMISSION } from '@/lib/auth/roles-permissions'
import type { SupabaseClient } from '@supabase/supabase-js'

const LEGACY_WHOLESALE_ROLES = new Set(['mayorista', 'client_mayorista'])

export function isLegacyWholesaleRole(role: unknown): boolean {
  if (typeof role !== 'string') return false
  return LEGACY_WHOLESALE_ROLES.has(role.toLowerCase().trim())
}

async function hasExplicitWholesalePermission(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string
): Promise<boolean> {
  const withIsActive = await supabase
    .from('user_permissions')
    .select('permission', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('permission', WHOLESALE_PRICE_PERMISSION)
    .eq('organization_id', organizationId)
    .eq('is_active', true)

  if (!withIsActive.error) {
    return (withIsActive.count || 0) > 0
  }

  return false
}

export async function resolveWholesaleAccessForUser(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string
): Promise<boolean> {
  if (!userId || !organizationId) return false
  return hasExplicitWholesalePermission(supabase, userId, organizationId)
}

export { WHOLESALE_PRICE_PERMISSION }
