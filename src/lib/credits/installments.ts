import { getCurrencyFractionDigits, getLocaleConfig } from '@/lib/currency'

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

/**
 * Unidad minima de la moneda configurada.
 *
 * Se reparte en la unidad real —guaranies enteros en PYG, centavos en USD— y no
 * siempre en centesimos. Con dos decimales fijos, Gs. 100.000 en 3 cuotas daba
 * 33.333,33 cada una y en pantalla se veian tres cuotas de 33.333: el cliente
 * sumaba 99.999 y no le cerraba con el total del contrato.
 */
function moneyStep(fractionDigits: number) {
  return 10 ** fractionDigits
}

function roundMoney(value: number, fractionDigits = 2) {
  return Number(value.toFixed(fractionDigits))
}

function splitAmount(total: number, count: number, fractionDigits: number) {
  const step = moneyStep(fractionDigits)
  const baseAmount = Math.floor((total / count) * step) / step
  const remainder = roundMoney(total - (baseAmount * count), fractionDigits)

  // El sobrante entero va completo a la ultima cuota, para que la suma cierre
  // exactamente contra el total financiado.
  return Array.from({ length: count }, (_, index) =>
    roundMoney(index === count - 1 ? baseAmount + remainder : baseAmount, fractionDigits)
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

/** Ultimo dia del mes indicado. El dia 0 del mes siguiente es el ultimo de este. */
function lastDayOfMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

export function buildCreditDueDate(baseDate: Date, index: number, frequency: CreditFrequency, useProvidedBase: boolean) {
  const dueDate = new Date(baseDate)
  const step = useProvidedBase ? index : index + 1

  if (frequency === 'weekly') {
    dueDate.setDate(dueDate.getDate() + (7 * step))
    return dueDate
  }

  if (frequency === 'biweekly') {
    dueDate.setDate(dueDate.getDate() + (15 * step))
    return dueDate
  }

  // Mensual: se conserva el dia pactado y solo se recorta cuando el mes destino
  // no lo tiene. Antes se avanzaba con setMonth() sobre la fecha completa, y eso
  // desborda: un credito firmado el 31 de enero vencia el 3 de marzo (porque el
  // 31 de febrero no existe y JavaScript lo pasa al mes siguiente), salteando
  // febrero por completo. Afectaba a todo credito iniciado los dias 29, 30 o 31.
  const agreedDay = baseDate.getDate()

  // Primero se lleva el dia al 1: con la fecha completa, setMonth volveria a
  // desbordar antes de poder recortar nada.
  dueDate.setDate(1)
  dueDate.setMonth(dueDate.getMonth() + step)

  // El dia se recorta contra ESTE mes, no contra el anterior: asi el 31 de enero
  // da 28 de febrero pero vuelve al 31 en marzo, en vez de quedarse en 28.
  dueDate.setDate(Math.min(agreedDay, lastDayOfMonth(dueDate.getFullYear(), dueDate.getMonth())))
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
  /** Decimales de la moneda. Por defecto, los de la moneda configurada. */
  fractionDigits?: number
}): CreditInstallmentPlan {
  const fractionDigits = Number.isFinite(input.fractionDigits)
    ? Math.max(0, Math.min(2, Math.floor(input.fractionDigits as number)))
    : getCurrencyFractionDigits(getLocaleConfig().currency)
  const principalAmount = roundMoney(Math.max(0, Number(input.principalAmount) || 0), fractionDigits)
  const interestRate = Math.max(0, Number(input.interestRate) || 0)
  const installmentCount = normalizeInstallmentCount(input.installmentCount)
  const frequency = normalizeCreditFrequency(input.frequency)
  const interestAmount = roundMoney(principalAmount * (interestRate / 100), fractionDigits)
  const financedTotal = roundMoney(principalAmount + interestAmount, fractionDigits)
  const principalParts = splitAmount(principalAmount, installmentCount, fractionDigits)
  const interestParts = splitAmount(interestAmount, installmentCount, fractionDigits)
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
        amount: roundMoney(principalComponent + interestComponent, fractionDigits),
        principalComponent,
        interestComponent,
      }
    }),
  }
}
