import { createAdminSupabase } from '@/lib/supabase/admin'
import { isLoyaltyModuleMissing, type SupabaseLikeError } from './module-status'

/**
 * El saldo de puntos real de cada cliente.
 *
 * Había dos: `loyalty_accounts.balance`, que mantiene el historial de puntos, y
 * la columna vieja `customers.loyalty_points`, que nadie actualiza. El POS, la
 * lista de clientes y sus filtros leían la columna: en producción los 3
 * clientes con puntos ahí no tenían ningún movimiento, y los 3 con saldo real
 * figuraban con 0.
 *
 * Las lecturas van con el cliente admin y siempre acotadas a la organización
 * que ya resolvió la ruta.
 */

type AccountsResult = { data: unknown; error: SupabaseLikeError | null }

/**
 * Saldo por cliente desde una consulta a `loyalty_accounts`. null si el módulo
 * de puntos no está instalado: entonces no se toca lo que haya.
 */
export function balancesFromAccounts(result: AccountsResult): Map<string, number> | null {
  if (result.error) {
    if (isLoyaltyModuleMissing(result.error)) return null
    throw result.error
  }
  const balances = new Map<string, number>()
  for (const row of (result.data ?? []) as Array<{ customer_id: string; balance?: number | null }>) {
    balances.set(String(row.customer_id), Number(row.balance) || 0)
  }
  return balances
}

/** Reemplaza `loyalty_points` de cada fila por su saldo real (0 si no tiene cuenta). */
export function withRealLoyaltyPoints<T extends Record<string, unknown>>(rows: T[], balances: Map<string, number> | null): T[] {
  if (!balances) return rows
  return rows.map((row) => ({ ...row, loyalty_points: balances.get(String(row.id)) ?? 0 }))
}

/** Saldos reales de una página de clientes. */
export async function loadRealLoyaltyBalances(organizationId: string, customerIds: string[]): Promise<Map<string, number> | null> {
  if (customerIds.length === 0) return new Map()
  const result = await createAdminSupabase()
    .from('loyalty_accounts')
    .select('customer_id, balance')
    .eq('organization_id', organizationId)
    .in('customer_id', customerIds)
  return balancesFromAccounts(result)
}

/** Clientes con al menos `minimum` puntos de saldo real. null si el módulo no está instalado. */
export async function customerIdsWithAtLeastPoints(organizationId: string, minimum: number): Promise<string[] | null> {
  const result = await createAdminSupabase()
    .from('loyalty_accounts')
    .select('customer_id, balance')
    .eq('organization_id', organizationId)
    .gte('balance', minimum)
  const balances = balancesFromAccounts(result)
  return balances ? [...balances.keys()] : null
}
