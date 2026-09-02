export type FirstInstallmentPayment = {
  method: 'cash' | 'transfer'
  cashReceived?: number
  bank?: string
  reference?: string
}

export function firstPaymentError(payment: FirstInstallmentPayment | undefined, amount: number, timing: string): string | null {
  if (!payment) return null
  if (timing !== 'at_start') return 'El cobro inicial requiere que las cuotas comiencen hoy.'
  if (!Number.isFinite(amount) || amount <= 0) return 'La primera cuota debe tener un importe mayor a cero.'
  if (payment.method === 'cash') {
    if (!Number.isFinite(payment.cashReceived) || Number(payment.cashReceived) < amount) return 'El efectivo recibido no cubre la primera cuota.'
  } else if (payment.method === 'transfer') {
    if (!payment.bank?.trim() || !payment.reference?.trim()) return 'Ingresá banco o cuenta receptora y referencia de la transferencia.'
  } else return 'Elegí efectivo o transferencia para la primera cuota.'
  return null
}
