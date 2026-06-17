import { createAdminSupabase } from '@/lib/supabase/admin'
import type { ModuleTrial } from './plan-features'

export type ResourceType = 'users' | 'branches' | 'cashRegisters' | 'products' | 'categories'
export type PlanCode = 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE'

export interface PlanRecord {
  code: string
  slug: string | null
  name: string
  price_monthly: number
  price_note: string | null
  currency: string
  limits: Record<string, unknown>
  features: Record<string, unknown>
  modules: string[]
  is_active: boolean
  is_popular?: boolean
}

export interface SubscriptionRecord {
  id: string
  organization_id: string
  plan: string
  status: string
  provider: string | null
  provider_customer_id: string | null
  provider_subscription_id: string | null
  external_reference: string | null
  payment_status: string | null
  last_payment_method: string | null
  started_at: string | null
  trial_ends_at: string | null
  current_period_starts_at: string | null
  current_period_ends_at: string | null
  cancel_at_period_end: boolean | null
  created_at: string | null
  updated_at: string | null
}

export interface BillingProfile {
  id?: string
  organization_id: string
  business_name: string | null
  ruc: string | null
  billing_email: string | null
  fiscal_address: string | null
  phone: string | null
}

export interface SubscriptionPayment {
  id: string
  organization_id: string
  subscription_id: string | null
  plan_id: string | null
  amount: number
  currency: string
  status: string
  payment_method: string | null
  provider: string | null
  provider_payment_id: string | null
  external_reference: string | null
  receipt_url: string | null
  paid_at: string | null
  created_at: string | null
}

export interface OrganizationUsage {
  users: number
  branches: number
  cashRegisters: number
  products: number
  categories: number
}

export interface OrganizationSubscriptionState {
  subscription: SubscriptionRecord | null
  currentPlan: PlanRecord
  plans: PlanRecord[]
  usage: OrganizationUsage
  billingProfile: BillingProfile | null
  payments: SubscriptionPayment[]
  promoRedemptions?: any[]
}

// Fallback de seguridad. La fuente de verdad es la tabla `plans` (sincronizada desde
// subscription_plans por trigger); estos valores solo se usan si la DB no devuelve límites.
export const DEFAULT_LIMITS: Record<PlanCode, Record<string, number | null>> = {
  FREE: { users: 2, branches: 1, cashRegisters: 1, products: 50, categories: null, repairs: 10 },
  BASIC: { users: 10, branches: 2, cashRegisters: 3, products: 500, categories: null, repairs: 100 },
  PRO: { users: 25, branches: 5, cashRegisters: 10, products: 5000, categories: null, repairs: null },
  ENTERPRISE: { users: null, branches: null, cashRegisters: null, products: null, categories: null, repairs: null },
}

const DEFAULT_PLAN: PlanRecord = {
  code: 'FREE',
  slug: 'free',
  name: 'Free',
  price_monthly: 0,
  price_note: 'Siempre gratis',
  currency: 'PYG',
  limits: DEFAULT_LIMITS.FREE,
  features: { marketplace: 'basic', analytics: 'limited' },
  modules: ['inventory', 'pos'],
  is_active: true,
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^\d.-]/g, ''))
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

function normalizePlan(row: Record<string, unknown> | null | undefined): PlanRecord {
  if (!row) return DEFAULT_PLAN
  const code = String(row.code || 'FREE').toUpperCase() as PlanCode
  const fallbackLimits = DEFAULT_LIMITS[code] || DEFAULT_LIMITS.FREE

  return {
    code,
    slug: typeof row.slug === 'string' ? row.slug : code.toLowerCase(),
    name: typeof row.name === 'string' ? row.name : code,
    price_monthly: toNumber(row.price_monthly),
    price_note: typeof row.price_note === 'string' ? row.price_note : null,
    currency: typeof row.currency === 'string' ? row.currency : 'PYG',
    limits: typeof row.limits === 'object' && row.limits ? { ...fallbackLimits, ...row.limits } : fallbackLimits,
    features: typeof row.features === 'object' && row.features ? row.features as Record<string, unknown> : {},
    modules: Array.isArray(row.modules) ? row.modules.map(String) : [],
    is_active: row.is_active !== false,
    is_popular: row.is_popular === true,
  }
}

export function normalizePlanCode(value: unknown): PlanCode {
  const normalized = typeof value === 'string' ? value.toLowerCase().trim() : ''
  if (normalized === 'basic' || normalized === 'starter') return 'BASIC'
  if (normalized === 'pro' || normalized === 'professional' || normalized === 'profesional') return 'PRO'
  if (normalized === 'enterprise') return 'ENTERPRISE'
  return 'FREE'
}

export function getPlanLimit(plan: PlanRecord, resourceType: ResourceType): number | null {
  const value = plan.limits?.[resourceType]
  if (value === null || typeof value === 'undefined') return null
  const numeric = toNumber(value, Number.NaN)
  return Number.isFinite(numeric) ? numeric : null
}

export async function getPlanLimits(planCode: string): Promise<PlanRecord> {
  const supabase = createAdminSupabase()
  const code = planCode.toUpperCase()
  const [{ data }, { data: commercialData }] = await Promise.all([
    supabase
      .from('plans')
      .select('code, name, limits, modules, is_active')
      .eq('code', code)
      .maybeSingle(),
    supabase
      .from('subscription_plans')
      .select('tier, name, price, price_note, limits, features, is_active')
      .eq('tier', code.toLowerCase())
      .maybeSingle(),
  ])

  const [merged] = mergeCommercialPlans(
    data ? [data as Record<string, unknown>] : [{ ...DEFAULT_PLAN, code }],
    commercialData ? [commercialData as Record<string, unknown>] : []
  )

  return normalizePlan(merged)
}

function mergeCommercialPlans(
  planRows: Array<Record<string, unknown>>,
  commercialRows: Array<Record<string, unknown>>
) {
  const commercialByCode = new Map(
    commercialRows.map((row) => [normalizePlanCode(row.tier), row])
  )

  const merged = planRows.map((row) => {
    const code = normalizePlanCode(row.code)
    const commercial = commercialByCode.get(code)

    if (!commercial) return row

    return {
      ...row,
      slug: typeof commercial.tier === 'string' ? commercial.tier : row.slug,
      name: typeof commercial.name === 'string' ? commercial.name : row.name,
      price_monthly: commercial.price,
      price_note: commercial.price_note,
      currency: 'PYG',
      limits: typeof row.limits === 'object' && row.limits ? row.limits : commercial.limits,
      features: typeof commercial.features === 'object' && commercial.features ? commercial.features : row.features,
      is_active: commercial.is_active !== false && row.is_active !== false,
      is_popular: commercial.is_popular === true,
    }
  })

  for (const row of commercialRows) {
    const code = normalizePlanCode(row.tier)
    if (!merged.some((plan) => normalizePlanCode(plan.code) === code)) {
      merged.push({
        code,
        slug: row.tier,
        name: row.name,
        price_monthly: row.price,
        price_note: row.price_note,
        currency: 'PYG',
        limits: row.limits,
        features: row.features,
        modules: [],
        is_active: row.is_active,
        is_popular: row.is_popular === true,
      })
    }
  }

  return merged
}

async function countRows(table: string, organizationId: string) {
  const supabase = createAdminSupabase()
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)

  if (error) return 0
  return count || 0
}

// Las "butacas" del plan cuentan solo staff. Los clientes (role 'customer') se registran
// desde la pública y no deben consumir el límite de usuarios del plan.
async function countStaffMembers(organizationId: string) {
  const supabase = createAdminSupabase()
  const { count, error } = await supabase
    .from('organization_members')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .neq('role', 'customer')

  if (error) return 0
  return count || 0
}

export async function getOrganizationUsage(organizationId: string): Promise<OrganizationUsage> {
  const [users, branches, cashRegisters, products, categories] = await Promise.all([
    countStaffMembers(organizationId),
    countRows('branches', organizationId),
    countRows('cash_registers', organizationId),
    countRows('products', organizationId),
    countRows('categories', organizationId),
  ])

  return { users, branches, cashRegisters, products, categories }
}

export async function getCommercialPlanPrices(): Promise<Record<string, number>> {
  const supabase = createAdminSupabase()
  const { data } = await supabase
    .from('subscription_plans')
    .select('tier, price, is_active')

  return Object.fromEntries(
    ((data ?? []) as Array<Record<string, unknown>>)
      .filter((row) => row.is_active !== false)
      .map((row) => [normalizePlanCode(row.tier), toNumber(row.price)])
  )
}

export async function getCurrentOrganizationSubscription(organizationId: string): Promise<OrganizationSubscriptionState> {
  const supabase = createAdminSupabase()

  const [
    { data: subscriptionData },
    { data: organizationData },
    { data: plansData },
    { data: commercialPlansData },
    usage,
    { data: billingData },
    { data: paymentsData },
    { data: redemptionsData }
  ] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('id, organization_id, plan, status, provider, provider_customer_id, provider_subscription_id, external_reference, payment_status, last_payment_method, started_at, trial_ends_at, current_period_starts_at, current_period_ends_at, cancel_at_period_end, created_at, updated_at')
      .eq('organization_id', organizationId)
      .maybeSingle(),
    supabase
      .from('organizations')
      .select('plan')
      .eq('id', organizationId)
      .maybeSingle(),
    supabase
      .from('plans')
      .select('code, name, limits, modules, is_active')
      .eq('is_active', true)
      .order('code', { ascending: true }),
    supabase
      .from('subscription_plans')
      .select('tier, name, price, price_note, is_popular, limits, features, is_active')
      .eq('is_active', true)
      .order('price', { ascending: true }),
    getOrganizationUsage(organizationId),
    supabase
      .from('billing_profiles')
      .select('id, organization_id, business_name, ruc, billing_email, fiscal_address, phone')
      .eq('organization_id', organizationId)
      .maybeSingle(),
    supabase
      .from('subscription_payments')
      .select('id, organization_id, subscription_id, plan_id, amount, currency, status, payment_method, provider, provider_payment_id, external_reference, receipt_url, paid_at, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(25),
    supabase
      .from('subscription_promo_redemptions')
      .select('id, promo_code_id, redeemed_at, benefit_snapshot, redeemed_by')
      .eq('organization_id', organizationId)
      .order('redeemed_at', { ascending: false })
  ])

  const planRows = plansData ?? []
  const commercialRows = commercialPlansData ?? []
  const plans = mergeCommercialPlans(
    planRows as Array<Record<string, unknown>>,
    commercialRows as Array<Record<string, unknown>>
  )
    .map(normalizePlan)
    .sort((a, b) => a.price_monthly - b.price_monthly)
  const subscription = subscriptionData as SubscriptionRecord | null
  const organizationPlan = typeof organizationData?.plan === 'string' ? organizationData.plan : null
  const currentPlanCode = subscription?.plan || organizationPlan || plans[0]?.code || DEFAULT_PLAN.code
  const currentPlan = plans.find((plan) => plan.code === currentPlanCode) || normalizePlan({ ...DEFAULT_PLAN, code: currentPlanCode })

  return {
    subscription,
    currentPlan,
    plans,
    usage,
    billingProfile: billingData as BillingProfile | null,
    payments: (paymentsData ?? []) as SubscriptionPayment[],
    promoRedemptions: redemptionsData ?? [],
  }
}

/** Info liviana del plan activo (código, nombre, módulos) para gating en el cliente. */
export async function getOrganizationPlanInfo(
  organizationId: string
): Promise<{
  code: PlanCode
  name: string
  modules: string[]
  downgradedFromExpiry: boolean
  moduleTrials: ModuleTrial[]
  trialedModules: string[]
}> {
  const supabase = createAdminSupabase()
  const [{ data: sub }, { data: org }, { data: trials }] = await Promise.all([
    supabase.from('subscriptions').select('plan, payment_status').eq('organization_id', organizationId).maybeSingle(),
    supabase.from('organizations').select('plan').eq('id', organizationId).maybeSingle(),
    supabase
      .from('organization_module_trials')
      .select('module, expires_at')
      .eq('organization_id', organizationId),
  ])

  const code = normalizePlanCode(sub?.plan || org?.plan)
  const { data: plan } = await supabase
    .from('plans')
    .select('name, modules')
    .eq('code', code)
    .maybeSingle()

  const planModules = Array.isArray(plan?.modules) ? plan.modules.map(String) : []

  // Trials: separar activos (no vencidos) de los ya usados.
  const now = Date.now()
  const trialRows = (trials ?? []) as Array<{ module: string; expires_at: string }>
  const trialedModules = trialRows.map((t) => t.module)
  const moduleTrials: ModuleTrial[] = trialRows
    .filter((t) => new Date(t.expires_at).getTime() > now)
    .map((t) => ({
      module: t.module,
      expiresAt: t.expires_at,
      daysLeft: Math.max(0, Math.ceil((new Date(t.expires_at).getTime() - now) / 86400000)),
    }))

  // Módulos efectivos = los del plan + los que están en trial activo.
  const modules = Array.from(new Set([...planModules, ...moduleTrials.map((t) => t.module)]))

  // Baja de cortesía: quedó en FREE por impago (la automatización marca payment_status='unpaid').
  const downgradedFromExpiry = code === 'FREE' && sub?.payment_status === 'unpaid'
  return {
    code,
    name: typeof plan?.name === 'string' ? plan.name : code,
    modules,
    downgradedFromExpiry,
    moduleTrials,
    trialedModules,
  }
}

const BLOCKED_STATUSES = new Set(['past_due', 'suspended', 'cancelled', 'canceled', 'expired', 'unpaid'])

export async function getSubscriptionStatus(organizationId: string): Promise<{
  status: string | null
  isBlocked: boolean
  isTrialing: boolean
  trialDaysLeft: number | null
  periodDaysLeft: number | null
}> {
  const supabase = createAdminSupabase()
  const { data } = await supabase
    .from('subscriptions')
    .select('status, trial_ends_at, current_period_ends_at')
    .eq('organization_id', organizationId)
    .maybeSingle()

  const status = data?.status ?? null
  const isBlocked = status ? BLOCKED_STATUSES.has(status) : false
  const isTrialing = status === 'trialing'
  let trialDaysLeft: number | null = null
  let periodDaysLeft: number | null = null

  if (isTrialing && data?.trial_ends_at) {
    const msLeft = new Date(data.trial_ends_at).getTime() - Date.now()
    trialDaysLeft = Math.max(0, Math.ceil(msLeft / 86400000))
  }

  if (status === 'active' && data?.current_period_ends_at) {
    const msLeft = new Date(data.current_period_ends_at).getTime() - Date.now()
    periodDaysLeft = Math.max(0, Math.ceil(msLeft / 86400000))
  }

  return { status, isBlocked, isTrialing, trialDaysLeft, periodDaysLeft }
}

export async function canCreateResource(
  organizationId: string,
  resourceType: ResourceType,
  increment = 1
): Promise<{ allowed: boolean; current: number; limit: number | null; plan: PlanRecord; blocked?: boolean }> {
  const [state, subscriptionStatus] = await Promise.all([
    getCurrentOrganizationSubscription(organizationId),
    getSubscriptionStatus(organizationId),
  ])

  if (subscriptionStatus.isBlocked) {
    return {
      allowed: false,
      current: state.usage[resourceType],
      limit: null,
      plan: state.currentPlan,
      blocked: true,
    }
  }

  const current = state.usage[resourceType]
  const limit = getPlanLimit(state.currentPlan, resourceType)

  return {
    allowed: limit === null || current + increment <= limit,
    current,
    limit,
    plan: state.currentPlan,
    blocked: false,
  }
}

/**
 * Reparaciones tienen un límite MENSUAL (ej. free 10/mes, basic 100/mes), no por total.
 * Cuenta las reparaciones creadas en el mes calendario en curso para la organización.
 */
export async function canCreateRepair(
  organizationId: string
): Promise<{ allowed: boolean; current: number; limit: number | null; plan: PlanRecord; blocked?: boolean }> {
  const [state, subscriptionStatus] = await Promise.all([
    getCurrentOrganizationSubscription(organizationId),
    getSubscriptionStatus(organizationId),
  ])

  if (subscriptionStatus.isBlocked) {
    return { allowed: false, current: 0, limit: null, plan: state.currentPlan, blocked: true }
  }

  const raw = state.currentPlan.limits?.repairs
  const limit = raw === null || typeof raw === 'undefined'
    ? null
    : (Number.isFinite(toNumber(raw, Number.NaN)) ? toNumber(raw, Number.NaN) : null)

  // Plan ilimitado (limit null) -> siempre permitido, sin contar.
  if (limit === null) {
    return { allowed: true, current: 0, limit: null, plan: state.currentPlan }
  }

  const supabase = createAdminSupabase()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const { count } = await supabase
    .from('repairs')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .gte('created_at', monthStart)

  const current = count || 0
  return { allowed: current < limit, current, limit, plan: state.currentPlan }
}

export type PlanFeatureItem = {
  label: string
  iconName: string
  value: boolean | string
}

export type CommercialPlan = Omit<PlanRecord, 'features'> & {
  description: string | null
  is_popular: boolean
  highlights: string[]
  features: PlanFeatureItem[]
}

export async function getChangePlanData(organizationId: string): Promise<{
  currentPlan: CommercialPlan
  usage: OrganizationUsage
  plans: CommercialPlan[]
}> {
  const supabase = createAdminSupabase()

  const [{ data: subscriptionData }, { data: orgData }, { data: commercialData }, { data: technicalData }, usage] = await Promise.all([
    supabase.from('subscriptions').select('plan, status').eq('organization_id', organizationId).maybeSingle(),
    supabase.from('organizations').select('plan').eq('id', organizationId).maybeSingle(),
    supabase
      .from('subscription_plans')
      .select('tier, name, price, price_note, description, is_popular, limits, highlights, features, is_active')
      .eq('is_active', true)
      .order('price', { ascending: true }),
    supabase.from('plans').select('code, limits').eq('is_active', true),
    getOrganizationUsage(organizationId),
  ])

  const currentCode = (subscriptionData?.plan || orgData?.plan || 'FREE') as string

  // Límites técnicos desde la DB (fuente única); DEFAULT_LIMITS solo como fallback.
  const technicalLimitsByCode = new Map(
    ((technicalData ?? []) as Array<Record<string, unknown>>).map((row) => [
      normalizePlanCode(row.code),
      (typeof row.limits === 'object' && row.limits ? row.limits : {}) as Record<string, unknown>,
    ])
  )

  const plans = ((commercialData ?? []) as Array<Record<string, unknown>>).map((row): CommercialPlan => {
    const code = normalizePlanCode(row.tier) as PlanCode
    const limits: Record<string, unknown> = {
      ...(DEFAULT_LIMITS[code] || DEFAULT_LIMITS.FREE),
      ...(technicalLimitsByCode.get(code) || {}),
    }
    return {
      code,
      slug: typeof row.tier === 'string' ? row.tier : code.toLowerCase(),
      name: typeof row.name === 'string' ? row.name : code,
      price_monthly: toNumber(row.price),
      price_note: typeof row.price_note === 'string' ? row.price_note : null,
      currency: 'PYG',
      limits,
      features: Array.isArray(row.features) ? (row.features as PlanFeatureItem[]) : [],
      modules: [],
      is_active: row.is_active !== false,
      description: typeof row.description === 'string' ? row.description : null,
      is_popular: row.is_popular === true,
      highlights: Array.isArray(row.highlights) ? row.highlights.map(String) : [],
    }
  })

  const base = normalizePlan({ code: currentCode })
  const fallbackPlan: CommercialPlan = { ...base, description: null, is_popular: false, highlights: [], features: [] }
  const currentPlan = plans.find((p) => p.code === normalizePlanCode(currentCode)) ?? fallbackPlan

  return { currentPlan, usage, plans }
}

export async function changePlan(
  organizationId: string,
  newPlanCode: string,
): Promise<{ success: true } | { success: false; error: string; conflictingResources?: Array<{ resource: string; current: number; limit: number }> }> {
  const supabase = createAdminSupabase()
  const code = normalizePlanCode(newPlanCode) as PlanCode

  // Fuente única: límites del plan destino desde la DB (con fallback a DEFAULT_LIMITS).
  const targetPlan = await getPlanLimits(code)

  const usage = await getOrganizationUsage(organizationId)
  const resourceLabels: Record<string, string> = {
    users: 'Usuarios', branches: 'Sucursales', cashRegisters: 'Cajas', products: 'Productos',
  }

  // Solo validamos recursos que se cuentan por total (no los límites mensuales como repairs).
  const countResources: ResourceType[] = ['users', 'branches', 'cashRegisters', 'products', 'categories']
  const conflictingResources: Array<{ resource: string; current: number; limit: number }> = []

  for (const key of countResources) {
    const limit = getPlanLimit(targetPlan, key)
    if (limit === null) continue
    const current = usage[key] ?? 0
    if (current > limit) {
      conflictingResources.push({ resource: resourceLabels[key] || key, current, limit })
    }
  }

  if (conflictingResources.length > 0) {
    return { success: false, error: 'El uso actual supera los límites del plan destino.', conflictingResources }
  }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      organization_id: organizationId,
      plan: code,
      status: 'active',
      updated_at: now,
    }, { onConflict: 'organization_id' })

  if (error) return { success: false, error: error.message }

  await supabase.from('audit_log').insert({
    action: 'update',
    resource: 'subscriptions',
    new_values: { plan: code, organization_id: organizationId },
  })

  return { success: true }
}

export async function upsertBillingProfile(organizationId: string, profile: Omit<BillingProfile, 'id' | 'organization_id'>) {
  const supabase = createAdminSupabase()
  const { data, error } = await supabase
    .from('billing_profiles')
    .upsert(
      {
        organization_id: organizationId,
        ...profile,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id' }
    )
    .select('id, organization_id, business_name, ruc, billing_email, fiscal_address, phone')
    .single()

  if (error) throw error
  return data as BillingProfile
}
