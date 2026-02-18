import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'

type AuthResult =
  | { authenticated: true; user: { id: string; email?: string }; role: string }
  | { authenticated: false; response: NextResponse }

/**
 * Verifies that the current request is made by an authenticated user.
 * Returns the user object and their role from the `user_roles` table.
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

  const admin = createAdminSupabase()
  const { data: roleRow } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  const role = (roleRow?.role as string) ?? 'cliente'

  return { authenticated: true, user, role }
}

/**
 * Verifies that the current request is made by an admin or super_admin.
 * Returns 401 if not authenticated, 403 if not admin.
 */
export async function requireAdmin(): Promise<AuthResult> {
  const result = await requireAuth()

  if (!result.authenticated) return result

  const allowedRoles = ['admin', 'super_admin']
  if (!allowedRoles.includes(result.role)) {
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
