export type CreditReportCredit = {
  id: string
  customerId: string
  principal: number
  interestRate: number
  createdAt: string
}

export type CreditReportInstallment = {
  creditId: string
  amount: number
  amountPaid: number | null
  status: string
  dueDate: string
}

export type CreditReportPayment = {
  creditId: string
  amount: number
  createdAt: string
}

export type CreditReport = {
  period: {
    grantedCount: number
    principalGranted: number
    financedTotal: number
    scheduledInterest: number
    paymentsReceived: number
    averageInterestRate: number
  }
  portfolio: {
    activeCredits: number
    outstandingAmount: number
    overdueAmount: number
    overdueInstallments: number
    overdueCustomers: number
    dueSoonAmount: number
    collectionRate: number
  }
  paymentTrend: Array<{ date: string; amount: number }>
  statusDistribution: Array<{ status: 'active' | 'overdue' | 'completed'; count: number }>
}

type BuildCreditReportInput = {
  credits: CreditReportCredit[]
  installments: CreditReportInstallment[]
  payments: CreditReportPayment[]
  from: Date
  to: Date
  today: string
  timeZone?: string
}

function safeAmount(value: number | null | undefined): number {
  const amount = Number(value)
  return Number.isFinite(amount) ? Math.max(0, amount) : 0
}

function remainingInstallment(installment: CreditReportInstallment): number {
  const amount = safeAmount(installment.amount)
  if (installment.status === 'paid') return 0
  return Math.max(0, amount - safeAmount(installment.amountPaid))
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function zonedDateKey(value: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value))
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${byType.year}-${byType.month}-${byType.day}`
}

export function buildCreditReport({
  credits,
  installments,
  payments,
  from,
  to,
  today,
  timeZone = 'America/Asuncion',
}: BuildCreditReportInput): CreditReport {
  const creditIds = new Set(credits.map((credit) => credit.id))
  const periodCredits = credits.filter((credit) => {
    const createdAt = new Date(credit.createdAt).getTime()
    return Number.isFinite(createdAt) && createdAt >= from.getTime() && createdAt <= to.getTime()
  })
  const scheduledByCredit = new Map<string, number>()
  const remainingByCredit = new Map<string, number>()
  const overdueCreditIds = new Set<string>()
  const overdueCustomerIds = new Set<string>()
  const customerByCredit = new Map(credits.map((credit) => [credit.id, credit.customerId]))
  const dueSoonThrough = addDays(today, 30)
  let overdueAmount = 0
  let overdueInstallments = 0
  let dueSoonAmount = 0

  for (const installment of installments) {
    if (!creditIds.has(installment.creditId)) continue
    const amount = safeAmount(installment.amount)
    const remaining = remainingInstallment(installment)
    scheduledByCredit.set(installment.creditId, (scheduledByCredit.get(installment.creditId) || 0) + amount)
    remainingByCredit.set(installment.creditId, (remainingByCredit.get(installment.creditId) || 0) + remaining)

    const dueDate = installment.dueDate.slice(0, 10)
    if (remaining > 0 && dueDate < today) {
      overdueAmount += remaining
      overdueInstallments += 1
      overdueCreditIds.add(installment.creditId)
      const customerId = customerByCredit.get(installment.creditId)
      if (customerId) overdueCustomerIds.add(customerId)
    } else if (remaining > 0 && dueDate >= today && dueDate <= dueSoonThrough) {
      dueSoonAmount += remaining
    }
  }

  const principalGranted = periodCredits.reduce((sum, credit) => sum + safeAmount(credit.principal), 0)
  const financedTotal = periodCredits.reduce((sum, credit) => {
    const scheduled = scheduledByCredit.get(credit.id) || 0
    return sum + (scheduled > 0 ? scheduled : safeAmount(credit.principal))
  }, 0)

  const periodPayments = payments.filter((payment) => {
    if (!creditIds.has(payment.creditId)) return false
    const createdAt = new Date(payment.createdAt).getTime()
    return Number.isFinite(createdAt) && createdAt >= from.getTime() && createdAt <= to.getTime()
  })
  const trendByDate = new Map<string, number>()
  for (const payment of periodPayments) {
    const date = zonedDateKey(payment.createdAt, timeZone)
    trendByDate.set(date, (trendByDate.get(date) || 0) + safeAmount(payment.amount))
  }

  const outstandingAmount = [...remainingByCredit.values()].reduce((sum, amount) => sum + amount, 0)
  const scheduledTotal = [...scheduledByCredit.values()].reduce((sum, amount) => sum + amount, 0)
  const paidTotal = Math.max(0, scheduledTotal - outstandingAmount)
  const statusCounts = { active: 0, overdue: 0, completed: 0 }
  for (const credit of credits) {
    const remaining = remainingByCredit.get(credit.id) || 0
    if (remaining <= 0) statusCounts.completed += 1
    else if (overdueCreditIds.has(credit.id)) statusCounts.overdue += 1
    else statusCounts.active += 1
  }

  return {
    period: {
      grantedCount: periodCredits.length,
      principalGranted,
      financedTotal,
      scheduledInterest: Math.max(0, financedTotal - principalGranted),
      paymentsReceived: periodPayments.reduce((sum, payment) => sum + safeAmount(payment.amount), 0),
      averageInterestRate: periodCredits.length > 0
        ? periodCredits.reduce((sum, credit) => sum + safeAmount(credit.interestRate), 0) / periodCredits.length
        : 0,
    },
    portfolio: {
      activeCredits: credits.filter((credit) => (remainingByCredit.get(credit.id) || 0) > 0).length,
      outstandingAmount,
      overdueAmount,
      overdueInstallments,
      overdueCustomers: overdueCustomerIds.size,
      dueSoonAmount,
      collectionRate: scheduledTotal > 0 ? (paidTotal / scheduledTotal) * 100 : 0,
    },
    paymentTrend: [...trendByDate.entries()]
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    statusDistribution: (['active', 'overdue', 'completed'] as const)
      .map((status) => ({ status, count: statusCounts[status] }))
      .filter((entry) => entry.count > 0),
  }
}
