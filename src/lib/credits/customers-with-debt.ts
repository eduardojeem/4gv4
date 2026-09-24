/**
 * Quiénes deben plata, de verdad.
 *
 * El filtro «con deuda» del listado de clientes miraba `pending_amount` y
 * `current_balance`, dos columnas que no actualiza nadie: en 4G celulares están
 * en cero para los 91 clientes, mientras dos de ellos deben 76.800 y 60.000.
 * El filtro no encontraba a nadie, nunca.
 *
 * La deuda real son las cuotas pendientes menos lo ya pagado de cada una, que
 * es la misma cuenta con la que el servidor aprueba o rechaza una venta a
 * crédito.
 */

type ClienteConDeudaCliente = {
  from: (tabla: string) => {
    select: (columnas: string) => {
      eq: (columna: string, valor: string) => PromiseLike<{ data: unknown[] | null; error: unknown }>
      in: (columna: string, valores: string[]) => {
        in: (columna: string, valores: string[]) => PromiseLike<{ data: unknown[] | null; error: unknown }>
      }
    }
  }
}

type FilaCredito = { id: string; customer_id: string | null }
type FilaCuota = { credit_id: string; amount: number | string | null; amount_paid: number | string | null }

/** Ids de los clientes con al menos una cuota pendiente sin cubrir. */
export async function customerIdsWithOutstandingDebt(
  supabase: ClienteConDeudaCliente,
  organizationId: string,
): Promise<string[]> {
  const { data: creditos, error: errorCreditos } = await supabase
    .from('customer_credits')
    .select('id, customer_id')
    .eq('organization_id', organizationId)

  if (errorCreditos) throw errorCreditos

  const clientePorCredito = new Map<string, string>()
  for (const fila of (creditos ?? []) as FilaCredito[]) {
    if (fila.customer_id) clientePorCredito.set(fila.id, fila.customer_id)
  }
  if (clientePorCredito.size === 0) return []

  const { data: cuotas, error: errorCuotas } = await supabase
    .from('credit_installments')
    .select('credit_id, amount, amount_paid')
    .in('credit_id', [...clientePorCredito.keys()])
    // El estado «late» no lo escribe nadie: lo vencido queda en «pending».
    .in('status', ['pending', 'late'])

  if (errorCuotas) throw errorCuotas

  const deudores = new Set<string>()
  for (const cuota of (cuotas ?? []) as FilaCuota[]) {
    const saldo = Number(cuota.amount ?? 0) - Number(cuota.amount_paid ?? 0)
    if (saldo <= 0) continue
    const cliente = clientePorCredito.get(cuota.credit_id)
    if (cliente) deudores.add(cliente)
  }

  return [...deudores]
}
