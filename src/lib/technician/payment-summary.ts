/** Only actual disbursements reduce the technician's unpaid balance. */
export function sumDisbursedPayments(
  payments: ReadonlyArray<{ status: string; amount: number | string }>,
): number {
  return Math.round(payments.reduce((sum, payment) => {
    if (payment.status !== 'pagado' && payment.status !== 'confirmado') return sum
    const amount = Number(payment.amount)
    if (!Number.isFinite(amount) || amount < 0) throw new Error('Importe de pago inválido')
    return sum + amount
  }, 0) * 100) / 100
}
