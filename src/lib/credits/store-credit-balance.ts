/**
 * Saldo a favor del cliente, en un solo lugar.
 *
 * El ledger no es lo que el cliente puede gastar: un pedido web pendiente puede
 * tener parte reservada. Sumar solo los movimientos permitia gastar dos veces la
 * misma plata, porque la validacion del gasto usaba el bruto.
 */

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => {
          eq: (column: string, value: string) => PromiseLike<{ data: unknown[] | null; error: unknown }>
        } & PromiseLike<{ data: unknown[] | null; error: unknown }>
      }
    }
  }
}

export type StoreCreditBalance = {
  /** Suma de todos los movimientos acreditados y consumidos. */
  ledger: number
  /** Retenido por pedidos pendientes: existe, pero no se puede gastar. */
  reserved: number
  /** Lo que el cliente realmente puede usar hoy. */
  available: number
}

function sumAmounts(rows: unknown[] | null): number {
  return (rows ?? []).reduce<number>((total, row) => {
    const amount = Number((row as { amount?: unknown }).amount ?? 0)
    return total + (Number.isFinite(amount) ? amount : 0)
  }, 0)
}

export async function readStoreCreditBalance(
  supabase: SupabaseLike,
  organizationId: string,
  customerId: string,
): Promise<StoreCreditBalance> {
  const ledgerResult = await supabase
    .from('customer_store_credits')
    .select('amount')
    .eq('organization_id', organizationId)
    .eq('customer_id', customerId)

  if (ledgerResult.error) throw ledgerResult.error
  const ledger = sumAmounts(ledgerResult.data)

  const reservationsResult = await supabase
    .from('customer_store_credit_reservations')
    .select('amount')
    .eq('organization_id', organizationId)
    .eq('customer_id', customerId)
    .eq('status', 'reserved')

  if (reservationsResult.error) throw reservationsResult.error
  const reserved = sumAmounts(reservationsResult.data)

  return {
    ledger,
    reserved,
    available: Math.max(0, ledger - reserved),
  }
}
