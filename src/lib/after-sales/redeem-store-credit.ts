import { toast } from 'sonner'

/**
 * Consume el saldo a favor del cliente en una venta ya confirmada.
 *
 * Va despues de crear la venta porque necesita su id para ser idempotente: el
 * indice unico por venta impide descontar dos veces si el POS reintenta.
 *
 * No lanza: la venta ya existe y es correcta, asi que un fallo aca no puede
 * tumbar el cobro. Avisa fuerte para que el cajero cobre la diferencia.
 */
export async function redeemStoreCredit(params: {
  customerId: string | null | undefined
  saleId: string | null | undefined
  amount: number
}): Promise<boolean> {
  const { customerId, saleId, amount } = params

  if (!customerId || !saleId || !(amount > 0)) return false

  try {
    const response = await fetch(`/api/customers/${customerId}/store-credit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, saleId }),
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || 'No se pudo aplicar el saldo a favor.')
    }

    return true
  } catch (error) {
    toast.error('La venta se registró, pero el saldo a favor no se descontó', {
      description:
        error instanceof Error
          ? error.message
          : 'Revisá el saldo del cliente y cobrá la diferencia.',
      duration: 10000,
    })
    return false
  }
}
