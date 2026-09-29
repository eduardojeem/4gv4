import { createAdminSupabase } from '@/lib/supabase/admin'
import { isMissingObjectError } from '@/lib/health/catalog'
import {
  computeMrr,
  type ExpenseInput,
  type PlatformExpense,
} from '@/lib/superadmin/platform-finance'

/** Lectura y escritura de /superadmin/finanzas. Siempre con service role, detrás de getSuperAdminUser. */

export const PLATFORM_EXPENSES_MIGRATION = 'supabase/migrations/20260929230000_platform_expenses.sql'

const COLUMNS =
  'id, provider, category, description, amount, currency, fx_rate_pyg, recurrence, starts_on, ends_on, is_active'

type Row = {
  id: string
  provider: string
  category: PlatformExpense['category']
  description: string | null
  amount: number | string
  currency: PlatformExpense['currency']
  fx_rate_pyg: number | string
  recurrence: PlatformExpense['recurrence']
  starts_on: string
  ends_on: string | null
  is_active: boolean
}

function fromRow(row: Row): PlatformExpense {
  return {
    id: row.id,
    provider: row.provider,
    category: row.category,
    description: row.description,
    amount: Number(row.amount) || 0,
    currency: row.currency,
    fxRatePyg: Number(row.fx_rate_pyg) || 1,
    recurrence: row.recurrence,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    isActive: row.is_active,
  }
}

function toRow(input: ExpenseInput) {
  return {
    provider: input.provider,
    category: input.category,
    description: input.description,
    amount: input.amount,
    currency: input.currency,
    fx_rate_pyg: input.fxRatePyg,
    recurrence: input.recurrence,
    starts_on: input.startsOn,
    ends_on: input.endsOn,
    is_active: input.isActive,
  }
}

export type ExpensesResult =
  | { available: true; expenses: PlatformExpense[] }
  | { available: false; reason: string }

export async function listPlatformExpenses(): Promise<ExpensesResult> {
  const { data, error } = await createAdminSupabase()
    .from('platform_expenses')
    .select(COLUMNS)
    .order('is_active', { ascending: false })
    .order('starts_on', { ascending: false })

  if (error) {
    return {
      available: false,
      reason: isMissingObjectError(error)
        ? `Falta la tabla de gastos: aplicar ${PLATFORM_EXPENSES_MIGRATION} en Supabase.`
        : `No se pudieron cargar los gastos: ${error.message}`,
    }
  }
  return { available: true, expenses: ((data ?? []) as Row[]).map(fromRow) }
}

export async function loadPlatformRevenue() {
  const admin = createAdminSupabase()
  const [{ data: plans, error: plansError }, { data: subs, error: subsError }] = await Promise.all([
    admin.from('subscription_plans').select('tier, price').eq('is_active', true),
    admin.from('subscriptions').select('plan, status'),
  ])
  if (plansError || subsError) {
    throw new Error(plansError?.message || subsError?.message || 'No se pudieron cargar las suscripciones.')
  }
  return computeMrr(
    ((plans ?? []) as Array<{ tier: string; price: number | string }>).map((p) => ({ tier: p.tier, price: Number(p.price) || 0 })),
    (subs ?? []) as Array<{ plan: string | null; status: string | null }>,
  )
}

export async function insertPlatformExpense(input: ExpenseInput, createdBy: string): Promise<PlatformExpense> {
  const { data, error } = await createAdminSupabase()
    .from('platform_expenses')
    .insert({ ...toRow(input), created_by: createdBy })
    .select(COLUMNS)
    .single()
  if (error) throw new Error(error.message)
  return fromRow(data as Row)
}

export async function updatePlatformExpense(id: string, input: ExpenseInput): Promise<{ before: PlatformExpense; after: PlatformExpense }> {
  const admin = createAdminSupabase()
  const { data: current, error: readError } = await admin.from('platform_expenses').select(COLUMNS).eq('id', id).maybeSingle()
  if (readError) throw new Error(readError.message)
  if (!current) throw new Error('El gasto no existe')

  const { data, error } = await admin
    .from('platform_expenses')
    .update({ ...toRow(input), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(COLUMNS)
    .single()
  if (error) throw new Error(error.message)
  return { before: fromRow(current as Row), after: fromRow(data as Row) }
}

export async function deletePlatformExpense(id: string): Promise<PlatformExpense> {
  const { data, error } = await createAdminSupabase()
    .from('platform_expenses')
    .delete()
    .eq('id', id)
    .select(COLUMNS)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('El gasto no existe')
  return fromRow(data as Row)
}
