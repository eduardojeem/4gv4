/**
 * Cuándo una tienda puede vender en público.
 *
 * Había dos respuestas distintas a la misma pregunta. El marketplace sacaba de
 * sus listados a las tiendas con la suscripción `past_due`, `canceled` o
 * `suspended`; pero la tienda propia (`/[slug]/productos`, `/inicio`,
 * `/ofertas`, la API de productos) sólo miraba `storefront_public`. Resultado:
 * una tienda bloqueada desaparecía del marketplace y seguía vendiendo igual en
 * su dirección, y cualquier enlace viejo o favorito llevaba a su catálogo.
 *
 * Esta es la regla única, y la usan los dos.
 *
 * Lo que NO entra acá a propósito: seguimiento de pedidos, reparaciones,
 * perfil y reseñas. Un cliente de una tienda suspendida tiene que poder ver en
 * qué quedó su reparación o su compra; eso no es vender.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Estados que cierran la vitrina. Una organización sin fila de suscripción se
 * deja pasar: excluir por un dato faltante vaciaría tiendas sin que nadie sepa
 * por qué.
 */
export const BLOCKED_STORE_SUBSCRIPTION_STATUSES = ['past_due', 'canceled', 'suspended'] as const

export function isStoreSubscriptionBlocked(status: string | null | undefined): boolean {
  return (BLOCKED_STORE_SUBSCRIPTION_STATUSES as readonly string[]).includes(String(status ?? ''))
}

/** Si la suscripción de la organización cierra su tienda al público. */
export async function isOrganizationStoreBlocked(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('organization_id', organizationId)

  // Si no se puede leer el estado, no se cierra la tienda por un error de red:
  // el marketplace hace lo mismo con una organización sin suscripción.
  if (error || !data) return false
  return (data as Array<{ status: string | null }>).some((row) => isStoreSubscriptionBlocked(row.status))
}
