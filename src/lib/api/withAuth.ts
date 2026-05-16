import { NextRequest, NextResponse } from 'next/server'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
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
      const auth = await resolveRequestAuthUser()

      if ('reason' in auth) {
        if (auth.reason === 'unauthenticated') {
          logger.warn('Unauthorized API access attempt', {
            path: request.nextUrl.pathname,
          })

          return NextResponse.json(
            { error: 'Unauthorized', message: 'Authentication required' },
            { status: 401 }
          )
        }

        logger.warn('Inactive user attempted API access', {
          path: request.nextUrl.pathname,
          reason: auth.reason,
        })

        return NextResponse.json(
          { error: 'Forbidden', message: 'User account is inactive or suspended' },
          { status: 403 }
        )
      }
      
      const context: AuthContext = {
        user: {
          id: auth.user.id,
          email: auth.user.email,
          role: auth.user.role
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
