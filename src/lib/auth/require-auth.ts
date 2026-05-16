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
      response: NextResponse.json({ error }, { status }),
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

  if (result.role !== 'admin' && result.role !== 'super_admin') {
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

  const staffRoles: AppRole[] = ['super_admin', 'admin', 'vendedor', 'tecnico']
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
