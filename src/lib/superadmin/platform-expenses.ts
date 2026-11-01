import { createAdminSupabase } from '@/lib/supabase/admin'
import { isMissingObjectError } from '@/lib/health/catalog'
import {
  computeMrr,
  type ExpenseInput,
  type PlatformExpense,
} from '@/lib/superadmin/platform-finance'
import { normalizeRevenuePlan } from '@/lib/superadmin/metrics-calculations'
import { effectivePlanFeatures } from '@/lib/saas/plan-modules'

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
    // Todos los planes: uno retirado se sigue cobrando a quien ya lo tiene.
    admin.from('subscription_plans').select('tier, price'),
    admin.from('subscriptions').select('plan, status, payment_status'),
  ])
  if (plansError || subsError) {
    throw new Error(plansError?.message || subsError?.message || 'No se pudieron cargar las suscripciones.')
  }
  return computeMrr(
    ((plans ?? []) as Array<{ tier: string; price: number | string }>).map((p) => ({ tier: p.tier, price: Number(p.price) || 0 })),
    ((subs ?? []) as Array<{ plan: string | null; status: string | null; payment_status: string | null }>).map((s) => ({
      plan: s.plan,
      status: s.status,
      paymentStatus: s.payment_status,
    })),
  )
}

export type PlatformPlanMetric = {
  id: string
  tier: string
  name: string
  price: number
  description: string | null
  isActive: boolean
  isPopular: boolean
  features: Array<{ label?: string; value?: boolean | string }>
  subscribersCount: number
  activeCount: number
  monthlyRevenue: number
  includedFeaturesCount: number
  includedFeatureKeys: string[]
}

export const DEFAULT_PLATFORM_PLANS: PlatformPlanMetric[] = [
  {
    id: 'default-free',
    tier: 'free',
    name: 'Gratis',
    price: 0,
    description: 'Para probar la plataforma y comenzar a vender en mostrador',
    isActive: true,
    isPopular: false,
    features: [],
    subscribersCount: 0,
    activeCount: 0,
    monthlyRevenue: 0,
    includedFeaturesCount: 5,
    includedFeatureKeys: ['pos', 'inventory', 'crm', 'repairs', 'services'],
  },
  {
    id: 'default-basic',
    tier: 'basic',
    name: 'Pro',
    price: 150_000,
    description: 'Para negocios en crecimiento: ecommerce, delivery y pedidos',
    isActive: true,
    isPopular: true,
    features: [],
    subscribersCount: 0,
    activeCount: 0,
    monthlyRevenue: 0,
    includedFeaturesCount: 12,
    includedFeatureKeys: ['inventory', 'inventoryAdmin', 'pos', 'crm', 'ecommerce', 'repairs', 'services', 'orders', 'delivery', 'webAnalytics', 'finances', 'reports'],
  },
  {
    id: 'default-pro',
    tier: 'pro',
    name: 'Pro Max',
    price: 250_000,
    description: 'Para empresas consolidadas: analytics avanzado y promociones',
    isActive: true,
    isPopular: false,
    features: [],
    subscribersCount: 0,
    activeCount: 0,
    monthlyRevenue: 0,
    includedFeaturesCount: 15,
    includedFeatureKeys: ['inventory', 'inventoryAdmin', 'pos', 'repairs', 'crm', 'ecommerce', 'services', 'orders', 'delivery', 'analytics', 'webAnalytics', 'promotions', 'security', 'finances', 'reports'],
  },
  {
    id: 'default-enterprise',
    tier: 'enterprise',
    name: 'Enterprise / Ultra',
    price: 450_000,
    description: 'Capacidad total, financiamiento en cuotas y soporte prioritario',
    isActive: true,
    isPopular: false,
    features: [],
    subscribersCount: 0,
    activeCount: 0,
    monthlyRevenue: 0,
    includedFeaturesCount: 19,
    includedFeatureKeys: ['pos', 'ecommerce', 'orders', 'delivery', 'promotions', 'credits', 'inventory', 'inventoryAdmin', 'repairs', 'services', 'crm', 'analytics', 'webAnalytics', 'security', 'finances', 'reports', 'users', 'branches', 'support'],
  },
]

export async function loadPlatformPlansWithMetrics(): Promise<PlatformPlanMetric[]> {
  try {
    const admin = createAdminSupabase()
    const [{ data: plansData, error: plansError }, { data: subsData, error: subsError }] = await Promise.all([
      admin.from('subscription_plans').select('id, tier, name, price, description, is_active, is_popular, features').order('price', { ascending: true }),
      admin.from('subscriptions').select('plan, status, payment_status'),
    ])

    if (plansError) {
      console.error('Error fetching subscription_plans for finanzas:', plansError)
      return DEFAULT_PLATFORM_PLANS
    }

    const rawPlans = (plansData ?? []) as Array<{
      id: string
      tier: string
      name: string | null
      price: number | string | null
      description: string | null
      is_active: boolean | null
      is_popular: boolean | null
      features: unknown
    }>

    if (rawPlans.length === 0) {
      return DEFAULT_PLATFORM_PLANS
    }

    const subs = (subsData ?? []) as Array<{
      plan: string | null
      status: string | null
      payment_status: string | null
    }>

    return rawPlans.map((p) => {
      const tier = String(p.tier ?? 'free').toLowerCase()
      const rawFeatures = Array.isArray(p.features) ? (p.features as Array<{ label?: string; value?: boolean | string }>) : []
      const effective = effectivePlanFeatures(tier, rawFeatures)
      const includedFeatureKeys = Object.entries(effective)
        .filter(([_, included]) => Boolean(included))
        .map(([key]) => key)

      const normalizedTier = normalizeRevenuePlan(tier)
      const matchingSubs = subs.filter((s) => normalizeRevenuePlan(s.plan) === normalizedTier)
      const activeSubs = matchingSubs.filter(
        (s) => s.status === 'active' && !['failed', 'refunded', 'unpaid'].includes(s.payment_status?.toLowerCase() ?? '')
      )
      const priceNum = Number(p.price) || 0
      const monthlyRevenue = activeSubs.length * priceNum

      return {
        id: p.id,
        tier,
        name: p.name?.trim() || tier.toUpperCase(),
        price: priceNum,
        description: p.description ?? null,
        isActive: p.is_active ?? true,
        isPopular: p.is_popular ?? false,
        features: rawFeatures,
        subscribersCount: matchingSubs.length,
        activeCount: activeSubs.length,
        monthlyRevenue,
        includedFeaturesCount: includedFeatureKeys.length,
        includedFeatureKeys,
      }
    })
  } catch (err) {
    console.error('Unexpected error loading platform plans for finanzas:', err)
    return DEFAULT_PLATFORM_PLANS
  }
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
