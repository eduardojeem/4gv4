import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
 * 1. El usuario esté autenticado
 * 2. El usuario tenga rol de 'admin' o 'super_admin'
 * 3. Registra el acceso en logs de auditoría
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
      const supabase = await createClient()
      
      // Verificar autenticación
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        logger.warn('Unauthorized admin API access attempt', {
          path: request.nextUrl.pathname,
          error: authError?.message
        })
        
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Authentication required' },
          { status: 401 }
        )
      }
      
      // Obtener rol del usuario
      // 1. Intentar obtener rol de la tabla profiles
      let userRole: string | null = null
      
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      
      if (profileError) {
        logger.error('Failed to fetch user profile', {
          userId: user.id,
          error: profileError.message
        })
      }

      if (profile) {
        userRole = profile.role
      }

      // 2. Si no se encuentra en profiles, intentar en user_roles
      if (!userRole) {
        const { data: userRoleData, error: userRoleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle()
        
        if (userRoleError) {
          logger.error('Failed to fetch user_roles', {
            userId: user.id,
            error: userRoleError.message
          })
        }
        
        if (userRoleData) {
          userRole = userRoleData.role
        }
      }
      
      if (!userRole) {
        logger.error('No role found for user', {
          userId: user.id,
          profileError: profileError?.message,
        })
        
        return NextResponse.json(
          { error: 'Forbidden', message: 'No role assigned to user' },
          { status: 403 }
        )
      }
      
      // Verificar que el usuario sea admin o super_admin
      const allowedRoles = ['admin', 'super_admin']
      if (!allowedRoles.includes(userRole)) {
        logger.warn('Forbidden admin API access attempt', {
          path: request.nextUrl.pathname,
          userId: user.id,
          userRole: userRole,
          requiredRoles: allowedRoles
        })
        
        // Registrar intento de acceso no autorizado en audit_log
        try {
          await supabase.from('audit_log').insert({
            user_id: user.id,
            action: 'unauthorized_admin_access_attempt',
            resource: 'admin_api',
            resource_id: request.nextUrl.pathname,
            new_values: {
              path: request.nextUrl.pathname,
              method: request.method,
              userRole: userRole
            }
          })
        } catch (err) {
          logger.error('Failed to log unauthorized access attempt', { error: err })
        }
        
        return NextResponse.json(
          { 
            error: 'Forbidden', 
            message: 'Administrator privileges required' 
          },
          { status: 403 }
        )
      }
      
      // Registrar acceso exitoso (solo para operaciones de escritura)
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
        try {
          await supabase.from('audit_log').insert({
            user_id: user.id,
            action: 'admin_api_access',
            resource: 'admin_api',
            resource_id: request.nextUrl.pathname,
            new_values: {
              path: request.nextUrl.pathname,
              method: request.method,
              userRole: userRole
            }
          })
        } catch (err) {
          logger.error('Failed to log admin access', { error: err })
        }
      }
      
      const context: AdminAuthContext = {
        user: {
          id: user.id,
          email: user.email,
          role: userRole
        }
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
 * Middleware para proteger rutas que requieren específicamente super_admin
 */
export function withSuperAdminAuth(handler: AdminAuthenticatedHandler) {
  return withAdminAuth(async (request, context) => {
    if (context.user.role !== 'super_admin') {
      logger.warn('Super admin access denied', {
        path: request.nextUrl.pathname,
        userId: context.user.id,
        userRole: context.user.role
      })
      
      return NextResponse.json(
        { 
          error: 'Forbidden', 
          message: 'Super administrator privileges required' 
        },
        { status: 403 }
      )
    }
    
    return await handler(request, context)
  })
}
