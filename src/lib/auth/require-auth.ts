import { NextResponse } from 'next/server'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import type { AppRole } from '@/lib/auth/role-utils'

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
  const result = await resolveRequestAuthUser()

  if ('reason' in result) {
    const status = result.reason === 'unauthenticated' ? 401 : 403
    const error =
      result.reason === 'unauthenticated'
        ? 'No autenticado'
        : 'Cuenta inactiva o suspendida'

    return {
      authenticated: false,
      response: NextResponse.json(
        {
          error,
          code: result.reason === 'unauthenticated' ? 'AUTH_REQUIRED' : 'ACCOUNT_INACTIVE',
        },
        { status }
      ),
    }
  }

  return {
    authenticated: true,
    user: {
      id: result.user.id,
      email: result.user.email,
    },
    role: result.user.role,
  }
}

/**
 * Verifies that the current request is made by an admin or super_admin.
 * Returns 401 if not authenticated, 403 if not admin.
 */
export async function requireAdmin(): Promise<AuthResult> {
  const result = await requireAuth()

  if (!result.authenticated) return result

  if (result.role === 'admin' || result.role === 'super_admin') {
    return result
  }

  // Profile role is not admin — check organization_members for owner/admin role
  try {
    const { createAdminSupabase } = await import('@/lib/supabase/admin')
    const admin = createAdminSupabase()
    const { data: membership } = await admin
      .from('organization_members')
      .select('role')
      .eq('user_id', result.user.id)
      .eq('status', 'active')
      .in('role', ['owner', 'admin'])
      .limit(1)
      .maybeSingle()

    if (membership?.role) {
      return {
        authenticated: true,
        user: result.user,
        role: 'admin',
      }
    }
  } catch {
    // If check fails, fall through to denial
  }

  return {
    authenticated: false,
    response: NextResponse.json(
      {
        error: 'Permisos insuficientes. Se requiere rol de administrador.',
        code: 'ADMIN_ROLE_REQUIRED',
        role: result.role,
      },
      { status: 403 }
    ),
  }
}

/**
 * Verifies that the current request is made by staff (admin, vendedor, or tecnico).
 * Also checks organization_members for users with profiles.role='cliente' but org staff role.
 * Returns 401 if not authenticated, 403 if role is 'cliente' without org membership.
 */
export async function requireStaff(): Promise<AuthResult> {
  const result = await requireAuth()

  if (!result.authenticated) return result

  const staffRoles: AppRole[] = ['super_admin', 'admin', 'vendedor', 'tecnico']
  if (staffRoles.includes(result.role)) {
    return result
  }

  // Profile role is 'cliente' — check if user has a staff membership in an organization
  try {
    const { createAdminSupabase } = await import('@/lib/supabase/admin')
    const admin = createAdminSupabase()
    const { data: membership } = await admin
      .from('organization_members')
      .select('role')
      .eq('user_id', result.user.id)
      .eq('status', 'active')
      .in('role', ['owner', 'admin', 'manager', 'cashier', 'technician', 'seller'])
      .limit(1)
      .maybeSingle()

    if (membership?.role) {
      // Map org role to app role for downstream use
      const orgToAppRole: Record<string, AppRole> = {
        owner: 'admin',
        admin: 'admin',
        manager: 'vendedor',
        cashier: 'vendedor',
        seller: 'vendedor',
        technician: 'tecnico',
      }
      return {
        authenticated: true,
        user: result.user,
        role: orgToAppRole[membership.role] || 'vendedor',
      }
    }
  } catch {
    // If check fails, fall through to denial
  }

  return {
    authenticated: false,
    response: NextResponse.json(
      {
        error: 'Permisos insuficientes. Se requiere rol de personal.',
        code: 'STAFF_ROLE_REQUIRED',
        role: result.role,
      },
      { status: 403 }
    ),
  }
}
