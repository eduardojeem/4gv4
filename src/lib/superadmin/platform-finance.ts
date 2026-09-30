import { z } from 'zod'
import { buildPlanPriceMap, calculateRecurringRevenue } from '@/lib/superadmin/metrics-calculations'

/**
 * Gastos y rentabilidad del SaaS: calculos puros, sin base de datos, para que
 * la pagina y los tests usen exactamente las mismas reglas.
 *
 * Todo se expresa en guaranies. Los gastos en USD se convierten con el tipo de
 * cambio guardado en cada gasto, asi el historico no cambia con el dolar.
 */

export const EXPENSE_CATEGORIES = [
  'infraestructura',
  'herramientas',
  'comisiones',
  'marketing',
  'personal',
  'legal',
  'otros',
] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  infraestructura: 'Infraestructura',
  herramientas: 'Herramientas y software',
  comisiones: 'Comisiones de cobro',
  marketing: 'Marketing',
  personal: 'Personal',
  legal: 'Legal y contable',
  otros: 'Otros',
}

export const EXPENSE_RECURRENCES = ['monthly', 'yearly', 'one_time'] as const
export type ExpenseRecurrence = (typeof EXPENSE_RECURRENCES)[number]

export const RECURRENCE_LABEL: Record<ExpenseRecurrence, string> = {
  monthly: 'Mensual',
  yearly: 'Anual',
  one_time: 'Único',
}

export const EXPENSE_CURRENCIES = ['PYG', 'USD'] as const
export type ExpenseCurrency = (typeof EXPENSE_CURRENCIES)[number]

export interface PlatformExpense {
  id: string
  provider: string
  category: ExpenseCategory
  description: string | null
  amount: number
  currency: ExpenseCurrency
  /** Guaranies por unidad de `currency`. Siempre 1 para PYG. */
  fxRatePyg: number
  recurrence: ExpenseRecurrence
  /** YYYY-MM-DD */
  startsOn: string
  endsOn: string | null
  isActive: boolean
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')

export const expenseInputSchema = z
  .object({
    provider: z.string().trim().min(1, 'Indicá el proveedor').max(80),
    category: z.enum(EXPENSE_CATEGORIES),
    description: z.string().trim().max(500).nullable(),
    amount: z.number().finite().min(0, 'El monto no puede ser negativo').max(1_000_000_000_000),
    currency: z.enum(EXPENSE_CURRENCIES),
    fxRatePyg: z.number().finite().positive('El tipo de cambio debe ser mayor a 0').max(1_000_000),
    recurrence: z.enum(EXPENSE_RECURRENCES),
    startsOn: isoDate,
    endsOn: isoDate.nullable(),
    isActive: z.boolean(),
  })
  .transform((input) => ({
    ...input,
    description: input.description || null,
    fxRatePyg: input.currency === 'PYG' ? 1 : input.fxRatePyg,
  }))
  .refine((input) => !input.endsOn || input.endsOn >= input.startsOn, {
    message: 'La fecha de fin no puede ser anterior al inicio',
    path: ['endsOn'],
  })

export type ExpenseInput = z.infer<typeof expenseInputSchema>

export function expenseToPyg(expense: Pick<PlatformExpense, 'amount' | 'fxRatePyg'>): number {
  return expense.amount * expense.fxRatePyg
}

function isRunningOn(expense: PlatformExpense, day: string): boolean {
  return expense.isActive && expense.startsOn <= day && (!expense.endsOn || expense.endsOn >= day)
}

/** Lo que el gasto recurrente cuesta por mes a la fecha `day`. Los únicos no cuentan. */
export function monthlyRecurringPyg(expense: PlatformExpense, day: string): number {
  if (!isRunningOn(expense, day)) return 0
  if (expense.recurrence === 'monthly') return expenseToPyg(expense)
  if (expense.recurrence === 'yearly') return expenseToPyg(expense) / 12
  return 0
}

/** Un gasto único pesa solo en el mes en que se hizo. */
export function oneTimeInMonthPyg(expense: PlatformExpense, day: string): number {
  if (!expense.isActive || expense.recurrence !== 'one_time') return 0
  return expense.startsOn.slice(0, 7) === day.slice(0, 7) ? expenseToPyg(expense) : 0
}

export interface PlanPrice {
  tier: string
  price: number
}

export interface SubscriptionStatus {
  plan: string | null
  status: string | null
  paymentStatus?: string | null
}

/** MRR con la definición única del superadmin (ver calculateRecurringRevenue). */
export function computeMrr(plans: PlanPrice[], subscriptions: SubscriptionStatus[]) {
  const revenue = calculateRecurringRevenue(subscriptions, buildPlanPriceMap(plans))
  return {
    mrr: revenue.mrr,
    activeOrgs: subscriptions.filter((sub) => sub.status === 'active').length,
    /** Suscripciones que facturan y cuyo plan tiene precio. */
    payingOrgs: revenue.activeSubscriptions - revenue.unpricedSubscriptions,
    /** Deberían facturar pero su plan no tiene precio: el MRR está incompleto. */
    unpricedOrgs: revenue.unpricedSubscriptions,
  }
}

export interface FinanceSummary {
  mrr: number
  recurringMonthlyCost: number
  oneTimeThisMonth: number
  /** MRR menos el costo recurrente: lo que deja el negocio en un mes típico. */
  netMonthly: number
  /** Resultado del mes en curso incluyendo los gastos únicos. */
  netThisMonth: number
  /** Margen sobre el MRR; null sin ingresos. */
  marginPercent: number | null
  payingOrgs: number
  /** Ingreso promedio por tienda que paga. */
  revenuePerPayingOrg: number | null
  costPerPayingOrg: number | null
  /** Tiendas pagas necesarias para cubrir el costo recurrente al ingreso promedio actual. */
  breakEvenOrgs: number | null
  byCategory: Array<{ category: ExpenseCategory; monthly: number; sharePercent: number }>
  byProvider: Array<{ provider: string; monthly: number; sharePercent: number }>
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

export function summarizePlatformFinance(
  expenses: PlatformExpense[],
  revenue: { mrr: number; payingOrgs: number },
  day: string,
): FinanceSummary {
  const recurringMonthlyCost = expenses.reduce((sum, e) => sum + monthlyRecurringPyg(e, day), 0)
  const oneTimeThisMonth = expenses.reduce((sum, e) => sum + oneTimeInMonthPyg(e, day), 0)
  const netMonthly = revenue.mrr - recurringMonthlyCost
  const revenuePerPayingOrg = revenue.payingOrgs > 0 ? revenue.mrr / revenue.payingOrgs : null

  const byCategoryMap = new Map<ExpenseCategory, number>()
  const byProviderMap = new Map<string, number>()
  for (const expense of expenses) {
    const monthly = monthlyRecurringPyg(expense, day)
    if (monthly <= 0) continue
    byCategoryMap.set(expense.category, (byCategoryMap.get(expense.category) ?? 0) + monthly)
    const provider = expense.provider.trim()
    byProviderMap.set(provider, (byProviderMap.get(provider) ?? 0) + monthly)
  }
  const share = (value: number) => (recurringMonthlyCost > 0 ? round1((value * 100) / recurringMonthlyCost) : 0)

  return {
    mrr: revenue.mrr,
    recurringMonthlyCost,
    oneTimeThisMonth,
    netMonthly,
    netThisMonth: netMonthly - oneTimeThisMonth,
    marginPercent: revenue.mrr > 0 ? round1((netMonthly * 100) / revenue.mrr) : null,
    payingOrgs: revenue.payingOrgs,
    revenuePerPayingOrg,
    costPerPayingOrg: revenue.payingOrgs > 0 ? recurringMonthlyCost / revenue.payingOrgs : null,
    breakEvenOrgs:
      revenuePerPayingOrg && revenuePerPayingOrg > 0 ? Math.ceil(recurringMonthlyCost / revenuePerPayingOrg) : null,
    byCategory: [...byCategoryMap.entries()]
      .map(([category, monthly]) => ({ category, monthly, sharePercent: share(monthly) }))
      .sort((a, b) => b.monthly - a.monthly),
    byProvider: [...byProviderMap.entries()]
      .map(([provider, monthly]) => ({ provider, monthly, sharePercent: share(monthly) }))
      .sort((a, b) => b.monthly - a.monthly),
  }
}

/** Fecha de hoy (YYYY-MM-DD) en Paraguay, para que "este mes" no cambie según la zona del servidor. */
export function todayInParaguay(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion' }).format(now)
}
