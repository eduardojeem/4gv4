import { NextRequest, NextResponse } from 'next/server'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import { logger } from '@/lib/logger'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { getOrganizationPlanInfo } from '@/lib/saas/subscription-service'
import type { OrganizationModule } from '@/lib/organization/business-profile'
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
  permission?: Permission | Permission[]
  /** Con una lista alcanza con cualquiera (los clientes los usan CRM y el POS). */
  module?: OrganizationModule | readonly OrganizationModule[]
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

      if (options.module) {
        const anyOf: readonly OrganizationModule[] = typeof options.module === 'string' ? [options.module] : options.module
        const planInfo = await getOrganizationPlanInfo(organization.id)
        if (!anyOf.some((module) => planInfo.modules.includes(module))) {
          const commerciallyAvailable = anyOf.some((module) => planInfo.entitledModules.includes(module)
            || planInfo.moduleTrials.some(trial => trial.module === module))
          return NextResponse.json(
            commerciallyAvailable
              ? {
                  error: 'Module disabled',
                  code: 'MODULE_DISABLED',
                  message: 'This module is disabled for the current organization.',
                }
              : {
                  error: 'Module unavailable',
                  code: 'MODULE_NOT_ENTITLED',
                  message: 'This module is not enabled for the current plan.',
                },
            { status: commerciallyAvailable ? 403 : 402 }
          )
        }
      }

      const permissions = options.permission
        ? (Array.isArray(options.permission) ? options.permission : [options.permission])
        : null

      if (permissions && !permissions.some((p) => roleHasPermission(organization.role, p))) {
        logger.warn('Tenant permission denied', {
          path: request.nextUrl.pathname,
          userId: auth.user.id,
          organizationId: organization.id,
          permission: permissions,
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
