export interface CustomerCreditInstallment {
  id: string
  installment_number: number
  due_date: string
  amount: number
  status: 'pending' | 'paid' | 'late'
  amount_paid: number | null
}

export interface CustomerCreditItem {
  id: string
  principal: number
  term_months: number
  start_date: string
  created_at?: string
  status: 'active' | 'completed' | 'defaulted' | 'cancelled'
  installments: CustomerCreditInstallment[]
}

const money = (value: unknown) => Math.max(0, Number(value) || 0)

export function getCustomerInstallmentView(installment: CustomerCreditInstallment, now = new Date()) {
  const amount = money(installment.amount)
  const paid = Math.min(amount, money(installment.amount_paid))
  const remaining = Math.max(0, amount - paid)
  const dueDate = new Date(installment.due_date)
  const isOverdue = remaining > 0 && !Number.isNaN(dueDate.getTime()) && dueDate.getTime() < now.getTime()
  const status = remaining === 0 || installment.status === 'paid'
    ? 'paid' as const
    : installment.status === 'late' || isOverdue
      ? 'late' as const
      : 'pending' as const

  return { amount, paid, remaining, dueDate, status }
}

export function calculateCustomerCreditOverview(credits: CustomerCreditItem[], now = new Date()) {
  const activeCredits = credits.filter((credit) => ['active', 'defaulted'].includes(credit.status))
  let totalPrincipal = 0
  let totalFinanced = 0
  let totalPaid = 0
  let totalPending = 0
  let overdueAmount = 0
  let nextPaymentDate: Date | null = null
  let nextPaymentAmount: number | null = null

  for (const credit of activeCredits) {
    totalPrincipal += money(credit.principal)
    for (const installment of credit.installments) {
      const view = getCustomerInstallmentView(installment, now)
      totalFinanced += view.amount
      totalPaid += view.paid
      totalPending += view.remaining
      if (view.status === 'late') overdueAmount += view.remaining
      if (view.remaining > 0 && (!nextPaymentDate || view.dueDate < nextPaymentDate)) {
        nextPaymentDate = view.dueDate
        nextPaymentAmount = view.remaining
      }
    }
  }

  return {
    activeCredits,
    totalPrincipal,
    totalFinanced,
    totalPaid,
    totalPending,
    overdueAmount,
    hasLateInstallments: overdueAmount > 0,
    nextPaymentDate,
    nextPaymentAmount,
    progressPercentage: totalFinanced > 0 ? Math.min(100, (totalPaid / totalFinanced) * 100) : 0,
  }
}
