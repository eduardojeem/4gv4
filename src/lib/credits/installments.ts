import { getCurrencyFractionDigits, getLocaleConfig } from '@/lib/currency'

export type CreditFrequency = 'weekly' | 'biweekly' | 'monthly'
export type FirstInstallmentTiming = 'at_start' | 'next_cycle'

export function creditBusinessDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-')
}

export const FIRST_INSTALLMENT_LABELS: Record<FirstInstallmentTiming, string> = {
  at_start: 'Desde el inicio del crédito',
  next_cycle: 'Desde el próximo ciclo',
}

export function isCreditInstallmentOverdue(dueDate: string, now: Date = new Date()): boolean {
  const date = new Date(dueDate)
  if (!Number.isFinite(date.getTime())) return false
  const day = /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : creditBusinessDate(date)
  return day < creditBusinessDate(now)
}

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

/**
 * Topes de un credito. Son los mismos que aplica el servidor al procesar la
 * venta (process_pos_sale_atomic) y al crear la cuenta de credito: cualquier
 * formulario que deje cargar mas termina en una venta rechazada.
 */
export const MAX_CREDIT_INSTALLMENTS = 60
/** Recargo total sobre lo financiado (no mensual), en porcentaje. */
export const MAX_CREDIT_INTEREST_RATE = 100

export function isValidCreditInterestRate(value: unknown): boolean {
  const rate = Number(value)
  return Number.isFinite(rate) && rate >= 0 && rate <= MAX_CREDIT_INTEREST_RATE
}

/** Decimales de la moneda configurada: 0 en guaranies, 2 en USD. */
export function creditFractionDigits(): number {
  return getCurrencyFractionDigits(getLocaleConfig().currency)
}

/** Redondea a la unidad minima de la moneda (guarani entero en PYG). */
export function roundToCurrencyUnit(value: number, fractionDigits: number = creditFractionDigits()): number {
  const digits = Math.max(0, Math.min(2, Math.floor(fractionDigits)))
  return roundMoney(Number(value) || 0, digits)
}

/**
 * Capital minimo para que ninguna cuota quede en cero: una unidad de moneda
 * por cuota. Con menos, el reparto deja las primeras cuotas en 0 y todo el
 * saldo en la ultima.
 */
export function minimumCreditPrincipal(installmentCount: number, fractionDigits: number = creditFractionDigits()): number {
  const digits = Math.max(0, Math.min(2, Math.floor(fractionDigits)))
  return roundMoney(normalizeInstallmentCount(installmentCount) / moneyStep(digits), digits)
}

export function normalizeInstallmentCount(value: unknown) {
  const count = Number(value)
  if (!Number.isFinite(count) || count <= 0) return 1
  return Math.min(MAX_CREDIT_INSTALLMENTS, Math.max(1, Math.floor(count)))
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
  firstInstallmentTiming?: FirstInstallmentTiming
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
  const useProvidedBase = Boolean(input.firstDueDate) || input.firstInstallmentTiming !== 'next_cycle'
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

/** Cómo se arman las cuotas: por recargo %, por valor fijo de cuota o a mano. */
export type CreditScheduleMode = 'percent' | 'installment_amount' | 'custom'

/** n cuotas del mismo valor: "10 cuotas de Gs. 150.000". */
export function fixedInstallmentAmounts(installmentCount: number, installmentAmount: number, fractionDigits: number = creditFractionDigits()): number[] {
  const amount = roundToCurrencyUnit(installmentAmount, fractionDigits)
  return Array.from({ length: normalizeInstallmentCount(installmentCount) }, () => amount)
}

/**
 * Por qué una lista de montos no sirve como plan, o null si sirve. Mismas
 * reglas que process_pos_sale_atomic_v6: cada cuota de al menos una unidad de
 * la moneda y sin fracciones, la suma cubre lo financiado y el recargo que
 * resulta no supera el tope.
 */
export function installmentAmountsError(principalAmount: number, amounts: number[], fractionDigits: number = creditFractionDigits()): string | null {
  const digits = Math.max(0, Math.min(2, Math.floor(fractionDigits)))
  const unit = 1 / moneyStep(digits)
  if (!Array.isArray(amounts) || amounts.length < 1 || amounts.length > MAX_CREDIT_INSTALLMENTS) {
    return `Cargá entre 1 y ${MAX_CREDIT_INSTALLMENTS} cuotas.`
  }
  if (amounts.some(amount => !Number.isFinite(amount) || amount < unit || roundMoney(amount, digits) !== amount)) {
    return digits === 0
      ? 'Cada cuota tiene que ser un monto entero mayor a cero.'
      : 'Cada cuota tiene que ser un monto mayor a cero, con hasta dos decimales.'
  }
  const principal = roundMoney(Math.max(0, Number(principalAmount) || 0), digits)
  const total = roundMoney(amounts.reduce((sum, amount) => sum + amount, 0), digits)
  if (principal <= 0) return 'No hay monto a crédito para repartir.'
  if (total < principal) return 'Las cuotas no cubren el monto a crédito.'
  if (impliedInterestRate(principal, total) > MAX_CREDIT_INTEREST_RATE) {
    return `El recargo que resulta de esas cuotas supera el ${MAX_CREDIT_INTEREST_RATE}%.`
  }
  return null
}

/** Recargo total % que resulta de cobrar `scheduledTotal` por `principalAmount`. */
export function impliedInterestRate(principalAmount: number, scheduledTotal: number): number {
  const principal = Number(principalAmount) || 0
  if (principal <= 0) return 0
  return Math.round(((Number(scheduledTotal) - principal) * 100 / principal) * 10_000) / 10_000
}

/**
 * Plan con montos dados por cuota. Las fechas salen del mismo calendario que
 * el plan por porcentaje; el recargo se reparte en proporción al monto de cada
 * cuota y la última se queda con el sobrante (igual que el SQL).
 */
export function buildCreditInstallmentPlanFromAmounts(input: {
  principalAmount: number
  amounts: number[]
  frequency?: CreditFrequency
  firstInstallmentTiming?: FirstInstallmentTiming
  now?: Date
  fractionDigits?: number
}): CreditInstallmentPlan {
  const digits = Number.isFinite(input.fractionDigits)
    ? Math.max(0, Math.min(2, Math.floor(input.fractionDigits as number)))
    : creditFractionDigits()
  const principalAmount = roundMoney(Math.max(0, Number(input.principalAmount) || 0), digits)
  const amounts = input.amounts.map(amount => roundMoney(Math.max(0, Number(amount) || 0), digits))
  const financedTotal = roundMoney(amounts.reduce((sum, amount) => sum + amount, 0), digits)
  const interestAmount = roundMoney(Math.max(0, financedTotal - principalAmount), digits)
  const frequency = normalizeCreditFrequency(input.frequency)
  const base = input.now ?? new Date()
  const useProvidedBase = input.firstInstallmentTiming !== 'next_cycle'
  const step = moneyStep(digits)
  let assigned = 0

  return {
    principalAmount,
    interestRate: impliedInterestRate(principalAmount, financedTotal),
    interestAmount,
    financedTotal,
    installmentCount: amounts.length,
    frequency,
    installments: amounts.map((amount, index) => {
      const interestComponent = index < amounts.length - 1
        ? (financedTotal > 0 ? Math.trunc((amount * interestAmount / financedTotal) * step) / step : 0)
        : roundMoney(interestAmount - assigned, digits)
      assigned = roundMoney(assigned + interestComponent, digits)
      return {
        installmentNumber: index + 1,
        dueDate: buildCreditDueDate(base, index, frequency, useProvidedBase),
        amount,
        principalComponent: roundMoney(amount - interestComponent, digits),
        interestComponent,
      }
    }),
  }
}
