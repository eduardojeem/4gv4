import { normalizeRole } from '@/lib/auth/role-utils'

/** Lo que devuelve `resolve_middleware_access` en una sola consulta. */
export type MiddlewareAccessSnapshot = {
  platformRole?: string | null
  platformRoleActive?: boolean | null
  profileRole?: string | null
  profileStatus?: string | null
  organizationRole?: string | null
}

export type DerivedAccess = {
  normalizedRole: string | undefined
  roleIsActive: boolean
  profileIsActive: boolean
  organizationRole: string | undefined
}

/**
 * Traduce la respuesta de la consulta unica a las decisiones del middleware.
 *
 * Se mantiene aparte y sin dependencias de red porque es la pieza que decide
 * quien entra al panel: conviene poder ejercitarla en tests en vez de
 * confiar en que el camino largo y el corto coincidan por inspeccion.
 */
export function deriveAccessFromSnapshot(snapshot: MiddlewareAccessSnapshot): DerivedAccess {
  let rawRole = snapshot.platformRole ?? undefined

  // user_roles es la fuente canonica para superadmin. Un perfil desactualizado
  // no puede devolver acceso de plataforma despues de revocarlo ahi.
  if (!rawRole && snapshot.profileRole !== 'super_admin') {
    rawRole = snapshot.profileRole ?? undefined
  }

  return {
    normalizedRole: normalizeRole(rawRole),
    // Ante un valor ausente se asume activo, igual que el camino largo: la
    // columna `is_active` no existe en todos los despliegues.
    roleIsActive: snapshot.platformRoleActive !== false,
    profileIsActive: !snapshot.profileStatus || snapshot.profileStatus === 'active',
    organizationRole: snapshot.organizationRole ?? undefined,
  }
}
