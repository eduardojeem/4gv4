/**
 * «Exigir 2FA a los administradores» de cada organización
 * (`organization_settings.require_admin_mfa`).
 *
 * Se consulta en cada pedido de un administrador sin `aal2`, así que el valor
 * se guarda un minuto por instancia. Al cambiarlo desde el panel se borra en
 * la instancia que lo cambió; las demás lo ven a lo sumo un minuto después.
 *
 * Ante un error (la migración todavía no llegó, timeout) se asume que no se
 * exige: igual que el resto del proxy, un fallo de la consulta no deja a todos
 * los administradores afuera del panel.
 */

const TTL_MS = 60_000

const cache = new Map<string, { value: boolean; expiresAt: number }>()

type QueryResult = { data: { require_admin_mfa?: boolean | null } | null; error: unknown }

/** Cualquier cliente de Supabase: con el del usuario RLS deja leer sólo las organizaciones de las que es miembro. */
export type AdminMfaPolicyClient = {
  from: (table: 'organization_settings') => {
    select: (columns: 'require_admin_mfa') => {
      eq: (column: 'organization_id', value: string) => {
        maybeSingle: () => PromiseLike<QueryResult>
      }
    }
  }
}

export async function organizationRequiresAdminMfa(
  client: AdminMfaPolicyClient,
  organizationId: string,
  now = Date.now()
): Promise<boolean> {
  const cached = cache.get(organizationId)
  if (cached && cached.expiresAt > now) return cached.value

  try {
    const { data, error } = await client
      .from('organization_settings')
      .select('require_admin_mfa')
      .eq('organization_id', organizationId)
      .maybeSingle()
    // Un error no se guarda: dejaría la exigencia apagada todo el minuto por un fallo puntual.
    if (error) return false
    const value = data?.require_admin_mfa === true
    cache.set(organizationId, { value, expiresAt: now + TTL_MS })
    return value
  } catch {
    return false
  }
}

export function invalidateAdminMfaPolicy(organizationId: string) {
  cache.delete(organizationId)
}

/** Sólo para tests. */
export function resetAdminMfaPolicyCache() {
  cache.clear()
}
