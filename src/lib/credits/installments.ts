export type CreditFrequency = 'weekly' | 'biweekly' | 'monthly'

export type CreditInstallmentDraft = {
  installmentNumber: number
  dueDate: Date
  amount: number
  principalComponent: number
  interestComponent: number
}

export type CreditInstallmentPlan = {
  principalAmount: number
  interestRate: number
  interestAmount: number
  financedTotal: number
  installmentCount: number
  frequency: CreditFrequency
  installments: CreditInstallmentDraft[]
}

function roundMoney(value: number) {
  return Number(value.toFixed(2))
}

function splitAmount(total: number, count: number) {
  const baseAmount = Math.floor((total / count) * 100) / 100
  const remainder = roundMoney(total - (baseAmount * count))

  return Array.from({ length: count }, (_, index) =>
    roundMoney(index === count - 1 ? baseAmount + remainder : baseAmount)
  )
}

export function normalizeInstallmentCount(value: unknown) {
  const count = Number(value)
  if (!Number.isFinite(count) || count <= 0) return 1
  return Math.min(60, Math.max(1, Math.floor(count)))
}

export function normalizeCreditFrequency(value: unknown): CreditFrequency {
  return value === 'weekly' || value === 'biweekly' || value === 'monthly'
    ? value
    : 'monthly'
}

export function buildCreditDueDate(baseDate: Date, index: number, frequency: CreditFrequency, useProvidedBase: boolean) {
  const dueDate = new Date(baseDate)
  const step = useProvidedBase ? index : index + 1

  if (frequency === 'weekly') {
    dueDate.setDate(dueDate.getDate() + (7 * step))
    return dueDate
  }

  if (frequency === 'biweekly') {
    dueDate.setDate(dueDate.getDate() + (14 * step))
    return dueDate
  }

  dueDate.setMonth(dueDate.getMonth() + step)
  return dueDate
}

export function buildCreditInstallmentPlan(input: {
  principalAmount: number
  interestRate?: number
  installmentCount?: number
  frequency?: CreditFrequency
  firstDueDate?: Date | null
  startInstallmentNumber?: number
  now?: Date
}): CreditInstallmentPlan {
  const principalAmount = roundMoney(Math.max(0, Number(input.principalAmount) || 0))
  const interestRate = Math.max(0, Number(input.interestRate) || 0)
  const installmentCount = normalizeInstallmentCount(input.installmentCount)
  const frequency = normalizeCreditFrequency(input.frequency)
  const interestAmount = roundMoney(principalAmount * (interestRate / 100))
  const financedTotal = roundMoney(principalAmount + interestAmount)
  const principalParts = splitAmount(principalAmount, installmentCount)
  const interestParts = splitAmount(interestAmount, installmentCount)
  const dueDateBase = input.firstDueDate ?? input.now ?? new Date()
  const useProvidedBase = Boolean(input.firstDueDate)
  const startInstallmentNumber = Math.max(1, Math.floor(Number(input.startInstallmentNumber) || 1))

  return {
    principalAmount,
    interestRate,
    interestAmount,
    financedTotal,
    installmentCount,
    frequency,
    installments: Array.from({ length: installmentCount }, (_, index) => {
      const principalComponent = principalParts[index]
      const interestComponent = interestParts[index]

      return {
        installmentNumber: startInstallmentNumber + index,
        dueDate: buildCreditDueDate(dueDateBase, index, frequency, useProvidedBase),
        amount: roundMoney(principalComponent + interestComponent),
        principalComponent,
        interestComponent,
      }
    }),
  }
}
