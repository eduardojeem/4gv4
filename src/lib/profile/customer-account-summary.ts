export interface CustomerRepairBalanceRow {
  status?: string | null
  final_cost?: number | string | null
  estimated_cost?: number | string | null
  paid_amount?: number | string | null
  payment_status?: string | null
}

export interface CustomerOrderBalanceRow {
  status?: string | null
  payment_status?: string | null
  total?: number | string | null
}

export interface CustomerCreditBalanceRow {
  status?: string | null
  credit_installments?: Array<{
    amount?: number | string | null
    amount_paid?: number | string | null
    status?: string | null
    due_date?: string | null
  }> | null
}

export interface CustomerAccountSummary {
  equipment: { total: number; active: number; ready: number; delivered: number }
  repairs: { pendingCount: number; paidCount: number; pendingAmount: number }
  orders: { pendingCount: number; paidCount: number; pendingAmount: number }
  financing: { pendingAmount: number; overdueAmount: number; overdueCount: number }
  storeCredit: number
  totalDue: number
  netBalance: number
}

export const EMPTY_CUSTOMER_ACCOUNT_SUMMARY: CustomerAccountSummary = {
  equipment: { total: 0, active: 0, ready: 0, delivered: 0 },
  repairs: { pendingCount: 0, paidCount: 0, pendingAmount: 0 },
  orders: { pendingCount: 0, paidCount: 0, pendingAmount: 0 },
  financing: { pendingAmount: 0, overdueAmount: 0, overdueCount: 0 },
  storeCredit: 0,
  totalDue: 0,
  netBalance: 0,
}

const ACTIVE_REPAIR_STATUSES = new Set(['recibido', 'diagnostico', 'reparacion', 'pausado'])
const PAID_STATUSES = new Set(['paid', 'pagado', 'completed'])
const REFUNDED_PAYMENT_STATUSES = new Set(['refunded', 'reembolsado'])

function money(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

function normalized(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase()
}

export function getRepairBalance(repair: CustomerRepairBalanceRow): {
  cost: number
  paidAmount: number
  pendingAmount: number
  isPaid: boolean
} {
  const cost = money(repair.final_cost ?? repair.estimated_cost)
  const paymentStatus = normalized(repair.payment_status)
  const paidAmount = PAID_STATUSES.has(paymentStatus) ? cost : Math.min(cost, money(repair.paid_amount))
  const pendingAmount = Math.max(0, cost - paidAmount)

  return {
    cost,
    paidAmount,
    pendingAmount,
    isPaid: cost > 0 && pendingAmount <= 0,
  }
}

export function calculateCustomerAccountSummary(input: {
  repairs: CustomerRepairBalanceRow[]
  orders: CustomerOrderBalanceRow[]
  credits: CustomerCreditBalanceRow[]
  storeCreditMovements: Array<{ amount?: number | string | null }>
}): CustomerAccountSummary {
  const equipment = {
    total: input.repairs.length,
    active: input.repairs.filter((repair) => ACTIVE_REPAIR_STATUSES.has(normalized(repair.status))).length,
    ready: input.repairs.filter((repair) => normalized(repair.status) === 'listo').length,
    delivered: input.repairs.filter((repair) => normalized(repair.status) === 'entregado').length,
  }

  let repairPendingAmount = 0
  let repairPendingCount = 0
  let repairPaidCount = 0

  for (const repair of input.repairs) {
    if (normalized(repair.status) === 'cancelado') continue

    const { pendingAmount, isPaid } = getRepairBalance(repair)

    if (isPaid) repairPaidCount += 1
    if (pendingAmount > 0) {
      repairPendingCount += 1
      repairPendingAmount += pendingAmount
    }
  }

  let orderPendingAmount = 0
  let orderPendingCount = 0
  let orderPaidCount = 0

  for (const order of input.orders) {
    const orderStatus = normalized(order.status)
    const paymentStatus = normalized(order.payment_status)
    if (orderStatus === 'cancelled' || orderStatus === 'cancelado' || REFUNDED_PAYMENT_STATUSES.has(paymentStatus)) continue

    if (PAID_STATUSES.has(paymentStatus)) {
      orderPaidCount += 1
    } else {
      orderPendingCount += 1
      orderPendingAmount += money(order.total)
    }
  }

  let financingPendingAmount = 0
  let financingOverdueAmount = 0
  let financingOverdueCount = 0

  for (const credit of input.credits) {
    const creditStatus = normalized(credit.status)
    if (!['active', 'defaulted'].includes(creditStatus)) continue

    for (const installment of credit.credit_installments || []) {
      const installmentStatus = normalized(installment.status)
      if (installmentStatus === 'paid') continue

      const pendingAmount = Math.max(0, money(installment.amount) - money(installment.amount_paid))
      financingPendingAmount += pendingAmount

      if (installmentStatus === 'late' && pendingAmount > 0) {
        financingOverdueAmount += pendingAmount
        financingOverdueCount += 1
      }
    }
  }

  const storeCredit = Math.max(
    0,
    input.storeCreditMovements.reduce((total, movement) => total + Number(movement.amount || 0), 0)
  )
  const totalDue = repairPendingAmount + orderPendingAmount + financingPendingAmount

  return {
    equipment,
    repairs: {
      pendingCount: repairPendingCount,
      paidCount: repairPaidCount,
      pendingAmount: repairPendingAmount,
    },
    orders: {
      pendingCount: orderPendingCount,
      paidCount: orderPaidCount,
      pendingAmount: orderPendingAmount,
    },
    financing: {
      pendingAmount: financingPendingAmount,
      overdueAmount: financingOverdueAmount,
      overdueCount: financingOverdueCount,
    },
    storeCredit,
    totalDue,
    netBalance: storeCredit - totalDue,
  }
}
