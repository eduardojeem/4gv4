import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase admin client using the Service Role key.
 * Requires env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */
export function createAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
  }

  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Maps UI role to DB role for user_roles table.
 * Now unified: DB roles match app roles directly.
 * Valid roles: super_admin | admin | vendedor | tecnico | cliente
 */
export function mapUiRoleToDbRole(role?: string) {
  if (!role) return undefined
  const r = role.toLowerCase().trim()
  const validRoles = ['super_admin', 'admin', 'vendedor', 'tecnico', 'cliente']
  if (validRoles.includes(r)) return r
  // Legacy mappings for backwards compatibility
  switch (r) {
    case 'employee':
    case 'manager':
      return 'vendedor'
    case 'viewer':
    case 'client_normal':
    case 'mayorista':
    case 'client_mayorista':
      return 'cliente'
    case 'technician':
      return 'tecnico'
    default:
      return undefined
  }
}
