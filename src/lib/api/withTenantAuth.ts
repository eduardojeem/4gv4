import { NextRequest, NextResponse } from 'next/server'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import {
  buildMfaPath,
  isAdminMfaRole,
  MFA_ENROLLMENT_REQUIRED_CODE,
  MFA_REQUIRED_CODE,
  needsAdminMfaEnrollment,
  type AssuranceLevel,
} from '@/lib/auth/mfa'
import { organizationRequiresAdminMfa, type AdminMfaPolicyClient } from '@/lib/auth/admin-mfa-policy'
import { readPlatformPolicies } from '@/lib/platform/policies-server'
import { createClient } from '@/lib/supabase/server'
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
    /** Nivel de verificación de la sesión (`aal2` = pasó la verificación en dos pasos). */
    aal?: AssuranceLevel | null
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

/**
 * A dónde volver después de verificar: la página desde la que se hizo el
 * pedido (la API no sirve como destino), o el panel.
 */
function requestPath(request: NextRequest): string {
  try {
    const referer = new URL(request.headers.get('referer') ?? '')
    if (referer.origin === request.nextUrl.origin && !referer.pathname.startsWith('/api/')) {
      return `${referer.pathname}${referer.search}`
    }
  } catch {
    // Sin referer válido se vuelve al panel.
  }
  return '/dashboard'
}

export function withTenantAuth(options: TenantGuardOptions, handler: TenantAuthenticatedHandler) {
  return async (request: NextRequest, routeContext?: unknown) => {
    try {
      const auth = await resolveRequestAuthUser()

      if ('reason' in auth) {
        // `code` le dice a la app que se perdió el acceso (no solo un permiso), para
        // descartar los datos privados en vez de tratarlo como un 403 cualquiera.
        return NextResponse.json(
          auth.reason === 'unauthenticated'
            ? { error: 'Unauthorized' }
            : auth.reason === 'mfa_required'
              // El texto va en `error` porque es lo que muestran las pantallas.
              ? { error: 'Confirmá tu sesión con el código de tu app autenticadora para seguir.', code: MFA_REQUIRED_CODE, mfaPath: buildMfaPath(requestPath(request)) }
              : { error: 'Forbidden', code: 'ACCOUNT_INACTIVE' },
          { status: auth.reason === 'inactive' ? 403 : 401 }
        )
      }

      const organization = await getCurrentOrganizationContext(auth.user.id)

      if (!organization) {
        return NextResponse.json(
          { error: 'Organization required', code: 'ORGANIZATION_REQUIRED', message: 'No active organization membership was found.' },
          { status: 403 }
        )
      }

      // Sólo se consulta para administradores sin `aal2`: el resto no paga la consulta.
      if (isAdminMfaRole(organization.role) && auth.user.aal !== 'aal2') {
        // Como en el proxy: la exige la tienda o toda la plataforma (Superadmin →
        // Configuración). Si no se puede consultar, no se exige (no deja a todos afuera).
        const platformRequiresMfa = await readPlatformPolicies()
          .then((policies) => policies.requireTwoFactor)
          .catch(() => false)
        const requireAdminMfa = platformRequiresMfa || await createClient()
          .then((client) => organizationRequiresAdminMfa(client as unknown as AdminMfaPolicyClient, organization.id))
          .catch(() => false)
        if (needsAdminMfaEnrollment({ organizationRole: organization.role, requireAdminMfa, aal: auth.user.aal })) {
          const message = platformRequiresMfa
            ? 'Se exige la verificación en dos pasos a los administradores. Activala o confirmá tu código para seguir.'
            : 'Tu tienda exige la verificación en dos pasos a los administradores. Activala o confirmá tu código para seguir.'
          return NextResponse.json(
            {
              // El texto va en `error` porque es lo que muestran las pantallas (antes decían «Forbidden»).
              error: message,
              code: MFA_ENROLLMENT_REQUIRED_CODE,
              message,
              mfaPath: buildMfaPath(requestPath(request), { setup: true }),
            },
            { status: 403 }
          )
        }
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
          aal: auth.user.aal,
        },
        organization,
      }, routeContext)
    } catch (error) {
      logger.error('Tenant auth middleware error', { error })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
}
