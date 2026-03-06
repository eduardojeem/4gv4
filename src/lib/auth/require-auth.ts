import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { normalizeRole, type AppRole } from '@/lib/auth/role-utils'

export type AuthResult =
  | { authenticated: true; user: { id: string; email?: string }; role: AppRole }
  | { authenticated: false; response: NextResponse }

/** Type-safe narrowing helper: returns the NextResponse when unauthenticated, else null */
export function getAuthResponse(auth: AuthResult): NextResponse | null {
  if (!auth.authenticated) return (auth as { authenticated: false; response: NextResponse }).response
  return null
}

/**
 * Verifies that the current request is made by an authenticated user.
 * Returns the user object and their normalized role from the `user_roles` table.
 * Role priority: user_roles > profiles > 'cliente'
 */
export async function requireAuth(): Promise<AuthResult> {
  const supabase = await createServerSupabase()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      authenticated: false,
      response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }),
    }
  }

  // user_roles is the source of truth (same as middleware)
  const admin = createAdminSupabase()
  const { data: roleRow } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  let rawRole = roleRow?.role as string | undefined

  // Fallback to profiles only if user_roles has no row
  if (!rawRole) {
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    rawRole = profile?.role as string | undefined
  }

  const role: AppRole = normalizeRole(rawRole) ?? 'cliente'

  return { authenticated: true, user, role }
}

/**
 * Verifies that the current request is made by an admin or super_admin.
 * Returns 401 if not authenticated, 403 if not admin.
 */
export async function requireAdmin(): Promise<AuthResult> {
  const result = await requireAuth()

  if (!result.authenticated) return result

  if (result.role !== 'admin') {
    return {
      authenticated: false,
      response: NextResponse.json(
        { error: 'Permisos insuficientes. Se requiere rol de administrador.' },
        { status: 403 }
      ),
    }
  }

  return result
}

/**
 * Verifies that the current request is made by staff (admin, vendedor, or tecnico).
 * Returns 401 if not authenticated, 403 if role is 'cliente'.
 */
export async function requireStaff(): Promise<AuthResult> {
  const result = await requireAuth()

  if (!result.authenticated) return result

  const staffRoles: AppRole[] = ['admin', 'vendedor', 'tecnico']
  if (!staffRoles.includes(result.role)) {
    return {
      authenticated: false,
      response: NextResponse.json(
        { error: 'Permisos insuficientes. Se requiere rol de personal.' },
        { status: 403 }
      ),
    }
  }

  return result
}
