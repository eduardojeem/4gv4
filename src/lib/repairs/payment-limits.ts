export class RepairPaymentAmountError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message)
    this.name = 'RepairPaymentAmountError'
  }
}

export function validateRepairPaymentAmount(input: {
  totalDue: number
  paidAmount: number
  amount: number
  isCredit?: boolean
}) {
  const totalDue = Math.max(0, Number(input.totalDue) || 0)
  const paidAmount = Math.max(0, Number(input.paidAmount) || 0)
  const amount = Math.max(0, Number(input.amount) || 0)
  const remaining = Math.max(0, totalDue - paidAmount)

  if (remaining <= 0) {
    throw new RepairPaymentAmountError('La reparacion no tiene saldo pendiente.', 'REPAIR_HAS_NO_BALANCE')
  }
  if (amount > remaining) {
    throw new RepairPaymentAmountError(
      `El pago supera el saldo pendiente de ${remaining}.`,
      'PAYMENT_EXCEEDS_BALANCE',
    )
  }
  if (input.isCredit && amount !== remaining) {
    throw new RepairPaymentAmountError(
      `El cobro a credito debe financiar el saldo completo de ${remaining}.`,
      'CREDIT_MUST_COVER_BALANCE',
    )
  }

  return remaining
}
