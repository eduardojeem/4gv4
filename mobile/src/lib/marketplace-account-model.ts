/**
 * Reglas de la cuenta del marketplace, sin React ni React Native para poder
 * probarlas. El hook está en marketplace-account.ts.
 */

export type BusinessOrg = { id: string; name: string; slug: string; role: string }

export type BusinessAccess =
  /** Todavía no se sabe (cargando o error): no se muestra ni se niega el negocio. */
  | { state: 'unknown' }
  /** El servidor confirmó que no tiene un comercio activo. */
  | { state: 'none' }
  | { state: 'member'; organization: BusinessOrg }

/** Roles del comercio que abren el panel. `customer` es un comprador, no personal. */
export const PANEL_ROLES = new Set(['owner', 'admin', 'manager', 'cashier', 'technician', 'seller'])

export const canOpenBusinessPanel = (business: BusinessAccess) =>
  business.state === 'member' && PANEL_ROLES.has(business.organization.role)

/**
 * Solo un 403 con NO_ACTIVE_BUSINESS_MEMBERSHIP confirma que no tiene
 * negocio. Un rechazo genérico o una respuesta incompleta no permite
 * afirmarlo: queda «unknown» y se ofrece reintentar.
 */
export function businessFromResponse(
  result: { ok: true; data: { activeOrganization?: BusinessOrg } } | { ok: false; error: unknown },
): BusinessAccess {
  if (result.ok) {
    const org = result.data.activeOrganization
    return org?.id && org.name && org.slug && org.role
      ? { state: 'member', organization: org }
      : { state: 'unknown' }
  }
  const status = (result.error as { status?: unknown } | null)?.status
  const body = (result.error as { body?: { code?: unknown } } | null)?.body
  return status === 403 && body?.code === 'NO_ACTIVE_BUSINESS_MEMBERSHIP'
    ? { state: 'none' }
    : { state: 'unknown' }
}

/** Nombre a mostrar: el del perfil; sin él, «Tu cuenta» (no se arma con el prefijo del correo). */
export function accountDisplayName(account: { kind: 'guest' | 'buyer'; fullName: string | null }) {
  if (account.kind === 'guest') return 'Invitado'
  return account.fullName?.trim() || 'Tu cuenta'
}

/** Lo cargado solo vale para el usuario que lo pidió: al cambiar de cuenta se descarta. */
export function accountDataFor<T extends { userId: string }>(
  loaded: T | null,
  userId: string | null,
): T | null {
  return loaded && userId && loaded.userId === userId ? loaded : null
}
