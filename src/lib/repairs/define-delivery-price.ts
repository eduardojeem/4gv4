import { branchHeaders } from '@/lib/branches/client'
import type { deliveryPricePatch } from './price-required'

/**
 * Fija el precio de una reparación desde la entrega («¿Cuánto cobraste?»), con
 * la misma ruta y validaciones que la edición: no puede quedar por debajo de lo
 * que ya pagó el cliente.
 */
export async function defineDeliveryPrice(
  repairId: string,
  patch: ReturnType<typeof deliveryPricePatch>,
  branchId: string | null | undefined,
) {
  const response = await fetch(`/api/repairs/${repairId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...branchHeaders(branchId ?? null) },
    body: JSON.stringify(patch),
  })
  const body = (await response.json().catch(() => null)) as { error?: string } | null
  if (!response.ok) throw new Error(body?.error || 'No se pudo guardar el precio de la reparación.')
}
