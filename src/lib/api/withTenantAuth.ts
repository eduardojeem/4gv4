import { NextRequest, NextResponse } from 'next/server'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import { logger } from '@/lib/logger'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { isModuleEnabled, type SaaSModule } from '@/lib/saas/plans'
import { roleHasPermission, type Permission } from '@/lib/saas/permissions'

export interface TenantAuthContext {
  user: {
    id: string
    email?: string
    role?: string
  }
  organization: {
    id: string
    name: string
    slug: string
    plan: string
    logoUrl: string | null
    role: string
  }
}

export interface TenantGuardOptions {
  permission?: Permission
  module?: SaaSModule
}

export type TenantAuthenticatedHandler = (
  request: NextRequest,
  context: TenantAuthContext,
  routeContext?: unknown
) => Promise<NextResponse>

export function withTenantAuth(options: TenantGuardOptions, handler: TenantAuthenticatedHandler) {
  return async (request: NextRequest, routeContext?: unknown) => {
    try {
      const auth = await resolveRequestAuthUser()

      if ('reason' in auth) {
        return NextResponse.json(
          { error: auth.reason === 'unauthenticated' ? 'Unauthorized' : 'Forbidden' },
          { status: auth.reason === 'unauthenticated' ? 401 : 403 }
        )
      }

      const organization = await getCurrentOrganizationContext(auth.user.id)

      if (!organization) {
        return NextResponse.json(
          { error: 'Organization required', message: 'No active organization membership was found.' },
          { status: 403 }
        )
      }

      if (options.module && !isModuleEnabled(organization.plan, options.module)) {
        return NextResponse.json(
          { error: 'Module unavailable', message: 'This module is not enabled for the current plan.' },
          { status: 402 }
        )
      }

      if (options.permission && !roleHasPermission(organization.role, options.permission)) {
        logger.warn('Tenant permission denied', {
          path: request.nextUrl.pathname,
          userId: auth.user.id,
          organizationId: organization.id,
          permission: options.permission,
        })

        return NextResponse.json(
          { error: 'Forbidden', message: 'Insufficient permissions for this organization.' },
          { status: 403 }
        )
      }

      return handler(request, {
        user: {
          id: auth.user.id,
          email: auth.user.email,
          role: auth.user.role,
        },
        organization,
      }, routeContext)
    } catch (error) {
      logger.error('Tenant auth middleware error', { error })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
}
