import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mapUiRoleToDbRole } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

export interface AuthContext {
  user: {
    id: string
    email?: string
    role?: string
  }
}

export type AuthenticatedHandler = (
  request: NextRequest,
  context: AuthContext
) => Promise<NextResponse>

/**
 * Middleware to protect API routes with authentication
 * Wraps route handlers to ensure user is authenticated before proceeding
 * 
 * @example
 * export const GET = withAuth(async (request, { user }) => {
 *   // user is guaranteed to be authenticated here
 *   return NextResponse.json({ data: 'protected data' })
 * })
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (request: NextRequest) => {
    try {
      const supabase = await createClient()
      
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error || !user) {
        logger.warn('Unauthorized API access attempt', {
          path: request.nextUrl.pathname,
          error: error?.message
        })
        
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Authentication required' },
          { status: 401 }
        )
      }

      // user_roles is the source of truth for role and active status.
      let roleRow: { role?: string | null; is_active?: boolean | null } | null = null
      const { data: roleWithStatus, error: roleWithStatusError } = await supabase
        .from('user_roles')
        .select('role,is_active')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!roleWithStatusError) {
        roleRow = roleWithStatus as { role?: string | null; is_active?: boolean | null } | null
      } else if (roleWithStatusError.message?.includes('is_active')) {
        const { data: roleOnly, error: roleOnlyError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle()

        if (!roleOnlyError) {
          roleRow = roleOnly ? { role: roleOnly.role, is_active: true } : null
        } else {
          logger.error('Failed to fetch user_roles role in withAuth fallback', {
            userId: user.id,
            error: roleOnlyError.message,
          })
        }
      } else {
        logger.error('Failed to fetch user_roles in withAuth', {
          userId: user.id,
          error: roleWithStatusError.message,
        })
      }

      let profileRow: { role?: string | null; status?: string | null } | null = null
      const { data: profileWithStatus, error: profileWithStatusError } = await supabase
        .from('profiles')
        .select('role,status')
        .eq('id', user.id)
        .maybeSingle()

      if (!profileWithStatusError) {
        profileRow = profileWithStatus as { role?: string | null; status?: string | null } | null
      } else if (profileWithStatusError.message?.includes('status')) {
        const { data: profileRoleOnly, error: profileRoleOnlyError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()

        if (!profileRoleOnlyError) {
          profileRow = profileRoleOnly ? { role: profileRoleOnly.role } : null
        } else {
          logger.error('Failed to fetch profiles role in withAuth fallback', {
            userId: user.id,
            error: profileRoleOnlyError.message,
          })
        }
      } else {
        logger.error('Failed to fetch profiles in withAuth', {
          userId: user.id,
          error: profileWithStatusError.message,
        })
      }

      const rawRole = roleRow?.role ?? profileRow?.role ?? undefined
      const normalizedRole = mapUiRoleToDbRole(rawRole || undefined) ?? 'cliente'

      const roleIsActive = roleRow?.is_active !== false
      const profileIsActive = !profileRow?.status || profileRow.status === 'active'

      if (!roleIsActive || !profileIsActive) {
        logger.warn('Inactive user attempted API access', {
          path: request.nextUrl.pathname,
          userId: user.id,
          roleIsActive,
          profileStatus: profileRow?.status ?? null,
        })

        return NextResponse.json(
          { error: 'Forbidden', message: 'User account is inactive or suspended' },
          { status: 403 }
        )
      }
      
      const context: AuthContext = {
        user: {
          id: user.id,
          email: user.email,
          role: normalizedRole
        }
      }
      
      return await handler(request, context)
    } catch (error) {
      logger.error('Auth middleware error', { error })
      
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}
