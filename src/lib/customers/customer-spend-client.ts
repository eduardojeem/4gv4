import type { CustomerSpendMetrics } from '@/lib/customers/customer-spend'

/** Igual al tope de /api/customers/spend. */
const IDS_PER_REQUEST = 2000

/**
 * Lo gastado por los clientes pedidos, desde el servidor. Lanza si alguna tanda
 * falla: un total parcial se veía igual que uno completo.
 */
export async function fetchCustomerSpend(customerIds: string[]): Promise<Record<string, CustomerSpendMetrics>> {
  const ids = [...new Set(customerIds.filter(Boolean))]
  const result: Record<string, CustomerSpendMetrics> = {}

  for (let i = 0; i < ids.length; i += IDS_PER_REQUEST) {
    const response = await fetch('/api/customers/spend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ids.slice(i, i + IDS_PER_REQUEST) }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || 'No se pudo calcular lo gastado por los clientes.')
    }
    Object.assign(result, payload.data)
  }

  return result
}

/**
 * Pone en cada cliente los totales reales. `lifetime_value`, `total_purchases`
 * y compañía son columnas que nada mantiene: en la base, 23 de los 27 clientes
 * con ventas figuraban en 0. Con esto la lista, el orden, los filtros y la
 * analítica leen el mismo número que el detalle.
 *
 * Un cliente sin operaciones queda en cero, no con lo que decía la columna.
 */
export function applyCustomerSpend<T extends { id: string; created_at?: string | null }>(
  customers: T[],
  spend: Record<string, CustomerSpendMetrics>,
): T[] {
  return customers.map((customer) => {
    const metrics = spend[customer.id]
    const total = metrics?.total ?? 0
    const operations = (metrics?.purchaseCount ?? 0) + (metrics?.repairCount ?? 0)
    return {
      ...customer,
      lifetime_value: total,
      total_purchases: metrics?.purchaseCount ?? 0,
      total_repairs: metrics?.repairCount ?? 0,
      total_spent_this_year: metrics?.yearTotal ?? 0,
      purchase_spend: metrics?.purchaseTotal ?? 0,
      repair_spend: metrics?.repairTotal ?? 0,
      last_purchase_amount: metrics?.lastAmount ?? 0,
      avg_order_value: operations > 0 ? Math.round(total / operations) : 0,
      // La última visita es la última operación, no la última edición de la ficha.
      last_visit: metrics?.lastDate ?? customer.created_at ?? null,
      spend_synced: true,
    }
  })
}

/** Campos que calcula `applyCustomerSpend`; un evento en tiempo real no debe pisarlos. */
export const COMPUTED_SPEND_FIELDS = [
  'lifetime_value',
  'total_purchases',
  'total_repairs',
  'total_spent_this_year',
  'purchase_spend',
  'repair_spend',
  'last_purchase_amount',
  'avg_order_value',
  'last_visit',
  'spend_synced',
] as const
