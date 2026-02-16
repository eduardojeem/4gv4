import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
      
      // Get user role if needed
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      
      const context: AuthContext = {
        user: {
          id: user.id,
          email: user.email,
          role: profile?.role
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
