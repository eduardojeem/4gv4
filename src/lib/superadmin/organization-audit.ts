/**
 * Lo que pasó en una organización, según la auditoría.
 *
 * Entra lo que se registró con su id (`audit_log.organization_id`) y los cambios
 * hechos sobre la organización misma, que se guardan con `resource_id`.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isOrganizationId(value: string | null | undefined): value is string {
  return Boolean(value && UUID_PATTERN.test(value))
}

/**
 * El filtro `or` de PostgREST. Solo acepta un id: el valor queda dentro de la
 * expresión, y cualquier otra cosa podría cambiar qué se filtra.
 */
export function organizationAuditFilter(organizationId: string): string {
  if (!isOrganizationId(organizationId)) throw new Error('organizationAuditFilter: id inválido')
  return `organization_id.eq.${organizationId},and(resource.eq.organizations,resource_id.eq.${organizationId})`
}
