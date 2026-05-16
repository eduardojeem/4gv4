import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import { logger } from '@/lib/logger'

export interface AdminAuthContext {
  user: {
    id: string
    email?: string
    role: string
  }
}

export type AdminAuthenticatedHandler = (
  request: NextRequest,
  context: AdminAuthContext
) => Promise<NextResponse>

/**
 * Middleware para proteger rutas API que requieren permisos de administrador
 *
 * Verifica que:
 * 1. El usuario este autenticado
 * 2. El usuario tenga rol de 'admin' o 'super_admin'
 * 3. Registra el acceso en logs de auditoria
 *
 * @example
 * export const POST = withAdminAuth(async (request, { user }) => {
 *   // user.role es 'admin' o 'super_admin' garantizado
 *   return NextResponse.json({ data: 'admin data' })
 * })
 */
export function withAdminAuth(handler: AdminAuthenticatedHandler) {
  return async (request: NextRequest) => {
    try {
      const auth = await resolveRequestAuthUser()

      if ('reason' in auth) {
        if (auth.reason === 'unauthenticated') {
          logger.warn('Unauthorized admin API access attempt', {
            path: request.nextUrl.pathname,
          })

          return NextResponse.json(
            { error: 'Unauthorized', message: 'Authentication required' },
            { status: 401 }
          )
        }

        logger.warn('Inactive user attempted admin API access', {
          path: request.nextUrl.pathname,
          reason: auth.reason,
        })

        return NextResponse.json(
          {
            error: 'Forbidden',
            message: 'User account is inactive or suspended',
          },
          { status: 403 }
        )
      }

      const allowedRoles = ['admin', 'super_admin']
      const supabase = await createClient()

      if (!allowedRoles.includes(auth.user.role)) {
        logger.warn('Forbidden admin API access attempt', {
          path: request.nextUrl.pathname,
          userId: auth.user.id,
          userRole: auth.user.role,
          requiredRoles: allowedRoles,
        })

        try {
          await supabase.from('audit_log').insert({
            user_id: auth.user.id,
            action: 'unauthorized_admin_access_attempt',
            resource: 'admin_api',
            resource_id: request.nextUrl.pathname,
            new_values: {
              path: request.nextUrl.pathname,
              method: request.method,
              userRole: auth.user.role,
            },
          })
        } catch (err) {
          logger.error('Failed to log unauthorized access attempt', { error: err })
        }

        return NextResponse.json(
          {
            error: 'Forbidden',
            message: 'Administrator privileges required',
          },
          { status: 403 }
        )
      }

      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
        try {
          await supabase.from('audit_log').insert({
            user_id: auth.user.id,
            action: 'admin_api_access',
            resource: 'admin_api',
            resource_id: request.nextUrl.pathname,
            new_values: {
              path: request.nextUrl.pathname,
              method: request.method,
              userRole: auth.user.role,
            },
          })
        } catch (err) {
          logger.error('Failed to log admin access', { error: err })
        }
      }

      const context: AdminAuthContext = {
        user: {
          id: auth.user.id,
          email: auth.user.email,
          role: auth.user.role,
        },
      }

      return await handler(request, context)
    } catch (error) {
      logger.error('Admin auth middleware error', { error })

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}

/**
 * Middleware para proteger rutas que requieren especificamente super_admin
 */
export function withSuperAdminAuth(handler: AdminAuthenticatedHandler) {
  return withAdminAuth(async (request, context) => {
    if (context.user.role !== 'super_admin') {
      logger.warn('Super admin access denied', {
        path: request.nextUrl.pathname,
        userId: context.user.id,
        userRole: context.user.role,
      })

      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Super administrator privileges required',
        },
        { status: 403 }
      )
    }

    return await handler(request, context)
  })
}
