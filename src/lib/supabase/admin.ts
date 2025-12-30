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
 * UI roles: admin | vendedor | tecnico | cliente | super_admin
 * DB roles: super_admin | admin | manager | employee | viewer
 */
export function mapUiRoleToDbRole(role?: string) {
  if (!role) return undefined
  const r = role.toLowerCase()
  switch (r) {
    case 'super_admin':
      return 'super_admin'
    case 'admin':
      return 'admin'
    case 'vendedor':
      return 'employee'
    case 'tecnico':
      return 'employee'
    case 'cliente':
      return 'viewer'
    default:
      return undefined
  }
}